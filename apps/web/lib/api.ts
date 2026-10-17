/* eslint-disable @next/next/no-location-assign-relative-destination -- clear private state after expiry */
import { createApiClient } from "@revynora/api-client";
export { RequestError, message } from "@revynora/api-client";
export const api = createApiClient({
  onUnauthorized: () => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/app")
    )
      window.location.assign(
        "/connexion?retour=" + encodeURIComponent(window.location.pathname),
      );
  },
});
export function safeReturn(value: string | null) {
  if (!value || value.includes("\\") || !/^\/app(?:\/[^?#]*)?$/.test(value))
    return "/app";
  const normalized = new URL(value, "http://revynora.local").pathname;
  return normalized === value &&
    (normalized === "/app" || normalized.startsWith("/app/"))
    ? normalized
    : "/app";
}
