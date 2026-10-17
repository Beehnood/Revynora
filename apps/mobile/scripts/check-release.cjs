const raw = process.env.EXPO_PUBLIC_API_URL;
if (!raw)
  throw Error(
    "Set EXPO_PUBLIC_API_URL to the public HTTPS API before EAS build.",
  );
const url = new URL(raw);
if (
  url.protocol !== "https:" ||
  url.hostname !== "api.revynora.watercode.dev" ||
  url.pathname.replace(/\/$/, "") !== "/api/v1" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw Error(
    "Expected public Revynora HTTPS API; no localhost or credentials.",
  );
if (!/^[0-9a-f-]{36}$/i.test(process.env.EAS_PROJECT_ID ?? ""))
  throw Error(
    "Set EAS_PROJECT_ID after reviewing and linking the actual Expo project.",
  );
console.log(
  "Release URL and Expo project ID configured. Connectivity and signing still require external validation.",
);
