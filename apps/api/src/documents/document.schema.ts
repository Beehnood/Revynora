import { z } from "zod";
export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export const pagesSchema = z
  .array(
    z.object({
      page: z.number().int().min(1).max(25),
      text: z.string().max(60000),
    }),
  )
  .min(1)
  .max(25);
export type DocumentPages = z.infer<typeof pagesSchema>;
export const analysisSchema = z.object({
  title: z.string().min(1).max(160),
  chapters: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        summary: z.string().min(1).max(1800),
        objectives: z.array(z.string().min(1).max(250)).min(1).max(5),
        concepts: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              explanation: z.string().min(1).max(600),
            }),
          )
          .min(1)
          .max(8),
        references: z
          .array(
            z.object({
              page: z.number().int().min(1).max(25),
              quote: z.string().min(10).max(240),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .min(1)
    .max(12),
});
export type DocumentAnalysis = z.infer<typeof analysisSchema>;
const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim();
export function validateReference(
  ref: { page: number; quote: string },
  pages: DocumentPages,
) {
  const page = pages.find((p) => p.page === ref.page);
  if (!page || !normalize(page.text).includes(normalize(ref.quote)))
    throw new Error("Ungrounded page reference");
}
export function validateAnalysis(value: unknown, pages: DocumentPages) {
  const result = analysisSchema.parse(value);
  for (const chapter of result.chapters)
    for (const ref of chapter.references) {
      validateReference(ref, pages);
    }
  return result;
}
export function weekStart(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}
