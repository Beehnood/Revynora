"use client";
import { useState } from "react";
import type { AdminEvents } from "@revynora/types";
import { Card, Alert, LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
import { dateLabel, label } from "@/lib/admin-presentation";
import { accessReasons } from "./access-confirmation";
export function UserAudit({ userId }: { userId: string }) {
  const [from] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [to] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const resource = useResource<AdminEvents>(
    `/admin/events?from=${from}&to=${to}`,
  );
  const rows =
    resource.loading || resource.error || !resource.data
      ? null
      : resource.data.audit.filter(
          (r) =>
            r.targetUserId === userId &&
            ["USER_DISABLED", "USER_ENABLED"].includes(r.action),
        );
  return (
    <section aria-label="Journal des changements d’accès">
      <h2>Journal des changements d’accès</h2>
      <p>
        Actions de ce compte parmi les 50 dernières entrées globales du journal,
        sur les 30 derniers jours et la journée UTC en cours. Cet affichage
        n’est pas un historique exhaustif.
      </p>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer le journal
          </Button>
        </Alert>
      )}
      {!resource.loading && !resource.error && !rows && (
        <p>Journal non disponible.</p>
      )}
      {rows && (
        <Card>
          {rows.length === 0 ? (
            <p>Aucun changement d’accès visible dans cette fenêtre.</p>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.id}>
                  {label(r.action)} · {label(r.result)} ·{" "}
                  {dateLabel(r.createdAt)} · Auteur :{" "}
                  {r.actorId ?? "historique"} · Motif :{" "}
                  {r.reason
                    ? accessReasons[r.reason]
                    : "historique indisponible"}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
  );
}
