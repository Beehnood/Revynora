import { afterEach, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DomainError } from "../../shared/domain/errors";
import { PrismaAdminRepository } from "./admin.repository";
import { decodeAccessAudit } from "../domain/audit";

afterEach(() => vi.restoreAllMocks());
const command = {
  disabled: true,
  confirmed: true,
  reason: "SECURITY_REVIEW",
} as const;
function setup() {
  // All database operations below are mocked; no connection is opened.
  const db = new PrismaClient({
    datasourceUrl: "postgresql://unit:unit@127.0.0.1:5433/revynora_test",
  });
  const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  return { db, log, repo: new PrismaAdminRepository(db) };
}
it("conserve l’erreur métier lorsque l’audit après refus échoue, et alerte sans données sensibles", async () => {
  const { db, log, repo } = setup();
  const original = new DomainError(404, "NOT_FOUND", "Ressource introuvable.");
  vi.spyOn(db, "$transaction").mockRejectedValue(original);
  vi.spyOn(db.auditLog, "create").mockRejectedValue(
    new Error("synthetic-private-diagnostic"),
  );
  await expect(repo.disable("actor", "target", command)).rejects.toBe(original);
  expect(log).toHaveBeenCalledExactlyOnceWith({
    event: "ADMIN_AUDIT_PERSISTENCE_FAILED",
    actorId: "actor",
    targetUserId: "target",
    action: "USER_DISABLED",
    reason: "SECURITY_REVIEW",
    originalCode: "NOT_FOUND",
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "synthetic-private-diagnostic",
  );
});
it("conserve aussi l’erreur technique originale si les deux écritures échouent", async () => {
  const { db, log, repo } = setup();
  const original = new Error("synthetic-initial-private-diagnostic");
  vi.spyOn(db, "$transaction").mockRejectedValue(original);
  vi.spyOn(db.auditLog, "create").mockRejectedValue(new Error("secondary"));
  await expect(repo.disable("actor", "target", command)).rejects.toBe(original);
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "synthetic-initial-private-diagnostic",
  );
});
it("conserve le refus de modification de soi-même même si son audit est indisponible", async () => {
  const { db, log, repo } = setup();
  const transaction = vi.spyOn(db, "$transaction");
  vi.spyOn(db.auditLog, "create").mockRejectedValue(new Error("secondary"));
  await expect(repo.disable("actor", "actor", command)).rejects.toMatchObject({
    status: 409,
    code: "SELF_MODIFICATION",
  });
  expect(transaction).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledOnce();
});
it("persiste le refus après rollback sans alerte supplémentaire si l’audit fonctionne", async () => {
  const { db, log, repo } = setup();
  const original = new DomainError(
    409,
    "ADMIN_PROTECTED",
    "Administrateur protégé.",
  );
  vi.spyOn(db, "$transaction").mockRejectedValue(original);
  const create = vi.spyOn(db.auditLog, "create").mockResolvedValue({
    id: "audit",
    actorId: "actor",
    targetUserId: "target",
    action: "stored",
    entityType: "User",
    entityId: "target",
    createdAt: new Date(),
  });
  await expect(repo.disable("actor", "target", command)).rejects.toBe(original);
  expect(decodeAccessAudit(create.mock.calls[0]![0].data.action)).toEqual({
    action: "USER_DISABLED",
    reason: "SECURITY_REVIEW",
    result: "REJECTED",
  });
  expect(log).not.toHaveBeenCalled();
});
