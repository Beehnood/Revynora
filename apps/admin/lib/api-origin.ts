export function adminApiOrigin(
  env: Partial<Record<"API_URL" | "NODE_ENV" | "VERCEL", string>> = process.env,
): string {
  const production = env.NODE_ENV === "production" || Boolean(env.VERCEL);
  if (!env.API_URL) {
    if (production)
      throw new Error(
        "API_URL est obligatoire pour l’administration en production.",
      );
    return "http://127.0.0.1:3001";
  }
  const url = new URL(env.API_URL);
  if (
    url.origin !== env.API_URL ||
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol) ||
    (production &&
      url.protocol !== "https:" &&
      (Boolean(env.VERCEL) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  )
    throw new Error(
      "API_URL doit être une origine valide, HTTPS sur Vercel et hors loopback.",
    );
  return url.origin;
}
