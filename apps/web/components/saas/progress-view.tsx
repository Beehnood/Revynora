"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ProgressSummary } from "@revynora/types";
import { useResource } from "@/lib/use-resource";
import {
  Card,
  PageHeader,
  Alert,
  LoadingState,
  Badge,
  FormField,
  Select,
} from "../ui";
import { Button } from "../ui/button";
export function ProgressView() {
  const progress = useResource<ProgressSummary>("/progress");
  const [period, setPeriod] = useState("weekly");
  const data = progress.data;
  return (
    <>
      <PageHeader
        title="Ma progression"
        description="Tes efforts prennent forme. Retrouve tes résultats et ton activité réelle."
      />
      {progress.loading && <LoadingState />}
      {progress.error && (
        <Alert role="alert">
          {progress.error}{" "}
          <Button variant="outline" onClick={progress.reload}>
            Réessayer
          </Button>
        </Alert>
      )}
      {data && (
        <>
          {!data.completedQuizzes && !data.totalReviews && (
            <Card>
              <h2>Ton parcours commence ici</h2>
              <p>
                Termine un diagnostic pour découvrir tes premiers résultats.
              </p>
              <Link href="/app/diagnostic">Commencer un diagnostic</Link>
            </Card>
          )}
          <div className="progress-kpis">
            <Card>
              <Badge>Apprendre</Badge>
              <h2>{data.completedQuizzes}</h2>
              <p>QCM terminés</p>
            </Card>
            <Card>
              <Badge>Résultats</Badge>
              <h2>
                {data.averageScore === null ? "—" : data.averageScore + " %"}
              </h2>
              <p>Score moyen aux QCM</p>
            </Card>
            <Card>
              <Badge>Mémoriser</Badge>
              <h2>{data.totalReviews}</h2>
              <p>Révisions Leitner réalisées</p>
            </Card>
            <Card>
              <Badge>Régularité</Badge>
              <h2>
                {data.successRate === null ? "—" : data.successRate + " %"}
              </h2>
              <p>Cartes retenues lors des révisions</p>
            </Card>
          </div>
          <Card>
            <h2>Temps de révision</h2>
            <p>
              {Math.round(data.revisionSeconds / 60)} min déclarées sur{" "}
              {data.timedReviews} révisions chronométrées. Les anciennes durées
              inconnues ne sont pas estimées.
            </p>
          </Card>
          <div className="progress-charts">
            <Card>
              <h2>Évolution des scores</h2>
              <p>
                Les 100 derniers QCM terminés, du plus ancien au plus récent.
              </p>
              {!data.scores.length ? (
                <p>Aucun QCM terminé.</p>
              ) : (
                <>
                  <div className="progress-chart" aria-hidden="true">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.scores} accessibilityLayer={false}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) =>
                            new Date(d).toLocaleDateString("fr-FR")
                          }
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line
                          type="linear"
                          dataKey="score"
                          name="Score (%)"
                          stroke="var(--primary)"
                          strokeWidth={3}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <details>
                    <summary>Consulter les scores en tableau</summary>
                    <div className="progress-table">
                      <table>
                        <caption>Historique des scores</caption>
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Matière</th>
                            <th scope="col">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.scores.map((s, i) => (
                            <tr key={i}>
                              <td>
                                {new Date(s.date).toLocaleString("fr-FR")}
                              </td>
                              <td>{s.subject}</td>
                              <td>{s.score} %</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </Card>
            <Card>
              <h2>Activité de révision</h2>
              <FormField id="progress-period" label="Période d’activité">
                <Select
                  id="progress-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="weekly">7 derniers jours</option>
                  <option value="monthly">30 derniers jours</option>
                </Select>
              </FormField>
              <p>
                Jours calendaires UTC. Les tâches prévues ne comptent pas comme
                des révisions.
              </p>
              <div className="progress-chart" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={period === "weekly" ? data.weekly : data.monthly}
                    accessibilityLayer={false}
                  >
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      name="Révisions"
                      dataKey="reviews"
                      fill="var(--primary)"
                      isAnimationActive={false}
                    />
                    <Bar
                      name="QCM"
                      dataKey="quizzes"
                      fill="#087e76"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details>
                <summary>Consulter l’activité en tableau</summary>
                <div className="progress-table">
                  <table>
                    <caption>Activité par jour</caption>
                    <thead>
                      <tr>
                        <th scope="col">Jour UTC</th>
                        <th scope="col">Révisions</th>
                        <th scope="col">QCM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(period === "weekly" ? data.weekly : data.monthly).map(
                        (d) => (
                          <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{d.reviews}</td>
                            <td>{d.quizzes}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>
          </div>
          <Card>
            <h2>Mes cinq boîtes Leitner</h2>
            <div className="leitner-boxes">
              {data.boxes.map((b) => (
                <div key={b.box}>
                  <Badge>Boîte {b.box}</Badge>
                  <strong>{b.count}</strong>
                  <span>cartes actives</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2>Progression par matière</h2>
            {data.subjects.length === 0 ? (
              <p>
                Les matières apparaîtront après un premier diagnostic terminé.
              </p>
            ) : (
              data.subjects.map((s) => (
                <div className="saas-row" key={s.subject}>
                  <div>
                    <h3>{s.subject}</h3>
                    <p>
                      {s.quizzes} QCM · moyenne{" "}
                      {s.averageScore === null ? "—" : s.averageScore + " %"} ·
                      dernier score{" "}
                      {s.latestScore === null ? "—" : s.latestScore + " %"} ·{" "}
                      {s.reviews} révisions associées
                    </p>
                    <progress
                      aria-label={"Score moyen en " + s.subject}
                      value={s.averageScore ?? undefined}
                      max={100}
                    />
                  </div>
                </div>
              ))
            )}
          </Card>
          <Card>
            <h2>Historique d’activité</h2>
            {data.activity.length === 0 ? (
              <p>Aucune activité enregistrée.</p>
            ) : (
              <ul className="progress-activity">
                {data.activity.map((a) => (
                  <li key={a.kind + a.id}>
                    <Badge>
                      {a.kind === "QUIZ" ? "Diagnostic" : "Révision"}
                    </Badge>{" "}
                    {a.title} ·{" "}
                    <time dateTime={a.date}>
                      {new Date(a.date).toLocaleString("fr-FR")}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
