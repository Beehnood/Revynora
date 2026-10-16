"use client";
import { PrivacyControls } from "../saas/privacy-controls";
import { useStudent } from "./student-shell";
import { Badge, Card, PageHeader } from "../ui";
export function ProfileView() {
  const user = useStudent();
  return (
    <>
      <PageHeader
        title="Mon profil étudiant"
        description="Un espace privé pour apprendre."
      />
      <Card>
        <div className="card-heading">
          <h2>{user.name}</h2>
          <Badge>{user.plan} · Actif</Badge>
        </div>
        <dl className="profile-details">
          <dt>Adresse e-mail</dt>
          <dd>{user.email}</dd>
          <dt>Rôle</dt>
          <dd>Étudiant</dd>
          <dt>Compte créé le</dt>
          <dd>
            {new Date(user.createdAt).toLocaleDateString("fr-FR", {
              timeZone: "Europe/Paris",
            })}
          </dd>
        </dl>
      </Card>
      <PrivacyControls />
    </>
  );
}
