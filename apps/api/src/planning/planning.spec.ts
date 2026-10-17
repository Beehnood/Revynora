import { describe, it, expect, vi } from "vitest";
import { planningAiOutputSchema, patchTaskSchema } from "@revynora/validation";
import {
  validateProposalTasks,
  type PlanningContext,
} from "./domain/intelligent-planning";
import { MockPlanningGenerator } from "./infrastructure/planning.generator";
import { localInstant } from "./infrastructure/prisma-plan.repository";
import { IntelligentPlanning } from "./application/intelligent-planning.use-cases";
import type { GetEntitlements } from "../billing/application/billing.use-cases";
import type { PlanRepository } from "./domain/planning";
import { summarizeProgress } from "../progress/domain/progress";
const courseId = "12345678-1234-4234-8234-123456789012";
const context: PlanningContext = {
  now: "2027-01-01T00:00:00Z",
  timeZone: "UTC",
  courses: [
    {
      id: courseId,
      title: "Fractions",
      subject: "Maths",
      weak: ["Division"],
      due: ["2026-12-01"],
      averageScore: 20,
      exam: "2027-01-04T00:00:00Z",
    },
  ],
  slots: [
    {
      localStart: "2027-01-02T10:00",
      startsAt: "2027-01-02T10:00:00Z",
      endsAt: "2027-01-02T12:00:00Z",
    },
  ],
};
describe("Planning et statistiques Phase 3", () => {
  it("préserve tous les champs omis dans un PATCH", () => {
    expect(patchTaskSchema.parse({ version: 0, title: "Nouveau" })).toEqual({
      version: 0,
      title: "Nouveau",
      resolveConflicts: false,
    });
  });
  it("le générateur local utilise les lacunes, le score, les cartes et les créneaux", async () => {
    const output = planningAiOutputSchema.parse(
      await new MockPlanningGenerator().generate("user", context),
    );
    expect(output.tasks[0]).toMatchObject({
      courseId,
      priority: 3,
      localStart: "2027-01-02T10:00",
    });
    expect(output.tasks[0]!.title).toContain("Division");
    expect(() =>
      validateProposalTasks(output.tasks, context, localInstant),
    ).not.toThrow();
    await expect(
      new MockPlanningGenerator().generate("user", { ...context, slots: [] }),
    ).rejects.toThrow();
  });
  it("rejette sorties forgées, cours étrangers, chevauchements et après examen", () => {
    expect(
      planningAiOutputSchema.safeParse({
        title: "Bad",
        rationale: "Reason",
        tasks: [],
        sql: "DROP",
      }).success,
    ).toBe(false);
    const valid = {
      courseId,
      localStart: "2027-01-02T10:00",
      durationMinutes: 45,
    };
    for (const tasks of [
      [{ ...valid, courseId: "other" }],
      [{ ...valid, localStart: "2027-01-01T10:00" }],
      [valid, valid],
      [{ ...valid, localStart: "2027-01-02T11:50" }],
    ])
      expect(() =>
        validateProposalTasks(tasks, context, localInstant),
      ).toThrow();
    expect(() =>
      validateProposalTasks(
        [valid],
        {
          ...context,
          courses: [{ ...context.courses[0]!, exam: "2027-01-02T10:10:00Z" }],
        },
        localInstant,
      ),
    ).toThrow();
  });
  it("valide avant persistance et refuse Pro avant d’appeler le fournisseur", async () => {
    const requireAccess = vi.fn().mockResolvedValue({});
    const read = vi.fn().mockResolvedValue(context),
      generate = vi.fn().mockResolvedValue({ bad: true }),
      persist = vi.fn();
    const use = new IntelligentPlanning(
      { require: requireAccess } as unknown as GetEntitlements,
      { read },
      { generate, name: "mock" },
      { generate: persist } as unknown as PlanRepository,
      localInstant,
      (s) => s,
    );
    await expect(use.propose("user", "UTC")).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
    });
    expect(persist).not.toHaveBeenCalled();
    requireAccess.mockRejectedValue(new Error("Pro requis"));
    generate.mockClear();
    await expect(use.propose("free", "UTC")).rejects.toThrow("Pro requis");
    expect(generate).not.toHaveBeenCalled();
  });
  it("agrège uniquement des faits et conserve les durées inconnues", () => {
    const date = new Date("2027-01-02T10:00:00Z");
    const empty = summarizeProgress([], [], [], date);
    expect(empty.averageScore).toBeNull();
    expect(empty.successRate).toBeNull();
    expect(empty.monthly).toHaveLength(30);
    const result = summarizeProgress(
      [
        {
          id: "r",
          createdAt: date,
          remembered: true,
          durationSeconds: 40,
          subject: "Maths",
        },
        {
          id: "old",
          createdAt: date,
          remembered: false,
          durationSeconds: null,
          subject: null,
        },
      ],
      [
        {
          id: "q",
          submittedAt: date,
          score: 60,
          subject: "Maths",
          title: "Fractions",
        },
      ],
      [{ box: 2, count: 1 }],
      date,
    );
    expect(result).toMatchObject({
      totalReviews: 2,
      successRate: 50,
      revisionSeconds: 40,
      timedReviews: 1,
      averageScore: 60,
    });
    expect(result.weekly.at(-1)).toMatchObject({ reviews: 2, quizzes: 1 });
    expect(result.subjects[0]).toMatchObject({ subject: "Maths", reviews: 1 });
  });
});
