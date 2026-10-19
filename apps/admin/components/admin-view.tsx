"use client";
import type { AdminMetrics, AdminEvents, AdminOffer } from "@revynora/types";
import { accessReasons } from "@/modules/users/access-confirmation";
import { LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/use-resource";
import { Card, PageHeader, Alert, Input, FormField, Badge } from "@revynora/ui";
export function AdminView() {
  const [page, setPage] = useState(1),
    [from, setFrom] = useState(() =>
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(() =>
      new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    );
  const period = "?from=" + from + "&to=" + to + "&page=" + page;
  const metrics = useResource<AdminMetrics>("/admin/metrics" + period),
    events = useResource<AdminEvents>("/admin/events" + period),
    offers = useResource<AdminOffer[]>("/admin/offers");
  return (
    <>
      <PageHeader
        title="Administration"
        description="Une vue de la plateforme, des abonnements de test et de l’activité pédagogique."
      />
      {metrics.loading && <LoadingState />}
      {(metrics.error || events.error || offers.error) && (
        <Alert role="alert">
          {metrics.error || events.error || offers.error}
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
                {metrics.data.ai._sum.estimatedCostUsd ?? "non disponible"} USD
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
                  {((p._sum.amountCents ?? 0) / 100).toFixed(2)} € · {p._count}{" "}
                  événements
                </strong>
              </div>
            ))}
          </Card>
        </>
      )}
      <Card>
        <h2>Gestion des utilisateurs</h2>
        <Link href="/utilisateurs">Consulter les utilisateurs</Link>
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
      <div className="saas-actions">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Événements précédents
        </Button>
        <span>Page événements {page}</span>
        <Button
          variant="outline"
          disabled={page * 20 >= (events.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Événements suivants
        </Button>
      </div>
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
    </>
  );
}
