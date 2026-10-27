"use client";
import { money, dateLabel, label } from "@/lib/presentation";
import type { AdminMetrics, AdminEvents, AdminOffer } from "@revynora/types";
import { accessReasons } from "@/modules/users/access-confirmation";
import { LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { SupervisionPanel } from "@/modules/supervision/supervision-panel";
import { StatisticsPanel } from "@/modules/statistics/statistics-panel";
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
  const [applied, setApplied] = useState({ from, to });
  const [periodError, setPeriodError] = useState("");
  const period =
    "?from=" + applied.from + "&to=" + applied.to + "&page=" + page;
  const metrics = useResource<AdminMetrics>("/admin/metrics" + period),
    events = useResource<AdminEvents>("/admin/events" + period),
    offers = useResource<AdminOffer[]>("/admin/offers");
  return (
    <>
      <PageHeader
        title="Administration"
        description="Activité, inscriptions et suivi de la plateforme."
      />
      <p className="admin-period-label">
        Période appliquée : {dateLabel(applied.from, false)} →{" "}
        {dateLabel(applied.to, false)} (fin exclue, UTC)
      </p>
      {metrics.loading && <LoadingState />}
      {(metrics.error || events.error || offers.error) && (
        <Alert role="alert">
          {metrics.error || events.error || offers.error}
          <Button
            variant="outline"
            onClick={() => {
              metrics.reload();
              events.reload();
              offers.reload();
            }}
          >
            Réessayer la synthèse
          </Button>
        </Alert>
      )}
      <Card>
        <form
          className="saas-actions"
          onSubmit={(e) => {
            e.preventDefault();
            const days = (Date.parse(to) - Date.parse(from)) / 86400000;
            if (!Number.isInteger(days) || days < 1 || days > 366) {
              setPeriodError("Choisissez une période de 1 à 366 jours UTC.");
              return;
            }
            setPeriodError("");
            setPage(1);
            setApplied({ from, to });
          }}
        >
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
          <Button type="submit">Appliquer la période</Button>
        </form>
        {periodError && <Alert role="alert">{periodError}</Alert>}
        <p>
          Intervalle UTC, début inclus et fin exclue. Le total des utilisateurs
          est le nombre actuel, indépendamment de la période.
        </p>
      </Card>
      {metrics.data && (
        <>
          <div className="saas-grid admin-kpis">
            <Card>
              <Badge>Utilisateurs</Badge>
              <p className="admin-kpi-value">{metrics.data.users}</p>
              <p>
                {metrics.data.newUsers} inscription
                {metrics.data.newUsers > 1 ? "s" : ""} sur la période
              </p>
            </Card>
            <Card>
              <Badge>Requêtes IA enregistrées</Badge>
              <p className="admin-kpi-value">{metrics.data.ai._count}</p>
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
                  : metrics.data.billingMode === "stripe"
                    ? "Stripe test (adaptateur actuel)"
                    : "mode non reconnu"}
              </p>
              <p>
                Rappels automatiques :{" "}
                {metrics.data.workerEnabled ? "activé" : "désactivé"}
              </p>
            </Card>
          </div>
        </>
      )}
      <StatisticsPanel from={applied.from} to={applied.to} />
      <SupervisionPanel from={applied.from} to={applied.to} />
      <div className="admin-shortcuts">
        <Link href="/utilisateurs">Gérer les utilisateurs →</Link>
        <Link href="/abonnements">Consulter les abonnements →</Link>
        <Link href="/paiements">Consulter les paiements →</Link>
      </div>
      <details className="admin-secondary">
        <summary>Offres, événements financiers et journal d’audit</summary>
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
                {money(o.priceCents, o.currency)} · prix catalogue ·{" "}
                {o.active ? "Disponible" : "Inactive"}
              </span>
            </div>
          ))}
          <p>
            Toute nouvelle grille nécessite une nouvelle version de catalogue.
            Les comptes habilités peuvent la préparer dans la gestion
            commerciale.
          </p>
        </Card>
        <Card id="admin-events">
          {events.data?.items.length === 0 && (
            <p>Aucun événement financier sur cette période.</p>
          )}
          <h2>Événements financiers · {events.data?.total ?? 0}</h2>
          {events.data?.items.map((e) => (
            <div className="saas-row" key={e.id}>
              <span>{label(e.eventType)}</span>
              <Badge>{label(e.status)}</Badge>
              <small>{dateLabel(e.createdAt)}</small>
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
              <span>{label(e.action)}</span>
              <small>
                Administrateur : {e.actorId ?? "historique"} · Cible :{" "}
                {e.targetUserId ?? "non disponible"} ·{" "}
                {e.reason
                  ? accessReasons[e.reason]
                  : "motif historique indisponible"}{" "}
                · {label(e.result ?? "LEGACY")}
              </small>
              <small>{dateLabel(e.createdAt)}</small>
            </div>
          ))}
        </Card>
      </details>
    </>
  );
}
