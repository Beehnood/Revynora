import {
  conceptKey,
  MIXED_DIAGNOSTIC_LEVEL,
} from "../shared/domain/diagnostic-design";
export function sameOptions(selected: string[], expected: string[]) {
  return (
    selected.length === expected.length &&
    new Set(selected).size === selected.length &&
    selected.every((id) => expected.includes(id))
  );
}
export function grade(
  questions: {
    id: string;
    concept: string;
    options: { id: string; correct: boolean }[];
  }[],
  answers: { questionId: string; selectedOptionIds: string[] }[],
  options: { normalizeConcepts?: boolean } = {},
) {
  const names = new Map<string, string>();
  for (const q of options.normalizeConcepts ? questions : [])
    if (!names.has(conceptKey(q.concept)))
      names.set(conceptKey(q.concept), q.concept.trim());
  const corrected = questions.map((q) => ({
    questionId: q.id,
    concept: options.normalizeConcepts
      ? names.get(conceptKey(q.concept))!
      : q.concept,
    correct: sameOptions(
      answers.find((a) => a.questionId === q.id)?.selectedOptionIds ?? [],
      q.options.filter((o) => o.correct).map((o) => o.id),
    ),
  }));
  const weak = [
    ...new Set(corrected.filter((q) => !q.correct).map((q) => q.concept)),
  ];
  return {
    score: Math.round(
      (corrected.filter((q) => q.correct).length / questions.length) * 100,
    ),
    mastered: [
      ...new Set(
        corrected
          .filter((q) => q.correct && !weak.includes(q.concept))
          .map((q) => q.concept),
      ),
    ],
    weak,
    corrected,
  };
}

/** Preserve legacy/PDF feedback exactly; normalize only the new diagnostic design. */
export function gradeQuiz(
  quiz: {
    level: string;
    provider: string;
    questions: Parameters<typeof grade>[0];
  },
  answers: Parameters<typeof grade>[1],
) {
  return grade(quiz.questions, answers, {
    normalizeConcepts:
      quiz.level === MIXED_DIAGNOSTIC_LEVEL &&
      ["openai", "gemini"].includes(quiz.provider),
  });
}
