"use client";
import { money, dateLabel, label } from "@/lib/presentation";
import { useState } from "react";
import type {
  AdminPage,
  AdminPayment,
  AdminSubscriptionPeriod,
  AdminOffer,
} from "@revynora/types";
import { Card, PageHeader, Alert, LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
function Money({ value, currency }: { value: number; currency: string }) {
  return <>{money(value, currency)}</>;
}
function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (n: number) => void;
}) {
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <Button
        variant="outline"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Précédent
      </Button>
      <span>
        Page {page} · {total} résultats
      </span>
      <Button
        variant="outline"
        disabled={page * 20 >= total || page >= 10000}
        onClick={() => onPage(page + 1)}
      >
        Suivant
      </Button>
    </nav>
  );
}
export function BillingPanel({ kind }: { kind: "payments" | "subscriptions" }) {
  const [page, setPage] = useState(1),
    [provider, setProvider] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [plan, setPlan] = useState("ALL");
  const payments = kind === "payments";
  const resource = useResource<
    AdminPage<AdminPayment | AdminSubscriptionPeriod>
  >(
    `/admin/${kind}?page=${page}&provider=${provider}&status=${status}${payments ? "" : "&plan=" + plan}`,
  );
  const statuses = payments
    ? ["PENDING", "PAID", "FAILED", "REFUNDED"]
    : ["ACTIVE", "PAST_DUE", "CANCELLED", "INCOMPLETE"];
  return (
    <>
      <PageHeader
        title={payments ? "Paiements" : "Abonnements"}
        description="Consultation uniquement. Statuts et montants enregistrés, sans preuve d’encaissement réel."
      />
      {!payments && <Offers />}
      <Card>
        <div className="admin-filters">
          <label>
            Fournisseur
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setPage(1);
              }}
            >
              {["ALL", "mock", "stripe", "internal", "other"].map((x) => (
                <option key={x} value={x}>
                  {x === "ALL" ? "Tous les fournisseurs" : label(x)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Statut enregistré
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {["ALL", ...statuses].map((x) => (
                <option key={x} value={x}>
                  {x === "ALL" ? "Tous les statuts" : label(x)}
                </option>
              ))}
            </select>
          </label>
          {!payments && (
            <label>
              Offre
              <select
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  setPage(1);
                }}
              >
                {["ALL", "FREE", "PLUS", "PRO"].map((x) => (
                  <option key={x} value={x}>
                    {x === "ALL" ? "Toutes les offres" : label(x)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Card>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button onClick={resource.reload}>Réessayer</Button>
        </Alert>
      )}
      {resource.data && (
        <Card>
          {resource.data.items.length === 0 ? (
            <p>
              {resource.data.total > 0
                ? "Aucun résultat sur cette page."
                : provider !== "ALL" ||
                    status !== "ALL" ||
                    (!payments && plan !== "ALL")
                  ? "Aucun résultat pour ces filtres."
                  : payments
                    ? "Aucun paiement enregistré."
                    : "Aucune période d’abonnement enregistrée."}
            </p>
          ) : (
            <>
              <p className="admin-scroll-hint">
                Faites défiler le tableau horizontalement pour voir toutes les
                colonnes.
              </p>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Données financières enregistrées"
              >
                <table className="admin-table">
                  <caption>
                    {payments
                      ? "Paiements enregistrés — aucun total encaissé calculé"
                      : "Périodes d’abonnement enregistrées — un statut ACTIVE ne prouve pas un droit actuel ni un paiement"}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Identifiant interne</th>
                      <th scope="col">Fournisseur</th>
                      <th scope="col">Statut enregistré</th>
                      <th scope="col">Montant enregistré</th>
                      <th scope="col">Contexte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.items.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">
                          <span className="admin-reference" title={row.id}>
                            {row.id}
                          </span>
                        </th>
                        <td>{label(row.provider)}</td>
                        <td>{label(row.status)}</td>
                        <td>
                          <Money
                            value={
                              "amountCents" in row
                                ? row.amountCents
                                : row.priceCents
                            }
                            currency={row.currency}
                          />
                        </td>
                        <td>
                          {"verification" in row ? (
                            <>
                              {row.verification === "SIMULATION"
                                ? "Simulation — aucun paiement réel"
                                : "Paiement non vérifié"}{" "}
                              · {dateLabel(row.createdAt)}
                            </>
                          ) : (
                            <>
                              {label(row.plan)} · {dateLabel(row.startsAt)} →{" "}
                              {dateLabel(row.endsAt)} ·{" "}
                              {row.cancelAtPeriodEnd
                                ? "Annulation prévue en fin de période"
                                : "Aucune annulation en fin de période enregistrée"}{" "}
                              ·{" "}
                              {row.provider === "mock"
                                ? "Simulation"
                                : row.provider === "internal"
                                  ? "Période interne"
                                  : "Paiement non vérifié"}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <Pager page={page} total={resource.data.total} onPage={setPage} />
        </Card>
      )}
    </>
  );
}
function Offers() {
  const r = useResource<AdminOffer[]>("/admin/offers");
  return (
    <Card>
      <h2>Offres et droits</h2>
      <p>
        Free : tests, cours et historique. Plus : Free + révisions Leitner. Pro
        : Plus + planning et rappels facultatifs. Ces droits suivent les règles
        produit existantes.
      </p>
      {r.loading && <LoadingState />}
      {r.error && (
        <Alert role="alert">
          {r.error}
          <Button onClick={r.reload}>Réessayer les offres</Button>
        </Alert>
      )}
      {r.data?.length === 0 && <p>Aucune offre enregistrée.</p>}
      {r.data?.map((o) => (
        <p className="admin-offer" key={o.code}>
          {label(o.code)} · <Money value={o.priceCents} currency={o.currency} />{" "}
          · {o.active ? "Offre active" : "Offre inactive"}
        </p>
      ))}
    </Card>
  );
}
