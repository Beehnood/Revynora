"use client";
import type { LearningAccess } from "@revynora/types";
import { useResource } from "@/lib/use-resource";
import { Card, PageHeader, Alert, LoadingState } from "../ui";
import { Button } from "../ui/button";
export function InternalLearningAccess() {
  const resource = useResource<LearningAccess>("/learning/access");
  return (
    <>
      <PageHeader
        title="Mon accès pédagogique"
        description="Compte ADMIN : droits internes distincts de l’abonnement commercial."
      />
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button onClick={resource.reload}>Réessayer mon accès</Button>
        </Alert>
      )}
      {resource.data && (
        <Card>
          <h2>
            {resource.data.source === "INTERNAL"
              ? "Accès interne · équivalent Pro"
              : "Aucune attribution interne active"}
          </h2>
          <p>
            Offre commerciale : {resource.data.commercialPlan}. L’attribution
            interne ne constitue pas un achat, un paiement ou un abonnement Pro.
          </p>
          <p>
            {resource.data.allowed
              ? "Cours personnels, diagnostics, tests et historiques disponibles. Quotas IA habituels applicables."
              : "Les fonctionnalités pédagogiques ne sont pas autorisées pour ce compte."}
          </p>
          <p>
            Leitner : {resource.data.leitner ? "disponible" : "indisponible"}.
            Planning et génération IA :{" "}
            {resource.data.planning ? "disponibles" : "indisponibles"}.
          </p>
          <p>
            Les rappels nécessitent votre consentement explicite et des droits
            actifs au moment de l’envoi.
          </p>
          {resource.data.internal && (
            <p>
              Début UTC :{" "}
              {new Date(resource.data.internal.startsAt).toLocaleDateString(
                "fr-FR",
                { timeZone: "UTC" },
              )}
              .{" "}
              {resource.data.internal.expiresAt
                ? "Expiration UTC : " +
                  new Date(resource.data.internal.expiresAt).toLocaleDateString(
                    "fr-FR",
                    { timeZone: "UTC" },
                  )
                : "Sans expiration programmée ; accès révocable."}
            </p>
          )}
        </Card>
      )}
    </>
  );
}
