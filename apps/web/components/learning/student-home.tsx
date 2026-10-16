"use client";
import Link from "next/link";
import type { LearningSummary } from "@revynora/types";
import { useResource } from "@/lib/use-resource";
import { useStudent } from "./student-shell";
import { ResourceState } from "./resource-state";
import { HistoryList } from "./history-list";
import { Badge, Card, EmptyState, PageHeader } from "../ui";
import { Button } from "../ui/button";
import {
  ArrowRight,
  ChartColumn,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
} from "../icons";
export function StudentHome() {
  const user = useStudent();
  const state = useResource<LearningSummary>("/learning/summary");
  const data = state.data;
  return (
    <>
      <div className="heading-action">
        <PageHeader
          title={`Bonjour ${user.name} 👋`}
          description="Un test, un déclic, un pas de plus dans ton apprentissage."
        />
        <Button asChild>
          <Link href="/app/diagnostic">
            Nouveau diagnostic <ArrowRight size={17} />
          </Link>
        </Button>
      </div>
      <ResourceState {...state} retry={state.reload} />
      {data && (
        <>
          <div className="stats-grid">
            {[
              {
                label: "Tests terminés",
                value: data.completed,
                icon: ClipboardCheck,
                tone: "blue",
                note: "Tes diagnostics sauvegardés",
              },
              {
                label: "Dernier score",
                value: data.lastScore === null ? "—" : `${data.lastScore} %`,
                icon: ChartColumn,
                tone: "green",
                note: "Un repère pour progresser",
              },
              {
                label: "Moyenne récente",
                value: data.average === null ? "—" : `${data.average} %`,
                icon: GraduationCap,
                tone: "purple",
                note: "Sur tes 10 derniers tests au maximum",
              },
            ].map((s) => (
              <Card className="stat-card" key={s.label}>
                <span className={`icon-tile ${s.tone}`}>
                  <s.icon />
                </span>
                <div>
                  <p>{s.label}</p>
                  <strong>{s.value}</strong>
                  <small>{s.note}</small>
                </div>
              </Card>
            ))}
          </div>
          <div className="dashboard-grid">
            <Card>
              <div className="card-heading">
                <h2>Mes derniers tests</h2>
                <Link className="text-link" href="/app/historique">
                  Tout voir →
                </Link>
              </div>
              <HistoryList items={data.recent} />
            </Card>
            <Card className="daily-card">
              <span className="icon-tile purple">
                <Sparkles />
              </span>
              <span className="eyebrow">UN APPRENTISSAGE QUI TE RESSEMBLE</span>
              <h2>Commence par ce que tu sais déjà.</h2>
              <p>
                Cinq questions pour faire le point, une correction pour
                comprendre et un mini-cours pour continuer.
              </p>
              <Button asChild>
                <Link href="/app/diagnostic">Tester mes connaissances</Link>
              </Button>
            </Card>
            <Card>
              <div className="card-heading">
                <h2>Les notions à approfondir</h2>
                <Badge>Dernier test</Badge>
              </div>
              {data.weak.length ? (
                <div className="concept-list">
                  {data.weak.map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={
                    data.completed
                      ? "Un beau point de départ !"
                      : "Apprends à mieux te connaître"
                  }
                >
                  {data.completed
                    ? "Aucune notion faible sur ton dernier test. Un nouveau sujet t’attend."
                    : "Les notions à revoir apparaîtront après ton premier diagnostic."}
                </EmptyState>
              )}
            </Card>
            <Card>
              <div className="card-heading">
                <h2>Ton espace FREE</h2>
                <Badge>Actif</Badge>
              </div>
              <p className="card-copy">
                Tes diagnostics, tes corrections et tes cours sont regroupés
                dans un espace privé. Le planning et les révisions Leitner
                arriveront dans une phase ultérieure.
              </p>
              <Link className="text-link" href="/app/cours">
                Retrouver mes cours →
              </Link>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
