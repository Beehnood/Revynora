import { DomainError } from "../../shared/domain/errors";
import type { GetEntitlements } from "../../billing/application/billing.use-cases";
import {
  resolveLearningAccess,
  type LearningAccessRepository,
} from "../domain/access";
export class GetLearningAccess {
  constructor(
    private readonly commercial: GetEntitlements,
    private readonly repo: LearningAccessRepository,
  ) {}
  async execute(userId: string) {
    const now = new Date();
    const [account, commercial] = await Promise.all([
      this.repo.account(userId, now),
      this.commercial.execute(userId),
    ]);
    return resolveLearningAccess(account, commercial, now);
  }
  async require(userId: string, plan: "PLUS" | "PRO") {
    const rights = await this.execute(userId);
    if (
      !rights.allowed ||
      (plan === "PLUS" ? !rights.leitner : !rights.planning)
    )
      throw new DomainError(
        403,
        "PLAN_REQUIRED",
        "Cette fonctionnalité nécessite un droit pédagogique actif.",
      );
    return rights;
  }
}
