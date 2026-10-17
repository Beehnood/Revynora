import { createApiClient } from "@revynora/api-client";
// No login, persistence or business requests in Phase 2.5.
// A physical device requires the reachable LAN address of the central API.
export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api/v1",
  credentials: "omit",
});
