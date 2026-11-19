import Link from "next/link";
import type { DiagnosticAssessment } from "@revynora/types";
import { Badge, Card } from "../ui";
const priority = {
  HIGH: "Priorité",
  MEDIUM: "À consolider",
  REINFORCEMENT: "À entretenir",
};
export function AssessmentView({
  assessment,
  completedAt,
  newTestHref,
}: {
  assessment: DiagnosticAssessment;
  completedAt: string;
  newTestHref: string;
}) {
  return (
    <section aria-label="Estimation et parcours de révision">
      <Card>
        <h2>
          {assessment.level
            ? `Niveau estimé sur ce test : ${assessment.level}`
            : "Pas d’estimation de niveau"}
        </h2>
        <p>
          Bilan du{" "}
          {new Date(completedAt).toLocaleDateString("fr-FR", {
            timeZone: "Europe/Paris",
          })}
          .
        </p>
        <p>{assessment.explanation}</p>
        <ul>
          {assessment.limitations.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2>Ton parcours de révision</h2>
        <ol>
          {assessment.revisionPlan.map((step) => (
            <li key={step.concept}>
              <h3>
                {step.concept} <Badge>{priority[step.priority]}</Badge>
              </h3>
              <p>{step.reason}</p>
              <ul>
                {step.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <Link href={newTestHref} className="text-link">
          Faire un nouveau test pour réévaluer mes progrès →
        </Link>
      </Card>
    </section>
  );
}
