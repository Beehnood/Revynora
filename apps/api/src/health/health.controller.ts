import { Controller, Get, Inject } from "@nestjs/common";
import { ApiError } from "../shared/http/errors";
import { DatabaseService } from "../database/database.service";
import type { HealthResponse, ReadinessResponse } from "@revynora/types";
@Controller("health")
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get() health(): HealthResponse {
    return { status: "ok", version: "0.0.0" };
  }
  @Get("ready") async ready(): Promise<ReadinessResponse> {
    try {
      await this.db.ready();
      return { status: "ready" };
    } catch {
      throw new ApiError(
        503,
        "DB_UNAVAILABLE",
        "La base de données est indisponible.",
      );
    }
  }
}
