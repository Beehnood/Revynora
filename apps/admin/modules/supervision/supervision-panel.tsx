"use client";
import type { AdminSupervision } from "@revynora/types";
import { Card, Alert, LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
const names = {
  REVIEWS: "Révisions Leitner enregistrées",
  PLANS: "Plans créés",
  ITEMS: "Éléments de planning créés",
  REMINDERS: "Rappels avec élément existant",
} as const;
const statuses: Record<string, string> = {
  RECORDED: "Enregistrées",
  CREATED: "Créés",
  PLANNED: "Planifiés",
  DONE: "Terminés (statut déclaré)",
  CANCELLED: "Annulés",
  PENDING: "En attente",
  SENT: "Envoi enregistré (local ou distant)",
  OTHER: "Autre statut",
};
export function SupervisionPanel({ from, to }: { from: string; to: string }) {
  const resource = useResource<AdminSupervision>(
    "/admin/supervision?from=" +
      encodeURIComponent(from) +
      "&to=" +
      encodeURIComponent(to),
  );
  return (
    <section aria-labelledby="supervision-title">
      <h2 id="supervision-title">Supervision Leitner et planning</h2>
      <p>
        Activité enregistrée sur la période sélectionnée · comptages globaux
        uniquement.
      </p>
      <details className="admin-explanation">
        <summary>Définition et limites des indicateurs</summary>
        <p>
          Révisions, plans et éléments : date de création. Rappels : date
          d’échéance, statuts actuels et versions distinctes. Un envoi
          enregistré ne prouve pas une livraison réelle. Aucun contenu
          pédagogique individuel n’est affiché.
        </p>
      </details>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer la supervision
          </Button>
        </Alert>
      )}
      {resource.data && (
        <Card>
          {resource.data.rows.every((row) => row.count === 0) && (
            <p>Aucune activité de supervision sur cette période.</p>
          )}
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Supervision agrégée — tableau défilant"
          >
            <table className="admin-table">
              <caption>
                Comptages conservés en base · statuts au moment de la lecture
              </caption>
              <thead>
                <tr>
                  <th scope="col">Indicateur</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Nombre</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.rows.map((row) => (
                  <tr key={row.category + row.status}>
                    <th scope="row">{names[row.category]}</th>
                    <td>{statuses[row.status] ?? "Autre statut"}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Les suppressions peuvent diminuer ces comptes. Les statuts ne
            reconstituent pas leur historique ; ils ne mesurent ni apprentissage
            réussi, ni temps étudié, ni fiabilité du worker. Une catégorie
            absente n’a aucune ligne enregistrée dans l’intervalle.
          </p>
        </Card>
      )}
    </section>
  );
}
