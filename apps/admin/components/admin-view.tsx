"use client";
import type {
  AdminUser,
  AdminMetrics,
  AdminPage,
  AdminEvents,
  AdminOffer,
} from "@revynora/types";
import {
  AccessConfirmation,
  accessReasons,
} from "@/modules/users/access-confirmation";
import { LoadingState } from "@revynora/ui";
import { useState } from "react";
import Link from "next/link";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { Brand } from "@revynora/ui/brand";
import { Card, PageHeader, Alert, Input, FormField, Badge } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
export function AdminView() {
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(() =>
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(() =>
      new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const period = "?from=" + from + "&to=" + to + "&page=" + page;
  const metrics = useResource<AdminMetrics>("/admin/metrics" + period),
    users = useResource<AdminPage<AdminUser>>(
      "/admin/users" + period + "&search=" + encodeURIComponent(search),
    ),
    events = useResource<AdminEvents>("/admin/events" + period),
    offers = useResource<AdminOffer[]>("/admin/offers");
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        <nav className="admin-nav" aria-label="Administration">
          <a href="#admin-users">Utilisateurs</a>
          <a href="#admin-events">Événements financiers</a>
          <a href="#admin-audit">Journal d’audit</a>
          <Link
            href={process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000"}
          >
            Site public
          </Link>
          <button
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              // Full navigation clears the authenticated client state.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/connexion");
            }}
          >
            Se déconnecter
          </button>
        </nav>
      </aside>
      <main id="main" className="admin-main">
        <PageHeader
          title="Administration"
          description="Une vue de la plateforme, des abonnements de test et de l’activité pédagogique."
        />
        {(metrics.loading || users.loading) && <LoadingState />}
        {(error ||
          metrics.error ||
          users.error ||
          events.error ||
          offers.error) && (
          <Alert role="alert">
            {error ||
              metrics.error ||
              users.error ||
              events.error ||
              offers.error}
          </Alert>
        )}
        <Card>
          <div className="saas-actions">
            <FormField id="admin-from" label="Du">
              <Input
                id="admin-from"
                type="date"
                value={from}
                onChange={(e) => {
                  if (e.target.value) setFrom(e.target.value);
                }}
              />
            </FormField>
            <FormField id="admin-to" label="Au (exclu)">
              <Input
                id="admin-to"
                type="date"
                value={to}
                onChange={(e) => {
                  if (e.target.value) setTo(e.target.value);
                }}
              />
            </FormField>
          </div>
        </Card>
        {metrics.data && (
          <>
            <div className="saas-grid">
              <Card>
                <Badge>Utilisateurs</Badge>
                <h2>{metrics.data.users}</h2>
                <p>{metrics.data.newUsers} inscriptions sur la période</p>
              </Card>
              <Card>
                <Badge>Sessions IA</Badge>
                <h2>{metrics.data.ai._count}</h2>
                <p>
                  Coût estimé :{" "}
                  {metrics.data.ai._sum.estimatedCostUsd ?? "non disponible"}{" "}
                  USD
                </p>
              </Card>
              <Card>
                <Badge>Services</Badge>
                <p>
                  Facturation :{" "}
                  {metrics.data.billingMode === "mock"
                    ? "simulation locale"
                    : "Stripe test"}
                </p>
                <p>
                  Worker : {metrics.data.workerEnabled ? "activé" : "désactivé"}
                </p>
              </Card>
            </div>
            <Card>
              <h2>Paiements sur la période</h2>
              {metrics.data.payments.length === 0 && <p>Aucun paiement.</p>}
              {metrics.data.payments.map((p) => (
                <div className="saas-row" key={p.provider + p.status}>
                  <span>
                    {p.provider === "mock" ? "Simulation" : "Stripe test"} ·{" "}
                    {p.status}
                  </span>
                  <strong>
                    {((p._sum.amountCents ?? 0) / 100).toFixed(2)} € ·{" "}
                    {p._count} événements
                  </strong>
                </div>
              ))}
            </Card>
          </>
        )}
        <Card id="admin-users">
          <h2>Utilisateurs</h2>
          <FormField id="admin-search" label="Rechercher par nom ou e-mail">
            <Input
              id="admin-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>E-mail</th>
                  <th>Rôle</th>
                  <th>État</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.disabledAt ? "Suspendu" : "Actif"}</td>
                    <td>
                      {u.role !== "ADMIN" && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setError("");
                            setPending(u);
                          }}
                        >
                          {u.disabledAt ? "Réactiver" : "Suspendre"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pending && (
            <AccessConfirmation
              key={pending.id}
              name={pending.name}
              disabled={!pending.disabledAt}
              busy={busy}
              onCancel={() => setPending(null)}
              onConfirm={async (command) => {
                setBusy(true);
                setError("");
                try {
                  await api("/admin/users/" + pending.id, {
                    method: "PATCH",
                    body: JSON.stringify(command),
                  });
                  setPending(null);
                  users.reload();
                  events.reload();
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          <div className="saas-actions">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <span>Page {page}</span>
            <Button
              variant="outline"
              disabled={page * 20 >= (users.data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </Card>
        <Card>
          <h2>Catalogue des offres</h2>
          {offers.data?.map((o) => (
            <div className="saas-row" key={o.code}>
              <strong>{o.code}</strong>
              <span>
                {(o.priceCents / 100).toFixed(2)} € / mois ·{" "}
                {o.active ? "Disponible" : "Inactive"}
              </span>
            </div>
          ))}
          <p>
            Les prix de cette phase sont fixes. Toute nouvelle grille nécessite
            une nouvelle version de catalogue.
          </p>
        </Card>
        <Card id="admin-events">
          {events.data?.items.length === 0 && (
            <p>Aucun événement financier sur cette période.</p>
          )}
          <h2>Événements financiers · {events.data?.total ?? 0}</h2>
          {events.data?.items.map((e) => (
            <div className="saas-row" key={e.id}>
              <span>{e.eventType}</span>
              <Badge>{e.status}</Badge>
              <small>{new Date(e.createdAt).toLocaleString("fr-FR")}</small>
            </div>
          ))}
        </Card>
        <Card id="admin-audit">
          {events.data?.audit.length === 0 && (
            <p>Aucune action journalisée sur cette période.</p>
          )}
          <h2>Journal d’audit</h2>
          {events.data?.audit.map((e) => (
            <div className="saas-row" key={e.id}>
              <span>{e.action}</span>
              <small>
                Administrateur : {e.actorId ?? "historique"} · Cible :{" "}
                {e.targetUserId ?? "non disponible"} ·{" "}
                {e.reason
                  ? accessReasons[e.reason]
                  : "motif historique indisponible"}{" "}
                · {e.result ?? "LEGACY"}
              </small>
              <small>{new Date(e.createdAt).toLocaleString("fr-FR")}</small>
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}
