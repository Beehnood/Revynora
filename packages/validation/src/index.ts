import { z } from "zod";
export const demoFormSchema = z.object({
  name: z.string().trim().min(2, "Indiquez au moins 2 caractères.").max(80),
  subject: z.enum(["maths", "physics", "languages"]),
  message: z
    .string()
    .trim()
    .min(10, "Indiquez au moins 10 caractères.")
    .max(500),
});
export const environmentSchema = z
  .object({
    AI_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
    AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    AI_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(20000),
    AI_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
    AI_INPUT_USD_PER_MILLION: z.coerce.number().nonnegative().optional(),
    AI_OUTPUT_USD_PER_MILLION: z.coerce.number().nonnegative().optional(),
    COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
    SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z
      .url()
      .refine(
        (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
        "URL PostgreSQL requise",
      ),
    WEB_ORIGIN: z
      .url()
      .refine((v) => new URL(v).origin === v, "Origine sans chemin requise")
      .default("http://localhost:3000"),
  })
  .refine((v) => v.AI_PROVIDER !== "openai" || !!v.OPENAI_API_KEY?.trim(), {
    message: "OPENAI_API_KEY requise en mode openai",
    path: ["OPENAI_API_KEY"],
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Indiquez au moins 2 caractères.").max(80),
    email: z.email("Adresse e-mail invalide.").trim().toLowerCase().max(254),
    password: z
      .string()
      .min(12, "Utilisez au moins 12 caractères.")
      .max(128, "128 caractères maximum."),
  })
  .strict();
export const loginSchema = registerSchema.omit({ name: true });
export const diagnosticSchema = z
  .object({
    domain: z.enum(["Sciences", "Mathématiques", "Langues"]),
    topic: z
      .string()
      .trim()
      .min(3, "Précisez votre sujet (3 caractères minimum).")
      .max(160),
    level: z.enum(["Débutant", "Intermédiaire", "Avancé"]),
  })
  .strict();
export const courseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Indiquez un titre d’au moins 3 caractères.")
      .max(160, "160 caractères maximum."),
    domain: z.enum(["Sciences", "Mathématiques", "Langues"]),
    content: z
      .string()
      .trim()
      .min(10, "Indiquez un contenu d’au moins 10 caractères.")
      .max(10000, "10 000 caractères maximum."),
  })
  .strict();
export const answerSchema = z
  .object({
    selectedOptionIds: z
      .array(z.uuid())
      .min(0)
      .max(5)
      .refine((v) => new Set(v).size === v.length, "Options dupliquées."),
  })
  .strict();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(10),
});
export const idSchema = z.uuid();
