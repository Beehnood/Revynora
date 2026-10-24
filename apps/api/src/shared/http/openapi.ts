import { completePhase3OpenApi } from "./phase3-openapi";
import { completeSaasOpenApi } from "./saas-openapi";
import type {
  OpenAPIObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const str: SchemaObject = { type: "string" };
const id: SchemaObject = { type: "string", format: "uuid" };
const date: SchemaObject = { type: "string", format: "date-time" };
const object = (
  properties: Record<string, SchemaObject | { $ref: string }>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const array = (items: SchemaObject | { $ref: string }): SchemaObject => ({
  type: "array",
  items,
});
export function completeOpenApi(doc: OpenAPIObject) {
  const quizQuestion = object({
    id,
    position: { type: "integer" },
    text: str,
    type: { type: "string", enum: ["SINGLE", "MULTIPLE"] },
    options: array(object({ id, text: str })),
  });
  const summary = object({
    id,
    startedAt: date,
    submittedAt: { ...date, nullable: true },
    score: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
    quiz: object({ topic: str, domain: str, level: str, provider: str }),
  });
  const page = (item: string) =>
    object({
      items: array(ref(item)),
      total: { type: "integer" },
      page: { type: "integer" },
      pageSize: { type: "integer" },
    });
  const schemas: Record<string, SchemaObject> = {
    Error: object(
      {
        code: str,
        message: str,
        requestId: str,
        details: array(object({ field: str, message: str })),
      },
      ["code", "message", "requestId"],
    ),
    User: object({
      id,
      name: str,
      email: { type: "string", format: "email" },
      role: { type: "string", enum: ["STUDENT", "ADMIN"] },
      plan: { type: "string", enum: ["FREE", "PLUS", "PRO"] },
      timeZone: { type: "string" },
      remindersEnabled: { type: "boolean" },
      disabledAt: { type: "string", format: "date-time", nullable: true },
      createdAt: date,
    }),
    Quiz: object({
      id,
      domain: str,
      topic: str,
      level: str,
      provider: str,
      createdAt: date,
      questions: { ...array(quizQuestion), minItems: 5, maxItems: 5 },
    }),
    Course: object({
      id,
      title: str,
      domain: str,
      content: str,
      source: { type: "string", enum: ["USER", "AI", "ADMIN"] },
      createdAt: date,
    }),
    AttemptSummary: summary,
    History: page("AttemptSummary"),
    Courses: page("Course"),
    Attempt: object({
      id,
      startedAt: date,
      submittedAt: { ...date, nullable: true },
      score: { type: "integer", nullable: true },
      quiz: ref("Quiz"),
      answers: array(object({ questionId: id, selectedOptionIds: array(id) })),
      result: {
        ...object({
          score: { type: "integer" },
          mastered: array(str),
          weak: array(str),
          miniCourse: str,
          corrected: array(
            object({
              questionId: id,
              concept: str,
              correct: { type: "boolean" },
            }),
          ),
          questions: array(
            object({
              id,
              text: str,
              concept: str,
              explanation: str,
              correctOptionIds: array(id),
            }),
          ),
        }),
        nullable: true,
        description:
          "Null avant soumission. Solutions et mini-cours uniquement après soumission.",
      },
    }),
    LearningConfig: object({
      provider: str,
      mockTopics: array(object({ domain: str, topic: str })),
      dailyLimit: { type: "integer" },
      used: { type: "integer" },
      remaining: { type: "integer" },
      reset: str,
    }),
    LearningSummary: object({
      completed: { type: "integer" },
      lastScore: { type: "integer", nullable: true },
      average: { type: "integer", nullable: true },
      weak: array(str),
      recent: array(ref("AttemptSummary")),
    }),
    AttemptId: object({ id }),
    Saved: object({ saved: { type: "boolean" } }),
    Ok: object({ ok: { type: "boolean" } }),
    Health: object({ status: { type: "string", enum: ["ok"] }, version: str }),
    Ready: object({ status: { type: "string", enum: ["ready"] } }),
  };
  doc.components ??= {};
  doc.components.schemas = { ...doc.components.schemas, ...schemas };
  const responses: Record<string, string> = {
    "POST /api/v1/auth/register": "User",
    "POST /api/v1/auth/login": "User",
    "POST /api/v1/auth/logout": "Ok",
    "GET /api/v1/users/me": "User",
    "GET /api/v1/learning/config": "LearningConfig",
    "GET /api/v1/learning/summary": "LearningSummary",
    "GET /api/v1/courses": "Courses",
    "POST /api/v1/courses": "Course",
    "POST /api/v1/quizzes/diagnostic": "Quiz",
    "GET /api/v1/quizzes/{id}": "Quiz",
    "POST /api/v1/quizzes/{id}/attempts": "AttemptId",
    "GET /api/v1/attempts": "History",
    "GET /api/v1/attempts/{id}": "Attempt",
    "PUT /api/v1/attempts/{id}/answers/{questionId}": "Saved",
    "POST /api/v1/attempts/{id}/submit": "Attempt",
    "GET /api/v1/health": "Health",
    "GET /api/v1/health/ready": "Ready",
  };
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const op = item[method];
      if (!op) continue;
      const name = responses[`${method.toUpperCase()} ${path}`];
      if (name)
        op.responses[method === "post" ? "201" : "200"] = {
          description: "Réponse réussie",
          content: { "application/json": { schema: ref(name) } },
        };
      for (const code of [400, 401, 403, 404, 409, 429, 503])
        op.responses[String(code)] = {
          description: {
            400: "Validation invalide",
            401: "Session absente ou expirée",
            403: "Origine ou rôle refusé",
            404: "Ressource absente ou non possédée",
            409: "Conflit ou réponses incomplètes",
            429: "Limite de requêtes ou quota atteint",
            503: "Service indisponible",
          }[code as 400],
          content: { "application/json": { schema: ref("Error") } },
        };
      if (method !== "get") {
        op.parameters =
          op.parameters?.filter(
            (p) => !("name" in p && p.name === "X-Revynora-Client"),
          ) ?? [];
        op.parameters.push({
          name: "X-Revynora-Client",
          in: "header",
          required: true,
          schema: {
            type: "string",
            enum: path.includes("/auth/mobile/")
              ? ["mobile"]
              : ["web", "mobile"],
          },
          description:
            "Web : web et origine autorisée. Mobile : mobile sans Origin, avec bearer sauf inscription/connexion natives.",
        });
      }
    }
  }
  return completePhase3OpenApi(completeSaasOpenApi(doc));
}
