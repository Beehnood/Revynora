import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssessmentView } from "../components/learning/assessment-view";
import type { DiagnosticAssessment } from "@revynora/types";
const assessment: DiagnosticAssessment = {
  level: "Intermédiaire",
  ruleVersion: "mixed-diagnostic-v1",
  explanation:
    "3/5 réponses correctes, dont une application. Le serveur applique une grille explicite.",
  evidence: {
    score: 60,
    correct: 3,
    total: 5,
    concepts: 5,
    fullyCorrectConcepts: 3,
    application: { correct: 1, total: 2 },
    reasoning: { correct: 0, total: 1 },
  },
  limitations: [
    "Estimation pédagogique provisoire, jamais une évaluation absolue.",
    "Un nouveau test peut réviser cette estimation.",
  ],
  revisionPlan: [
    {
      concept: "Fractions",
      priority: "HIGH",
      reason: "0 réponse correcte sur 1 pour cette notion.",
      actions: [
        "Relire la correction et reformuler la notion.",
        "Résoudre un exercice sans aide.",
      ],
    },
  ],
};
describe("Bilan pédagogique fourni par le serveur", () => {
  it("affiche le niveau reçu, ses raisons, ses limites et les étapes de révision", () => {
    render(
      <AssessmentView
        assessment={assessment}
        completedAt="2026-11-18T10:00:00Z"
        newTestHref="/app/diagnostic"
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "Niveau estimé sur ce test : Intermédiaire",
      }),
    ).toBeVisible();
    expect(screen.getByText(assessment.explanation)).toBeVisible();
    expect(screen.getByText(/jamais une évaluation absolue/)).toBeVisible();
    expect(screen.getByText("Fractions", { exact: false })).toBeVisible();
    expect(screen.getByText("Résoudre un exercice sans aide.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /réévaluer mes progrès/ }),
    ).toHaveAttribute("href", "/app/diagnostic");
  });
  it("n’invente pas de niveau lorsqu’aucune estimation n’est disponible", () => {
    render(
      <AssessmentView
        assessment={{
          ...assessment,
          level: null,
          ruleVersion: null,
          explanation: "Exercice de démonstration, sans estimation.",
        }}
        completedAt="2026-11-18T10:00:00Z"
        newTestHref="/app/cours"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Pas d’estimation de niveau" }),
    ).toBeVisible();
    expect(
      screen.queryByText(/Niveau estimé sur ce test :/),
    ).not.toBeInTheDocument();
  });
});
