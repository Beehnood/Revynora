import { requireAdminPermission } from "../../admin/domain/permissions";
import { DomainError } from "../../shared/domain/errors";
import type { GrantInput, InternalGrantRepository } from "../domain/access";
export class ManageLearningGrants {
  constructor(private readonly repo: InternalGrantRepository) {}
  list(role: "ADMIN" | "STUDENT", userId: string, page: number) {
    requireAdminPermission(role, "internalLearningGrants", "read");
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new DomainError(400, "VALIDATION", "Page invalide.");
    return this.repo.list(userId, page);
  }
  issue(
    actorId: string,
    role: "ADMIN" | "STUDENT",
    userId: string,
    input: GrantInput,
  ) {
    requireAdminPermission(role, "internalLearningGrants", "create");
    if (
      input.provenance.trim().length < 3 ||
      input.provenance.length > 100 ||
      input.justification.trim().length < 10 ||
      input.justification.length > 500
    )
      throw new DomainError(
        400,
        "VALIDATION",
        "Justification ou provenance invalide.",
      );
    return this.repo.issue(actorId, userId, input);
  }
  revoke(
    actorId: string,
    role: "ADMIN" | "STUDENT",
    id: string,
    reason: string,
  ) {
    requireAdminPermission(role, "internalLearningGrants", "revoke");
    if (reason.trim().length < 10 || reason.length > 500)
      throw new DomainError(400, "VALIDATION", "Motif de révocation invalide.");
    return this.repo.revoke(actorId, id, reason);
  }
}
