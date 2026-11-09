# Gemini PDF structured-output compatibility

The PDF adapter calls `POST /v1beta/models/{model}:generateContent` with
`generationConfig.responseMimeType = application/json` and `responseJsonSchema`.
It does not mix the OpenAPI-style `responseSchema` with JSON Schema.

The observed 400 INVALID_ARGUMENT does not identify its exact field: the private
provider response was discarded. This patch mitigates a schema-complexity
hypothesis; it does not claim a successful live-provider verification.

The Zod PDF schema has four array bounds: chapters 1–12, objectives 1–5,
concepts 1–8 and references 1–3. The last three are nested inside chapters.
Google documents minItems/maxItems as supported, but complex nested schemas can
still be rejected. They are not intrinsically invalid JSON Schema.

Only the PDF schema sent to Gemini is projected: array, string and numeric bounds
are omitted recursively. Types, items, properties, required fields and
additionalProperties remain. The current PDF schema has no optional/nullable
fields, $ref, anyOf or enums; the projection preserves these when present rather
than converting them into a different contract. No schema properties are renamed.

The unchanged shared Zod/source validator still enforces all array/string/page
bounds and exact citations on their specified PDF pages after generation. Token
and response-size limits remain. Invalid output fails without fabricated results.
OpenAI and the Gemini quiz schema remain unchanged. No fallback or retry is added.

References:

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output

Before a new live test, rebuild the API so the compiled adapter includes this
projection. Use the existing synthetic PDF and isolated test database, with the
owner-confirmed Free Tier model gemini-3.5-flash-lite. Authorize at most one
request, capture only sanitized HTTP diagnostics/token counters, and stop on any
failure. Unit tests mock every provider request; they do not certify acceptance
by Google's service.
