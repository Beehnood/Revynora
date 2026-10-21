"use client";
import { useState } from "react";
import { dateLabel } from "@/lib/presentation";
import Link from "next/link";
import type { AdminUser } from "@revynora/types";
import { Card, PageHeader, Alert, LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
import { api, message } from "@/lib/api";
import { AccessConfirmation } from "./access-confirmation";
export function UserDetail({ id }: { id: string }) {
  const resource = useResource<AdminUser>(
    "/admin/users/" + encodeURIComponent(id),
  );
  const [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const user = resource.data;
  return (
    <>
      <Link href="/utilisateurs">Retour aux utilisateurs</Link>
      <PageHeader
        title="Fiche utilisateur"
        description="Identité et état administratif du compte."
      />
      {resource.loading && <LoadingState />}
      {(resource.error || error) && (
        <Alert role="alert">
          {resource.error || error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer
          </Button>
        </Alert>
      )}
      {success && <p role="status">{success}</p>}
      {!resource.loading && !resource.error && user && (
        <Card>
          <h2>{user.name}</h2>
          <dl>
            <dt>Identifiant</dt>
            <dd>{user.id}</dd>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Rôle</dt>
            <dd>{user.role}</dd>
            <dt>Inscription</dt>
            <dd>{dateLabel(user.createdAt)}</dd>
            <dt>État</dt>
            <dd>{user.disabledAt ? "Suspendu" : "Actif"}</dd>
            {user.disabledAt && (
              <>
                <dt>Suspension</dt>
                <dd>{dateLabel(user.disabledAt)}</dd>
              </>
            )}
          </dl>
          {user.role !== "ADMIN" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPending(true);
                setSuccess("");
                setError("");
              }}
            >
              {user.disabledAt ? "Réactiver" : "Suspendre"}
            </Button>
          )}
          {pending && (
            <AccessConfirmation
              name={user.name}
              disabled={!user.disabledAt}
              busy={busy}
              onCancel={() => setPending(false)}
              onConfirm={async (command) => {
                setBusy(true);
                setError("");
                try {
                  await api("/admin/users/" + encodeURIComponent(id), {
                    method: "PATCH",
                    body: JSON.stringify(command),
                  });
                  setPending(false);
                  setSuccess("Modification de l’accès enregistrée.");
                  resource.reload();
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </Card>
      )}
    </>
  );
}
