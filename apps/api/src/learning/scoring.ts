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
) {
  const corrected = questions.map((q) => ({
    questionId: q.id,
    concept: q.concept,
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
