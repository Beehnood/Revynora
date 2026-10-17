import type {
  OpenAPIObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
const text: SchemaObject = { type: "string" },
  bool: SchemaObject = { type: "boolean" },
  version: SchemaObject = { type: "integer", minimum: 0 },
  uuid: SchemaObject = { type: "string", format: "uuid" },
  plan: SchemaObject = { type: "string", enum: ["PLUS", "PRO"] };
const object = (
  properties: Record<string, SchemaObject>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const card = {
  front: { ...text, minLength: 1, maxLength: 1000 },
  back: { ...text, minLength: 1, maxLength: 4000 },
  courseId: { ...uuid, nullable: true },
};
const task = {
  title: { ...text, minLength: 1, maxLength: 160 },
  localStart: { ...text, pattern: "^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d$" },
  durationMinutes: {
    type: "integer",
    minimum: 15,
    maximum: 180,
  } as SchemaObject,
  reminderMinutes: {
    type: "integer",
    nullable: true,
    minimum: 5,
    maximum: 1440,
  } as SchemaObject,
};
export function completeSaasOpenApi(doc: OpenAPIObject) {
  const requests: Record<string, SchemaObject> = {
    "POST /api/v1/billing/checkout-session": object({ plan }),
    "POST /api/v1/billing/change-plan": object({ plan }),
    "POST /api/v1/billing/mock-complete": object({
      intentId: uuid,
      success: bool,
    }),
    "POST /api/v1/leitner/cards": object(card, ["front", "back"]),
    "PATCH /api/v1/leitner/cards/{id}": object({ ...card, version }, [
      "front",
      "back",
      "version",
    ]),
    "POST /api/v1/leitner/cards/{id}/review": object(
      {
        requestId: uuid,
        version,
        remembered: bool,
        durationSeconds: { type: "integer", minimum: 0, maximum: 3600 },
      },
      ["requestId", "version", "remembered"],
    ),
    "POST /api/v1/study-plans/generate": object(
      {
        title: task.title,
        timeZone: { ...text, example: "Europe/Paris" },
        resolveConflicts: bool,
        tasks: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: object(task, ["title", "localStart", "durationMinutes"]),
        },
      },
      ["title", "timeZone", "tasks"],
    ),
    "PATCH /api/v1/study-plan-items/{id}": object(
      {
        ...task,
        version,
        status: { type: "string", enum: ["PLANNED", "DONE", "CANCELLED"] },
        resolveConflicts: bool,
      },
      ["version"],
    ),
    "PUT /api/v1/notifications/preferences": object({
      enabled: bool,
      timeZone: { ...text, example: "Europe/Paris" },
    }),
    "PATCH /api/v1/admin/users/{id}": object({ disabled: bool }),
    "DELETE /api/v1/privacy/account": object({
      password: { ...text, minLength: 1, maxLength: 128 },
      confirmation: { type: "string", enum: ["SUPPRIMER"] },
    }),
  };
  for (const [path, item] of Object.entries(doc.paths))
    for (const method of ["get", "post", "patch", "put", "delete"] as const) {
      const op = item[method];
      if (!op) continue;
      const phase2 =
        /^\/api\/v1\/(subscriptions|payments|billing|webhooks|leitner|study-plans|study-plan-items|notifications|admin|privacy)(\/|$)/.test(
          path,
        );
      if (!phase2) continue;
      op.tags = [
        path.includes("/admin/")
          ? "Administration"
          : path.includes("/billing/") ||
              path.includes("/subscriptions/") ||
              path.includes("/payments/") ||
              path.includes("/webhooks/")
            ? "Facturation"
            : path.includes("/leitner/")
              ? "Leitner"
              : path.includes("/study-plan")
                ? "Planning"
                : path.includes("/privacy/")
                  ? "Données personnelles"
                  : "Notifications",
      ];
      if (
        path !== "/api/v1/subscriptions/plans" &&
        path !== "/api/v1/webhooks/stripe"
      )
        op.security = [{ cookie: [] }];
      const schema = requests[`${method.toUpperCase()} ${path}`];
      if (schema)
        op.requestBody = {
          required: true,
          content: { "application/json": { schema } },
        };
      if (
        method === "get" &&
        /\/(history|payments\/me|leitner\/cards|admin\/users|admin\/events)$/.test(
          path,
        )
      ) {
        op.parameters = [
          ...(op.parameters ?? []),
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: path.includes("leitner") ? 100 : 50,
            },
          },
        ];
      }
      if (path === "/api/v1/webhooks/stripe") {
        op.security = [];
        op.description =
          "Corps HTTP brut vérifié par Stripe SDK. Mode test uniquement ; événements idempotents et état prestataire relu avant application.";
        op.parameters = (op.parameters ?? []).filter(
          (p) => !("name" in p && p.name === "X-Revynora-Client"),
        );
        op.parameters.push({
          name: "Stripe-Signature",
          in: "header",
          required: true,
          schema: text,
        });
        op.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
            },
          },
        };
      }
    }
  return doc;
}
