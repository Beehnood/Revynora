import type { DiagnosticAssessment } from "@revynora/types";
import {
  conceptKey,
  DIAGNOSTIC_DEMANDS,
  MIXED_DIAGNOSTIC_LEVEL,
} from "../shared/domain/diagnostic-design";
import { gradeQuiz } from "./scoring";
type Question = {
  id: string;
  position: number;
  type: "SINGLE" | "MULTIPLE";
  concept: string;
  options: { id: string; correct: boolean }[];
};
/** No model output, client score or self-declared level enters this calculation. */
export function assessDiagnostic(
  quiz: { level: string; provider: string; questions: Question[] },
  answers: { questionId: string; selectedOptionIds: string[] }[],
): DiagnosticAssessment {
  const questions = [...quiz.questions].sort((a, b) => a.position - b.position);
  const result = gradeQuiz({ ...quiz, questions }, answers);
  const groups = new Map<
    string,
    {
      concept: string;
      correct: number;
      total: number;
      foundationMissed: boolean;
    }
  >();
  questions.forEach((q, index) => {
    const key = conceptKey(q.concept);
    const group = groups.get(key) ?? {
      concept: q.concept.trim(),
      correct: 0,
      total: 0,
      foundationMissed: false,
    };
    group.total++;
    if (result.corrected[index].correct) group.correct++;
    else if (DIAGNOSTIC_DEMANDS[index] === "FOUNDATION")
      group.foundationMissed = true;
    groups.set(key, group);
  });
  const complete =
    answers.length === questions.length &&
    new Set(answers.map((a) => a.questionId)).size === questions.length &&
    questions.every((q) => {
      const selected =
        answers.find((a) => a.questionId === q.id)?.selectedOptionIds ?? [];
      return (
        selected.length > 0 &&
        (q.type !== "SINGLE" || selected.length === 1) &&
        new Set(selected).size === selected.length &&
        selected.every((id) => q.options.some((o) => o.id === id))
      );
    });
  const standard =
    complete &&
    quiz.level === MIXED_DIAGNOSTIC_LEVEL &&
    ["openai", "gemini"].includes(quiz.provider) &&
    questions.length === 5 &&
    questions.every(
      (q, i) => q.position === i && conceptKey(q.concept).length >= 2,
    ) &&
    groups.size >= 3;
  const counted = (demand: "APPLICATION" | "REASONING") => ({
    correct: result.corrected.filter(
      (q, i) => DIAGNOSTIC_DEMANDS[i] === demand && q.correct,
    ).length,
    total: DIAGNOSTIC_DEMANDS.filter((d) => d === demand).length,
  });
  const mastered = [...groups.values()].filter(
    (g) => g.correct === g.total,
  ).length;
  const application = standard ? counted("APPLICATION") : null;
  const reasoning = standard ? counted("REASONING") : null;
  let level: DiagnosticAssessment["level"] = null;
  if (application && reasoning) {
    level =
      result.score >= 80 &&
      application.correct === 2 &&
      reasoning.correct === 1 &&
      mastered >= 3
        ? "Avancé"
        : result.score >= 60 && application.correct >= 1 && mastered >= 2
          ? "Intermédiaire"
          : "Débutant";
  }
  const explanation = !complete
    ? "Les réponses sont incomplètes ou incohérentes : aucun niveau personnel n’est estimé."
    : level
      ? `${result.corrected.filter((q) => q.correct).length}/5 réponses correctes (${result.score} %), ${mastered}/${groups.size} notions entièrement réussies, ${application!.correct}/2 applications et ${reasoning!.correct}/1 raisonnement réussis. ` +
        "Grille : Avancé = au moins 80 %, les deux applications, le raisonnement et trois notions entièrement réussies ; Intermédiaire = au moins 60 %, une application et deux notions entièrement réussies ; sinon Débutant."
      : quiz.provider === "mock"
        ? "Exercice prédéfini de démonstration : la correction est disponible, mais aucun niveau personnel n’est estimé."
        : "Ce questionnaire ne possède pas la grille de difficultés et la couverture de notions requises : aucun niveau personnel n’est estimé.";
  const revisionPlan = [...groups.values()]
    .sort(
      (a, b) =>
        Number(b.correct < b.total) - Number(a.correct < a.total) ||
        Number(b.correct === 0 || (standard && b.foundationMissed)) -
          Number(a.correct === 0 || (standard && a.foundationMissed)) ||
        Number(standard && b.foundationMissed) -
          Number(standard && a.foundationMissed) ||
        b.total - b.correct - (a.total - a.correct) ||
        conceptKey(a.concept).localeCompare(conceptKey(b.concept), "fr"),
    )
    .map((g) => ({
      concept: g.concept,
      priority:
        g.correct === g.total
          ? ("REINFORCEMENT" as const)
          : g.correct === 0 || (standard && g.foundationMissed)
            ? ("HIGH" as const)
            : ("MEDIUM" as const),
      reason: `${g.correct} réponse${g.correct > 1 ? "s" : ""} correcte${g.correct > 1 ? "s" : ""} sur ${g.total} pour cette notion.`,
      actions:
        g.correct === g.total
          ? [
              "Réactiver cette notion lors d’une prochaine séance.",
              "Vérifier sa compréhension avec une nouvelle situation ou un nouveau test.",
            ]
          : [
              "Relire la correction et reformuler la notion avec ses propres mots.",
              "Reprendre un exemple guidé, puis résoudre un exercice sans aide.",
              "Vérifier les progrès lors d’un nouveau diagnostic.",
            ],
    }));
  return {
    level,
    ruleVersion: standard ? "mixed-diagnostic-v1" : null,
    explanation,
    evidence: {
      score: result.score,
      correct: result.corrected.filter((q) => q.correct).length,
      total: questions.length,
      concepts: groups.size,
      fullyCorrectConcepts: mastered,
      application,
      reasoning,
    },
    limitations: [
      "Estimation pédagogique provisoire limitée aux notions et aux questions de cette tentative, jamais une note scolaire ni une évaluation absolue.",
      standard
        ? "La difficulté est prévue par les consignes du questionnaire et n’est pas étalonnée : les questions et leurs corrections peuvent comporter des erreurs."
        : "Le bilan reflète les réponses à ce questionnaire, sans mesure étalonnée du niveau.",
      "Un nouveau test avec de nouvelles questions peut réviser cette estimation ; les tentatives précédentes restent dans l’historique.",
    ],
    revisionPlan,
  };
}
