import { describe, expect, it } from "vitest";
import { assessDiagnostic } from "./diagnostic-assessment";
import { MIXED_DIAGNOSTIC_LEVEL } from "../shared/domain/diagnostic-design";
const questions = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i}`,
  position: i,
  type: "SINGLE" as const,
  concept: `Notion ${i}`,
  options: [
    { id: `yes${i}`, correct: true },
    { id: `no${i}`, correct: false },
  ],
}));
const quiz = { level: MIXED_DIAGNOSTIC_LEVEL, provider: "gemini", questions };
const answers = (correct: number[]) =>
  questions.map((q, i) => ({
    questionId: q.id,
    selectedOptionIds: [correct.includes(i) ? `yes${i}` : `no${i}`],
  }));
describe("Estimation pédagogique déterministe, limitée à une tentative", () => {
  it("exige une réussite d’application et de raisonnement, pas seulement un score élevé", () => {
    const highWithoutReasoning = assessDiagnostic(quiz, answers([0, 1, 2, 3]));
    expect(highWithoutReasoning.evidence.score).toBe(80);
    expect(highWithoutReasoning.level).toBe("Intermédiaire");
    expect(assessDiagnostic(quiz, answers([0, 2, 3, 4])).level).toBe("Avancé");
    expect(assessDiagnostic(quiz, answers([0, 1, 2])).level).toBe(
      "Intermédiaire",
    );
    expect(assessDiagnostic(quiz, answers([0, 1, 4])).level).toBe("Débutant");
  });
  it.each(Array.from({ length: 32 }, (_, i) => i))(
    "explique les cinq réponses du profil %s sans score IA",
    (bits) => {
      const correct = questions
        .map((_, i) => i)
        .filter((i) => (bits & (1 << i)) !== 0);
      const value = assessDiagnostic(quiz, answers(correct));
      const advanced = [29, 30, 31];
      const intermediate = [7, 11, 13, 14, 15, 21, 22, 23, 25, 26, 27, 28];
      expect(value.level).toBe(
        advanced.includes(bits)
          ? "Avancé"
          : intermediate.includes(bits)
            ? "Intermédiaire"
            : "Débutant",
      );
      expect(value.evidence.score).toBe(correct.length * 20);
      expect(value.evidence.correct).toBe(correct.length);
      expect(value.evidence.application?.correct).toBe(
        correct.filter((i) => i === 2 || i === 3).length,
      );
      expect(value.explanation).toContain(`${correct.length}/5`);
      expect(value.revisionPlan[0].priority).toBe(
        correct.length === 5 ? "REINFORCEMENT" : "HIGH",
      );
      expect(value.limitations.join(" ")).toContain("jamais une note scolaire");
    },
  );
  it("révise l’estimation d’un nouveau test sans réécrire la tentative précédente", () => {
    const firstAnswers = answers([]);
    const first = assessDiagnostic(quiz, firstAnswers);
    const before = structuredClone(first);
    const later = assessDiagnostic(quiz, answers([0, 1, 2, 3, 4]));
    expect(first.level).toBe("Débutant");
    expect(later.level).toBe("Avancé");
    expect(first).toEqual(before);
    expect(firstAnswers).toEqual(answers([]));
  });
  it.each(["mock", "fixture"])(
    "ne présente pas une démonstration %s comme une mesure du niveau",
    (provider) => {
      const value = assessDiagnostic(
        { ...quiz, provider },
        answers([0, 1, 2, 3, 4]),
      );
      expect(value.level).toBeNull();
      expect(value.ruleVersion).toBeNull();
    },
  );
  it.each(["Débutant", "Intermédiaire", "Avancé", "Diagnostic PDF"])(
    "ne réinterprète pas le questionnaire historique %s",
    (level) => {
      expect(
        assessDiagnostic({ ...quiz, level }, answers([0, 1, 2, 3, 4])).level,
      ).toBeNull();
    },
  );
  it("refuse une estimation sur un test incomplet, des options étrangères ou des positions non standard", () => {
    expect(assessDiagnostic(quiz, []).level).toBeNull();
    const foreign = answers([0, 1, 2, 3, 4]);
    foreign[0].selectedOptionIds = ["forged"];
    expect(assessDiagnostic(quiz, foreign).level).toBeNull();
    expect(
      assessDiagnostic(
        {
          ...quiz,
          questions: questions.map((q) => ({ ...q, position: q.position + 1 })),
        },
        answers([0, 1, 2, 3, 4]),
      ).level,
    ).toBeNull();
  });
  it("regroupe les notions équivalentes et priorise les difficultés réellement observées", () => {
    const repeated = questions.map((q, i) => ({
      ...q,
      concept: i < 2 ? (i ? " MEMBRANE " : "Membrane") : q.concept,
    }));
    const value = assessDiagnostic(
      { ...quiz, questions: repeated },
      answers([0, 2, 3, 4]),
    );
    expect(value.evidence.concepts).toBe(4);
    expect(value.revisionPlan[0]).toMatchObject({
      concept: "Membrane",
      priority: "HIGH",
      reason: "1 réponse correcte sur 2 pour cette notion.",
    });
    expect(
      value.revisionPlan.filter((s) => s.concept === "Membrane"),
    ).toHaveLength(1);
  });
});
