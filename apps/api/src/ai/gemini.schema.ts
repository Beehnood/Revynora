// Keep generation guidance small; the shared Zod validator remains authoritative.
// Nested bounded arrays can exceed Gemini's structured-output complexity budget.
// Do not apply this projection to the OpenAI schema or to backend validation.
export function geminiGenerationSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...schema };
  for (const key of [
    "$schema",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
  ])
    delete result[key];
  for (const key of ["properties", "$defs"]) {
    const children = result[key];
    if (children && typeof children === "object" && !Array.isArray(children))
      result[key] = Object.fromEntries(
        Object.entries(children).map(([name, child]) => [
          name,
          geminiGenerationSchema(child as Record<string, unknown>),
        ]),
      );
  }
  if (result.items && typeof result.items === "object")
    result.items = geminiGenerationSchema(
      result.items as Record<string, unknown>,
    );
  for (const key of ["anyOf", "oneOf", "prefixItems"])
    if (Array.isArray(result[key]))
      result[key] = result[key].map((child) =>
        geminiGenerationSchema(child as Record<string, unknown>),
      );
  return result;
}
