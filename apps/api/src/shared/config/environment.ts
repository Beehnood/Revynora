import { config } from "dotenv";
import { resolve } from "node:path";
import { environmentSchema } from "@revynora/validation";
export function loadEnvironment() {
  config({ path: resolve(__dirname, "../../../../../.env"), quiet: true });
  const env = environmentSchema.parse(process.env);
  if (
    process.env.NODE_ENV === "production" &&
    (env.COOKIE_SECURE !== "true" ||
      !env.WEB_ORIGIN.startsWith("https://") ||
      !env.ADMIN_ORIGIN.startsWith("https://"))
  )
    throw new Error(
      "Production requires secure cookies and explicit HTTPS frontend origins.",
    );
  return env;
}
