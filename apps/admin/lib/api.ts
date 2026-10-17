/* eslint-disable @next/next/no-location-assign-relative-destination -- clear protected client state */
import { createApiClient } from "@revynora/api-client";
export { RequestError, message } from "@revynora/api-client";
export const api = createApiClient({
  onUnauthorized: () => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/connexion"
    )
      window.location.assign("/connexion");
  },
});
