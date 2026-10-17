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
export function createApiClient(
  config: {
    baseUrl?: string;
    fetcher?: typeof fetch;
    credentials?: RequestCredentials;
    onUnauthorized?: () => void;
  } = {},
) {
  return async function api<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await (config.fetcher ?? fetch)(
        (config.baseUrl ?? "/api/v1").replace(/\/$/, "") + path,
        {
          ...options,
          headers: {
            "Content-Type": "application/json",
            "X-Revynora-Client": "web",
            ...options.headers,
          },
          cache: "no-store",
          credentials: config.credentials ?? "same-origin",
        },
      );
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
      if (response.status === 401) config.onUnauthorized?.();
      throw new RequestError(
        data.message ?? "La requête a échoué.",
        data.code ?? "ERROR",
        response.status,
        Array.isArray(data.details) ? data.details : [],
      );
    }
    return data as T;
  };
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Une erreur est survenue. Réessayez.";
}
