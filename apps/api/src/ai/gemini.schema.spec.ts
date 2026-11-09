import { expect, it } from "vitest";
import { z } from "zod";
import { analysisSchema } from "../documents/document.schema";
import { geminiGenerationSchema } from "./gemini.schema";

it("projects the actual PDF schema without mutating its strict backend contract", () => {
  const source = z.toJSONSchema(analysisSchema);
  const original = JSON.stringify(source);
  const compact = geminiGenerationSchema(source);
  expect(JSON.stringify(source)).toBe(original);
  expect(JSON.stringify(compact)).not.toMatch(
    /"(?:maxItems|minItems|minLength|maxLength|minimum|maximum|\$schema)":/,
  );
  expect(JSON.stringify(compact).length).toBeLessThan(original.length);
  expect(compact.required).toEqual(source.required);
  expect(compact.additionalProperties).toBe(false);
  expect(
    analysisSchema.safeParse({ title: "Cours", chapters: [] }).success,
  ).toBe(false);
});

it("preserves enums, optional/nullable types and reference/union structure", () => {
  const source = {
    type: "object",
    required: ["choice"],
    properties: {
      choice: { type: "string", enum: ["A", "B"] },
      optional: {
        anyOf: [{ type: "string", maxLength: 20 }, { type: "null" }],
      },
      linked: { $ref: "#/$defs/item" },
      maxItems: { type: "string" },
    },
    $defs: {
      item: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "integer", minimum: 1 },
      },
    },
  };
  const compact = geminiGenerationSchema(source);
  expect(compact.properties).toEqual({
    choice: source.properties.choice,
    optional: { anyOf: [{ type: "string" }, { type: "null" }] },
    linked: source.properties.linked,
    maxItems: { type: "string" },
  });
  expect(compact.$defs).toEqual({
    item: { type: "array", items: { type: "integer" } },
  });
  expect(compact.required).toEqual(["choice"]);
});
