import { loadEnvironment } from "../shared/config/environment";
import { DatabaseService } from "./database.service";
async function check() {
  loadEnvironment();
  const db = new DatabaseService();
  try {
    await db.ready();
    console.log("PostgreSQL disponible");
  } finally {
    await db.onModuleDestroy();
  }
}
check().catch(() => {
  console.error("PostgreSQL inaccessible");
  process.exitCode = 1;
});
