import { DomainError } from "../../shared/domain/errors";
import type { GetLearningAccess } from "../../learning-access/application/learning-access";
import type { PreferenceRepository } from "../domain/notifications";
export class NotificationUseCases {
  constructor(
    private readonly repo: PreferenceRepository,
    private readonly access: GetLearningAccess,
  ) {}
  preferences(user: string) {
    return this.repo.preferences(user);
  }
  async update(user: string, enabled: boolean, zone: string) {
    if (enabled) {
      const rights = await this.access.require(user, "PRO");
      if (rights.reminders === false)
        throw new DomainError(
          403,
          "PLAN_REQUIRED",
          "Rappels non inclus dans le contrat.",
        );
    }
    return this.repo.update(user, enabled, zone);
  }
  inbox(user: string) {
    return this.repo.inbox(user);
  }
}
