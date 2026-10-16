import { z } from "zod";
export const generatedSchema = z
  .object({
    miniCourse: z.string().min(40).max(6000),
    questions: z
      .array(
        z
          .object({
            text: z.string().min(10).max(1000),
            concept: z.string().min(2).max(120),
            explanation: z.string().min(20).max(2000),
            type: z.enum(["SINGLE", "MULTIPLE"]),
            options: z
              .array(
                z
                  .object({
                    text: z.string().min(1).max(500),
                    correct: z.boolean(),
                  })
                  .strict(),
              )
              .min(2)
              .max(5),
          })
          .strict(),
      )
      .length(5),
  })
  .strict()
  .superRefine((quiz, context) => {
    const texts = new Set<string>();
    quiz.questions.forEach((q, index) => {
      const correct = q.options.filter((o) => o.correct).length;
      if (
        correct === 0 ||
        correct === q.options.length ||
        (q.type === "SINGLE" && correct !== 1) ||
        (q.type === "MULTIPLE" && correct < 2)
      )
        context.addIssue({
          code: "custom",
          message: "Options incohérentes.",
          path: ["questions", index, "options"],
        });
      if (
        new Set(q.options.map((o) => o.text.trim().toLowerCase())).size !==
        q.options.length
      )
        context.addIssue({
          code: "custom",
          message: "Options identiques.",
          path: ["questions", index],
        });
      if (texts.has(q.text))
        context.addIssue({
          code: "custom",
          message: "Questions identiques.",
          path: ["questions", index],
        });
      texts.add(q.text);
    });
  });
export type GeneratedQuiz = z.infer<typeof generatedSchema>;
export type DiagnosticInput = {
  domain: "Sciences" | "Mathématiques" | "Langues";
  topic: string;
  level: "Débutant" | "Intermédiaire" | "Avancé";
};
export const outputJsonSchema = z.toJSONSchema(generatedSchema, {
  unrepresentable: "any",
});
