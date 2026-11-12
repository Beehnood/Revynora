import { z } from "zod";
import { generatedSchema, validateGeneratedQuestions } from "../ai/ai.schema";
import {
  analysisSchema,
  validateReference,
  type DocumentPages,
} from "./document.schema";

const question = generatedSchema.shape.questions.element.extend({
  type: z.enum(["SINGLE"]),
  options: generatedSchema.shape.questions.element.shape.options.length(4),
  chapterIndex: z.number().int().min(0).max(11),
  reference: z
    .object({
      page: z.number().int().min(1).max(25),
      quote: z.string().min(10).max(240),
    })
    .strict(),
});
export const pdfQuizSchema = z
  .object({ questions: z.array(question).min(5).max(10) })
  .strict()
  .superRefine((value, context) =>
    validateGeneratedQuestions(value.questions, context),
  );
export type PdfDiagnostic = z.infer<typeof pdfQuizSchema>;
const normalized = (v: string) =>
  v.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
export function validatePdfQuiz(
  value: unknown,
  pages: DocumentPages,
  rawAnalysis: unknown,
) {
  const analysis = analysisSchema.parse(rawAnalysis);
  const quiz = pdfQuizSchema.parse(value);
  const texts = new Set<string>();
  const chapters = new Set<number>();
  const concepts = new Set<string>();
  for (const q of quiz.questions) {
    const chapter = analysis.chapters[q.chapterIndex];
    if (
      !chapter ||
      !chapter.concepts.some(
        (c) => normalized(c.name) === normalized(q.concept),
      )
    )
      throw Error("Unknown PDF concept");
    q.concept = chapter.concepts.find(
      (c) => normalized(c.name) === normalized(q.concept),
    )!.name;
    validateReference(q.reference, pages);
    const text = normalized(q.text);
    if (texts.has(text)) throw Error("Duplicate PDF question");
    texts.add(text);
    chapters.add(q.chapterIndex);
    concepts.add(normalized(q.concept));
  }
  const availableConcepts = new Set(
    analysis.chapters.flatMap((c) => c.concepts.map((v) => normalized(v.name))),
  );
  if (analysis.chapters.length > 1 && chapters.size < 2)
    throw Error("Insufficient chapter coverage");
  if (availableConcepts.size > 1 && concepts.size < 2)
    throw Error("Insufficient concept coverage");
  return quiz;
}
