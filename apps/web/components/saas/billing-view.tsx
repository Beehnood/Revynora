"use client";
import type { UserProfile } from "@revynora/types";
import { InternalLearningAccess } from "./internal-learning-access";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { Card, PageHeader, Badge, Alert, LoadingState } from "../ui";
import { Button } from "../ui/button";
type Offer = { code: string; name: string; priceCents: number };
type Current = {
  plan: string;
  mode: string;
  canManage?: boolean;
  pending?: { id: string; url: string | null };
  period: null | { endsAt: string; cancelAtPeriodEnd: boolean };
};
type Payment = {
  id: string;
  amountCents: number;
  status: string;
  provider: string;
  createdAt: string;
  receiptUrl?: string | null;
};
export function BillingView({ user }: { user?: UserProfile } = {}) {
  return user?.role === "ADMIN" ? (
    <InternalLearningAccess />
  ) : (
    <CommercialBillingView />
  );
}
function CommercialBillingView() {
  const [paymentPage, setPaymentPage] = useState(1);
  const current = useResource<Current>("/subscriptions/me"),
    plans = useResource<Offer[]>("/subscriptions/plans"),
    payments = useResource<{ items: Payment[]; total?: number }>(
      paymentPage === 1 ? "/payments/me" : "/payments/me?page=" + paymentPage,
    );
  const params = useSearchParams(),
    router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const simulation = params.get("simulation");
  const returning = params.get("retour") === "paiement";
  const waiting = returning && current.data?.plan === "FREE";
  const reloadCurrent = current.reload;
  useEffect(() => {
    if (!waiting) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (attempts++ < 15) reloadCurrent();
      else clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [waiting, reloadCurrent]);
  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url?: string; effectiveAt?: string }>(path, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      });
      if (result.url) {
        if (result.url.startsWith("/") && !result.url.startsWith("//"))
          router.push(result.url);
        else {
          const url = new URL(result.url);
          if (
            url.protocol !== "https:" ||
            !["checkout.stripe.com", "billing.stripe.com"].includes(
              url.hostname,
            )
          )
            throw new Error("Adresse de facturation invalide.");
          window.location.assign(url.href);
        }
      } else {
        router.replace("/app/abonnement");
        setNotice(
          result.effectiveAt
            ? "Changement programmé pour le " +
                new Date(result.effectiveAt).toLocaleDateString("fr-FR") +
                ". Les droits actuels restent valables jusque-là."
            : "État de facturation actualisé.",
        );
        current.reload();
        payments.reload();
        router.refresh();
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Mon abonnement"
        description="Choisis le rythme qui te ressemble. Tes apprentissages restent dans ton espace privé."
      />
      {error && <Alert role="alert">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      {waiting && (
        <Alert>
          Validation du paiement en cours. Seule la confirmation vérifiée du
          prestataire activera ton offre.{" "}
          <Button variant="outline" onClick={current.reload}>
            Actualiser mon offre
          </Button>
        </Alert>
      )}
      {params.get("retour") === "annule" && (
        <Alert>Paiement interrompu. Aucun droit payant n’a été ajouté.</Alert>
      )}
      {(current.error || plans.error || payments.error) && (
        <Alert role="alert">
          {current.error || plans.error || payments.error}
        </Alert>
      )}
      {current.loading && <LoadingState />}
      {current.data && (
        <Card>
          <Badge>{current.data.plan}</Badge>
          <h2>Ton offre actuelle</h2>
          {current.data.plan === "FREE" && current.data.canManage && (
            <Button
              disabled={busy}
              onClick={() => act("/billing/portal-session")}
            >
              Gérer mes moyens de paiement
            </Button>
          )}
          {current.data.pending?.url && (
            <p>
              <Link href={current.data.pending.url}>
                Reprendre le paiement en attente
              </Link>
            </p>
          )}
          <p>
            {current.data.mode === "simulation"
              ? "Simulation locale : aucun prélèvement ni paiement réel."
              : "Stripe en mode test : aucun paiement réel."}
          </p>
          {current.data.period && (
            <p>
              {current.data.period.cancelAtPeriodEnd
                ? "Fin prévue"
                : "Fin de période"}{" "}
              :{" "}
              {new Date(current.data.period.endsAt).toLocaleDateString("fr-FR")}
            </p>
          )}
          {current.data.plan !== "FREE" && (
            <Button
              disabled={busy}
              onClick={() =>
                act(
                  current.data!.mode === "simulation"
                    ? "/billing/mock-cancel"
                    : "/billing/portal-session",
                )
              }
            >
              {current.data.mode === "simulation"
                ? "Résilier à la fin de la période"
                : "Gérer dans le portail Stripe"}
            </Button>
          )}
        </Card>
      )}
      {simulation && (
        <Card>
          <h2>Confirmer la simulation</h2>
          <p>
            Ce parcours reproduit une confirmation ou un refus de paiement.
            Aucun argent n’est débité.
          </p>
          <div className="saas-actions">
            <Button
              disabled={busy}
              onClick={() =>
                act("/billing/mock-complete", {
                  intentId: simulation,
                  success: true,
                })
              }
            >
              Simuler un paiement accepté
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                act("/billing/mock-complete", {
                  intentId: simulation,
                  success: false,
                })
              }
            >
              Simuler un refus
            </Button>
          </div>
        </Card>
      )}
      {current.data && current.data.plan !== "FREE" && (
        <Card>
          <h2>Changer d’offre</h2>
          <p>
            Le changement prendra effet à la prochaine période, sans prorata. La
            confirmation du prestataire reste nécessaire.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              act("/billing/change-plan", {
                plan: current.data!.plan === "PLUS" ? "PRO" : "PLUS",
              })
            }
          >
            Passer à {current.data.plan === "PLUS" ? "Pro" : "Plus"} à
            l’échéance
          </Button>
        </Card>
      )}
      <div className="saas-grid">
        {plans.data?.map((p) => (
          <Card key={p.code}>
            <Badge>{p.name}</Badge>
            <h2>
              {(p.priceCents / 100).toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
              <small> / mois</small>
            </h2>
            <p>
              {p.code === "FREE"
                ? "Tests, cours et historique pédagogique."
                : p.code === "PLUS"
                  ? "Tout Free, avec les cartes et les révisions Leitner."
                  : "Tout Plus, avec le planning et les rappels facultatifs."}
            </p>
            {p.code !== "FREE" && (
              <Button
                disabled={busy || !current.data || current.data.plan !== "FREE"}
                onClick={() =>
                  act("/billing/checkout-session", { plan: p.code })
                }
              >
                Choisir {p.name}
              </Button>
            )}
          </Card>
        ))}
      </div>
      <Card>
        <h2>Mes paiements</h2>
        {payments.data?.items.length === 0 && (
          <p>Aucun paiement pour le moment.</p>
        )}
        {payments.data?.items.map((p) => (
          <div className="saas-row" key={p.id}>
            <span>
              {new Date(p.createdAt).toLocaleDateString("fr-FR")} ·{" "}
              {p.provider === "mock" ? "Simulation" : "Stripe test"}
            </span>
            <strong>{(p.amountCents / 100).toFixed(2)} €</strong>
            <Badge>{p.status}</Badge>
            {p.receiptUrl &&
              /^https:\/\/(invoice|pay|billing|checkout)\.stripe\.com\//.test(
                p.receiptUrl,
              ) && (
                <a
                  href={p.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Voir le reçu Stripe
                </a>
              )}
          </div>
        ))}
        {(payments.data?.total ?? 0) > 20 && (
          <div className="saas-actions">
            <Button
              variant="outline"
              disabled={paymentPage === 1}
              onClick={() => setPaymentPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <span>Page {paymentPage}</span>
            <Button
              variant="outline"
              disabled={paymentPage * 20 >= (payments.data?.total ?? 0)}
              onClick={() => setPaymentPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
