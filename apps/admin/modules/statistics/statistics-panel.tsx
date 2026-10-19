"use client";
import type { AdminStatistics } from "@revynora/types";
import { Card, Alert, LoadingState } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
export function formatCents(value: string, currency: string) {
  const cents = BigInt(value);
  if (currency.toLowerCase() !== "eur")
    return cents.toString() + " unités stockées (échelle non vérifiée)";
  const abs = cents < 0n ? -cents : cents;
  return (
    (cents < 0n ? "−" : "") +
    (abs / 100n).toString() +
    "," +
    (abs % 100n).toString().padStart(2, "0")
  );
}
export function StatisticsPanel({ from, to }: { from: string; to: string }) {
  const resource = useResource<AdminStatistics>(
    "/admin/statistics?from=" +
      encodeURIComponent(from) +
      "&to=" +
      encodeURIComponent(to),
  );
  const data = resource.data;
  const max = Math.max(1, ...(data?.registrations.map((d) => d.count) ?? []));
  const total =
    data?.registrations.reduce((sum, row) => sum + row.count, 0) ?? 0;
  return (
    <section aria-labelledby="statistics-title">
      <h2 id="statistics-title">Statistiques de la période</h2>
      <p>
        Du {from} au {to} exclu · journées UTC. Les périodes d’abonnement sont
        comptées à leur date de début ; elles ne représentent pas des abonnés
        uniques.
      </p>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer les statistiques
          </Button>
        </Alert>
      )}
      {data && (
        <>
          <Card>
            <h3>Évolution des inscriptions</h3>
            <p>
              {total} inscriptions sur la période. Les comptes supprimés ne sont
              plus comptés.
            </p>
            {total === 0 ? (
              <p role="status">Aucune inscription sur cette période.</p>
            ) : (
              <figure>
                <svg
                  className="admin-registration-chart"
                  viewBox={`0 0 ${data.registrations.length * 8} 120`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-labelledby="registration-chart-title"
                  aria-describedby="registration-chart-desc"
                >
                  <title id="registration-chart-title">
                    Inscriptions quotidiennes
                  </title>
                  <desc id="registration-chart-desc">
                    Du {from} au {to} exclu, {total} inscriptions. Maximum :{" "}
                    {max} par jour. Valeurs exactes dans le tableau suivant.
                  </desc>
                  {data.registrations.map((row, i) => (
                    <rect
                      key={row.date}
                      x={i * 8 + 1}
                      y={110 - (row.count / max) * 100}
                      width={6}
                      height={(row.count / max) * 100}
                      fill="currentColor"
                    >
                      <title>
                        {row.date} : {row.count}
                      </title>
                    </rect>
                  ))}
                </svg>
                <figcaption>
                  Nombre de comptes créés par jour UTC · du {from} au {to}{" "}
                  exclu.
                </figcaption>
              </figure>
            )}
            <details>
              <summary>Tableau des inscriptions quotidiennes</summary>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Inscriptions quotidiennes — tableau défilant"
              >
                <table className="admin-table">
                  <caption>Inscriptions par date UTC</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date UTC</th>
                      <th scope="col">Inscriptions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.registrations.map((row) => (
                      <tr key={row.date}>
                        <th scope="row">{row.date}</th>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
          <Card>
            <h3>Périodes d’abonnement par offre et statut</h3>
            {data.subscriptions.length === 0 ? (
              <p>Aucune période d’abonnement commencée sur cet intervalle.</p>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Périodes d’abonnement — tableau défilant"
              >
                <table className="admin-table">
                  <caption>
                    Périodes commencées dans l’intervalle, statut enregistré au
                    moment de la lecture
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Offre</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Périodes</th>
                      <th scope="col">Volume relatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.map((row) => (
                      <tr key={row.offer + row.status}>
                        <th scope="row">{row.offer}</th>
                        <td>{row.status}</td>
                        <td>{row.periods}</td>
                        <td>
                          <meter
                            aria-label={`${row.offer} ${row.status}`}
                            min={0}
                            max={Math.max(
                              1,
                              ...data.subscriptions.map((s) => s.periods),
                            )}
                            value={row.periods}
                          >
                            {row.periods}
                          </meter>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <h3>Consommation IA</h3>
            <p>
              Estimations en USD, pas des dépenses facturées. Dépenses
              effectivement facturées : non disponibles. Les requêtes simulées
              et les différents statuts restent séparés.
            </p>
            {data.ai.length === 0 ? (
              <p>Aucune requête IA enregistrée sur cette période.</p>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Consommation IA — tableau défilant"
              >
                <table className="admin-table">
                  <caption>
                    Usage IA par fournisseur et statut, à la date de création de
                    la requête
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Fournisseur</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Requêtes</th>
                      <th scope="col">Tokens entrée</th>
                      <th scope="col">Tokens sortie</th>
                      <th scope="col">Coût estimé USD</th>
                      <th scope="col">Requêtes avec estimation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ai.map((row) => (
                      <tr key={row.provider + row.status}>
                        <th scope="row">
                          {row.provider === "mock"
                            ? "Simulation"
                            : row.provider}
                        </th>
                        <td>{row.status}</td>
                        <td>{row.requests}</td>
                        <td>{row.inputTokens}</td>
                        <td>{row.outputTokens}</td>
                        <td>{row.estimatedCostUsd ?? "Non disponible"}</td>
                        <td>
                          {row.estimatedRequests} / {row.requests}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <h3>Paiements enregistrés</h3>
            <p>
              Montants distincts par fournisseur, devise et statut. Seul l’EUR
              est affiché en centimes convertis ; les autres devises gardent
              leur valeur stockée, sans conversion présumée. Aucun total de
              revenus réels n’est calculé. Le modèle ne conserve pas
              l’environnement Stripe test/live ; la configuration actuelle ne
              prouve pas celui d’un ancien paiement.
            </p>
            {data.payments.length === 0 ? (
              <p>Aucun paiement.</p>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Paiements enregistrés — tableau défilant"
              >
                <table className="admin-table">
                  <caption>
                    Paiements créés sur la période ; montants bruts par statut,
                    sans calcul de revenu net
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Fournisseur</th>
                      <th scope="col">Environnement</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((row) => (
                      <tr
                        key={JSON.stringify([
                          row.provider,
                          row.currency,
                          row.status,
                        ])}
                      >
                        <th scope="row">{row.provider}</th>
                        <td>
                          {row.environment === "SIMULATION"
                            ? "Simulation — aucun débit réel"
                            : "Non vérifiable (test/réel)"}
                        </td>
                        <td>{row.status}</td>
                        <td>{row.count}</td>
                        <td>
                          {formatCents(row.amountCents, row.currency)}{" "}
                          {row.currency.toUpperCase()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
