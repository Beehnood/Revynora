import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { DatabaseService } from "../database/database.service";
import { environmentSchema, demoFormSchema } from "@revynora/validation";
import { PrismaClient } from "@prisma/client";
describe("HealthController", () => {
  it("donne un état stable sans secret", async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: { ready: vi.fn() } }],
    }).compile();
    expect(module.get(HealthController).health()).toEqual({
      status: "ok",
      version: "0.0.0",
    });
    await module.close();
  });
  it("distingue readiness et liveness", async () => {
    const db = { ready: vi.fn().mockResolvedValue(true) };
    const controller = new HealthController(db as unknown as DatabaseService);
    expect(await controller.ready()).toEqual({ status: "ready" });
    db.ready.mockRejectedValue(new Error("private secret"));
    await expect(controller.ready()).rejects.toMatchObject({
      response: { code: "DB_UNAVAILABLE" },
      status: 503,
    });
    expect(controller.health().status).toBe("ok");
  });
  it("sonde PostgreSQL et ferme la connexion", async () => {
    const query = vi
      .spyOn(PrismaClient.prototype, "$queryRaw")
      .mockResolvedValue([{ value: 1 }]);
    const disconnect = vi
      .spyOn(PrismaClient.prototype, "$disconnect")
      .mockResolvedValue();
    const db = new DatabaseService();
    expect(await db.ready()).toBe(true);
    await db.onModuleDestroy();
    expect(query).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("rejette les configurations invalides", () => {
    expect(
      environmentSchema.safeParse({ DATABASE_URL: "https://example.com" })
        .success,
    ).toBe(false);
    expect(
      environmentSchema.safeParse({
        DATABASE_URL: "postgres://local/test",
        WEB_ORIGIN: "http://localhost:3000/path",
      }).success,
    ).toBe(false);
    expect(
      environmentSchema.parse({ DATABASE_URL: "postgresql://local/test" }).PORT,
    ).toBe(3001);
    expect(
      environmentSchema.parse({ DATABASE_URL: "postgres://local/test" }).PORT,
    ).toBe(3001);
    expect(
      environmentSchema.safeParse({
        DATABASE_URL: "postgres://local/test",
        PORT: 0,
      }).success,
    ).toBe(false);
  });
  it("valide les formulaires sans persistance", () => {
    expect(
      demoFormSchema.safeParse({ name: "A", subject: "bad", message: "" })
        .success,
    ).toBe(false);
    expect(
      demoFormSchema.parse({
        name: " Emma ",
        subject: "maths",
        message: "Comprendre les fonctions",
      }).name,
    ).toBe("Emma");
  });
});
