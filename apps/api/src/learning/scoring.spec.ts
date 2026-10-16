import { describe, it, expect } from "vitest";
import { grade, sameOptions } from "./scoring";
describe("Correction déterministe", () => {
  it("compare les ensembles sans bonus partiel ni doublon", () => {
    expect(sameOptions(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameOptions(["a"], ["a", "b"])).toBe(false);
    expect(sameOptions(["a", "a"], ["a", "b"])).toBe(false);
    expect(sameOptions(["x"], ["a"])).toBe(false);
  });
  it("calcule score et notions depuis les options serveur", () => {
    const q = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      concept: "Notion " + i,
      options: [
        { id: `ok${i}`, correct: true },
        { id: `no${i}`, correct: false },
      ],
    }));
    const answers = q.map((q, i) => ({
      questionId: q.id,
      selectedOptionIds: [i < 3 ? `ok${i}` : `no${i}`],
    }));
    expect(grade(q, answers)).toMatchObject({
      score: 60,
      mastered: ["Notion 0", "Notion 1", "Notion 2"],
      weak: ["Notion 3", "Notion 4"],
    });
    expect(grade(q, []).score).toBe(0);
  });
  it("ne classe pas une notion à la fois maîtrisée et faible", () => {
    const questions = [
      {
        id: "q1",
        concept: "Même notion",
        options: [
          { id: "a", correct: true },
          { id: "b", correct: false },
        ],
      },
      {
        id: "q2",
        concept: "Même notion",
        options: [
          { id: "c", correct: true },
          { id: "d", correct: false },
        ],
      },
    ];
    const result = grade(questions, [
      { questionId: "q1", selectedOptionIds: ["a"] },
      { questionId: "q2", selectedOptionIds: ["d"] },
    ]);
    expect(result.weak).toEqual(["Même notion"]);
    expect(result.mastered).toEqual([]);
  });
});
