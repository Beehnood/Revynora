import { describe, expect, it } from "vitest";
import { diagnosticSchema } from "@revynora/validation";
import { progressiveGeneratedSchema } from "../ai/ai.schema";
import { mockQuiz } from "../ai/mock-bank";
import { DIAGNOSTIC_INSTRUCTIONS } from "../shared/domain/diagnostic-design";
describe("Objectif libre, sans niveau déclaré", () => {
  it("accepte un objectif libre sans domaine ni niveau", () => {
    expect(
      diagnosticSchema.parse({ topic: "Comprendre les bases de Python" }),
    ).toEqual({
      domain: "Apprentissage libre",
      topic: "Comprendre les bases de Python",
    });
  });
  it("ignore les niveaux historiques valides et refuse l’injection de score ou de profil", () => {
    for (const level of ["Débutant", "Intermédiaire", "Avancé"]) {
      expect(
        diagnosticSchema.parse({
          domain: "Sciences",
          topic: "Les cellules",
          level,
        }),
      ).toEqual({ domain: "Sciences", topic: "Les cellules" });
    }
    expect(diagnosticSchema.safeParse({ topic: "a" }).success).toBe(false);
    expect(
      diagnosticSchema.safeParse({ topic: "Un sujet", score: 100 }).success,
    ).toBe(false);
    expect(
      diagnosticSchema.safeParse({
        topic: "Un sujet",
        estimatedLevel: "Avancé",
      }).success,
    ).toBe(false);
  });
  it("exige une couverture de notions sans autoriser le modèle à fournir un score", () => {
    const data = mockQuiz({ domain: "Sciences", topic: "Les cellules" })!;
    expect(progressiveGeneratedSchema.safeParse(data).success).toBe(true);
    expect(
      progressiveGeneratedSchema.safeParse({ ...data, score: 100 }).success,
    ).toBe(false);
    expect(
      progressiveGeneratedSchema.safeParse({
        ...data,
        questions: data.questions.map((q) => ({
          ...q,
          concept: "Même notion",
        })),
      }).success,
    ).toBe(false);
    const blank = structuredClone(data);
    blank.questions[0].concept = "  ";
    expect(progressiveGeneratedSchema.safeParse(blank).success).toBe(false);
    expect(
      progressiveGeneratedSchema.safeParse({
        ...data,
        estimatedLevel: "Avancé",
      }).success,
    ).toBe(false);
    expect(DIAGNOSTIC_INSTRUCTIONS).toContain("questions 1 et 2");
    expect(DIAGNOSTIC_INSTRUCTIONS).toContain("questions 3 et 4");
    expect(DIAGNOSTIC_INSTRUCTIONS).toContain("question 5");
    expect(DIAGNOSTIC_INSTRUCTIONS).toContain("Ne produis aucun score");
  });
});
