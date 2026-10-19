import { adminApiOrigin } from "./api-origin";
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
    if (profile.role === "ADMIN") return "authenticated";
    return profile.role === "STUDENT" ? "forbidden" : "unavailable";
  } catch {
    return "unavailable";
  }
}
