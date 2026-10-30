"use client";
import { dateLabel } from "@/lib/admin-presentation";
import Link from "next/link";
import type { AdminUser } from "@revynora/types";
import { Card, PageHeader, Alert, LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
import { UserAccessAction } from "./user-access-action";
import { UserAudit } from "./user-audit";
import { LearningGrantsPanel } from "../learning-grants/learning-grants-panel";
export function UserDetail({ id }: { id: string }) {
  const resource = useResource<AdminUser>(
    "/admin/users/" + encodeURIComponent(id),
  );
  const user = resource.loading || resource.error ? null : resource.data;
  return (
    <>
      <Link href="/admin/utilisateurs">Retour aux utilisateurs</Link>
      <PageHeader
        title="Fiche utilisateur"
        description="Identité et état administratif du compte."
      />
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer la fiche utilisateur
          </Button>
        </Alert>
      )}
      {!resource.loading && !resource.error && !user && (
        <p role="status">Utilisateur non disponible.</p>
      )}
      {user && (
        <>
          <Card>
            <h2>{user.name}</h2>
            <dl>
              <dt>Identifiant</dt>
              <dd>{user.id}</dd>
              <dt>E-mail</dt>
              <dd>{user.email}</dd>
              <dt>Rôle</dt>
              <dd>{user.role === "ADMIN" ? "Administrateur" : "Étudiant"}</dd>
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
            <UserAccessAction user={user} onChanged={resource.reload} />
          </Card>
          {user.role === "ADMIN" && (
            <LearningGrantsPanel user={user} onChanged={resource.reload} />
          )}
          <UserAudit userId={user.id} />
        </>
      )}
    </>
  );
}
