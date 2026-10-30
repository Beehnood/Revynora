"use client";
import { useState } from "react";
import type { AdminMetrics } from "@revynora/types";
import {
  Card,
  PageHeader,
  Alert,
  Input,
  FormField,
  Badge,
  LoadingState,
} from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
import { dateLabel } from "@/lib/admin-presentation";
import { StatisticsPanel } from "@/modules/admin/statistics/statistics-panel";
import { SupervisionPanel } from "@/modules/admin/supervision/supervision-panel";
function Metrics({ from, to }: { from: string; to: string }) {
  const resource = useResource<AdminMetrics>(
    "/admin/metrics?from=" + from + "&to=" + to,
  );
  const data = resource.loading || resource.error ? null : resource.data;
  return (
    <section aria-label="Synthèse de la plateforme">
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer la synthèse
          </Button>
        </Alert>
      )}
      {!resource.loading && !resource.error && !data && (
        <p role="status">Synthèse non disponible.</p>
      )}
      {data && (
        <div className="saas-grid admin-kpis">
          <Card>
            <Badge>Utilisateurs</Badge>
            <p className="admin-kpi-value">{data.users}</p>
            <p>
              {data.newUsers} inscription{data.newUsers > 1 ? "s" : ""} sur la
              période
            </p>
          </Card>
          <Card>
            <Badge>Requêtes IA enregistrées</Badge>
            <p className="admin-kpi-value">{data.ai._count}</p>
            <p>
              Coût estimé : {data.ai._sum.estimatedCostUsd ?? "non disponible"}{" "}
              USD
            </p>
          </Card>
          <Card>
            <Badge>Services</Badge>
            <p>
              Facturation :{" "}
              {data.billingMode === "mock"
                ? "simulation locale"
                : data.billingMode === "stripe"
                  ? "Stripe test (adaptateur actuel)"
                  : "mode non reconnu"}
            </p>
            <p>
              Rappels automatiques :{" "}
              {data.workerEnabled ? "activé" : "désactivé"}
            </p>
          </Card>
        </div>
      )}
    </section>
  );
}
export function AdminDashboard() {
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [applied, setApplied] = useState({ from, to });
  const [error, setError] = useState("");
  const periodKey = applied.from + "/" + applied.to;
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
      <Card>
        <form
          className="saas-actions"
          onSubmit={(event) => {
            event.preventDefault();
            const days = (Date.parse(to) - Date.parse(from)) / 86400000;
            if (!Number.isInteger(days) || days < 1 || days > 366) {
              setError("Choisissez une période de 1 à 366 jours UTC.");
              return;
            }
            setError("");
            setApplied({ from, to });
          }}
        >
          <FormField id="admin-from" label="Du">
            <Input
              id="admin-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormField>
          <FormField id="admin-to" label="Au (exclu)">
            <Input
              id="admin-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </FormField>
          <Button type="submit">Appliquer la période</Button>
        </form>
        {error && <Alert role="alert">{error}</Alert>}
        <p>
          Intervalle UTC, début inclus et fin exclue. Le total des utilisateurs
          est le nombre actuel, indépendamment de la période.
        </p>
      </Card>
      <Metrics key={"metrics/" + periodKey} {...applied} />
      <StatisticsPanel key={"statistics/" + periodKey} {...applied} />
      <SupervisionPanel key={"supervision/" + periodKey} {...applied} />
    </>
  );
}
