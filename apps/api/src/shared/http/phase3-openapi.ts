import { z } from "zod";
import {
  planSchema,
  patchTaskSchema,
  availabilitySchema,
  aiPlanningRequestSchema,
  aiPlanningConfirmSchema,
} from "@revynora/validation";
import type {
  OpenAPIObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
export function completePhase3OpenApi(doc: OpenAPIObject) {
  // DTOs reuse portable runtime schemas. JSON Schema null unions become OpenAPI 3 nullable.
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (
        Array.isArray(obj.anyOf) &&
        obj.anyOf.length === 2 &&
        obj.anyOf.some((v) => (v as { type?: string }).type === "null")
      )
        return {
          ...(convert(
            obj.anyOf.find((v) => (v as { type?: string }).type !== "null"),
          ) as object),
          nullable: true,
        };
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([k]) => k !== "$schema")
          .map(([k, v]) => [k, convert(v)]),
      );
    }
    return value;
  };
  const requests: Record<string, z.ZodType> = {
    "POST /api/v1/study-plans/generate": planSchema,
    "PATCH /api/v1/study-plan-items/{id}": patchTaskSchema,
    "PATCH /api/v1/study-plans/{id}": z
      .object({ title: z.string().min(1).max(160) })
      .strict(),
    "PUT /api/v1/study-availability": availabilitySchema,
    "POST /api/v1/study-plans/ai/propose": aiPlanningRequestSchema,
    "POST /api/v1/study-plans/ai/confirm": aiPlanningConfirmSchema,
  };
  for (const [path, item] of Object.entries(doc.paths))
    for (const method of ["get", "post", "put", "patch"] as const) {
      const op = item[method];
      if (!op) continue;
      const schema = requests[method.toUpperCase() + " " + path];
      if (schema)
        op.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: convert(
                z.toJSONSchema(schema, { io: "input" }),
              ) as SchemaObject,
            },
          },
        };
      if (path === "/api/v1/progress")
        op.description =
          "Statistiques personnelles réelles : totaux historiques, 100 derniers scores, activité UTC sur 7/30 jours, 50 derniers événements. Accessible Free/Plus/Pro.";
      if (path.includes("/study-plans/ai/"))
        op.description =
          "Pro uniquement. Proposition validée, puis confirmation explicite avec requestId UUID stable. Mode mock identifié. Aucun accès direct de l’IA à la base.";
    }
  return doc;
}
