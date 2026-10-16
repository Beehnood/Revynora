import { config } from "dotenv";
import { resolve } from "node:path";
import { environmentSchema } from "@revynora/validation";
export function loadEnvironment() {
  config({ path: resolve(__dirname, "../../../../../.env"), quiet: true });
  return environmentSchema.parse(process.env);
}
