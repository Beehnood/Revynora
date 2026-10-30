function adminApiOrigin(
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

export type AdminSessionState =
  | "authenticated"
  | "signin"
  | "forbidden"
  | "unavailable";
export async function readAdminSession(
  token: string | undefined,
): Promise<AdminSessionState> {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return "signin";
  try {
    const response = await fetch(adminApiOrigin() + "/api/v1/users/me", {
      headers: { cookie: "revynora_session=" + token },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return "signin";
    if (response.status === 403) return "forbidden";
    if (!response.ok) return "unavailable";
    const profile: unknown = await response.json();
    if (
      !profile ||
      typeof profile !== "object" ||
      !("id" in profile) ||
      typeof profile.id !== "string" ||
      !("role" in profile)
    )
      return "unavailable";
    if ("disabledAt" in profile && profile.disabledAt !== null) return "signin";
    if (profile.role === "ADMIN") return "authenticated";
    return profile.role === "STUDENT" ? "forbidden" : "unavailable";
  } catch {
    return "unavailable";
  }
}
