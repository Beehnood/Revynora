/* eslint-disable @next/next/no-location-assign-relative-destination -- reload clears protected client state after session expiry */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/v1" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Revynora-Client": "web",
        ...options.headers,
      },
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new RequestError(
      "Le service est inaccessible. Vérifiez votre connexion puis réessayez.",
      "NETWORK",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new RequestError(
      "Le service est temporairement indisponible.",
      "UNAVAILABLE",
      response.status,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && window.location.pathname.startsWith("/app"))
      window.location.assign(
        "/connexion?retour=" + encodeURIComponent(window.location.pathname),
      );
    throw new RequestError(
      data.message ?? "La requête a échoué.",
      data.code ?? "ERROR",
      response.status,
      Array.isArray(data.details) ? data.details : [],
    );
  }
  return data as T;
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Une erreur est survenue. Réessayez.";
}
export function safeReturn(value: string | null) {
  if (!value || value.includes("\\") || !/^\/app(?:\/[^?#]*)?$/.test(value))
    return "/app";
  const normalized = new URL(value, "http://revynora.local").pathname;
  return normalized === value &&
    (normalized === "/app" || normalized.startsWith("/app/"))
    ? normalized
    : "/app";
}
