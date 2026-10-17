import type { GetEntitlements } from "../../billing/application/billing.use-cases";
import type {
  PlanRepository,
  GenerateInput,
  PatchInput,
} from "../domain/planning";
export class PlanningUseCases {
  constructor(
    private readonly repo: PlanRepository,
    private readonly access: GetEntitlements,
  ) {}
  async rename(user: string, id: string, title: string) {
    await this.access.require(user, "PRO");
    return this.repo.rename(user, id, title);
  }
  async availability(user: string) {
    await this.access.require(user, "PRO");
    return this.repo.availability(user);
  }
  async saveAvailability(
    user: string,
    slots: { startsAt: Date; endsAt: Date }[],
  ) {
    await this.access.require(user, "PRO");
    return this.repo.saveAvailability(user, slots);
  }
  async history(user: string, id: string, page: number) {
    await this.access.require(user, "PRO");
    return this.repo.history(user, id, page);
  }
  async list(user: string, from: Date, to: Date) {
    await this.access.require(user, "PRO");
    return this.repo.list(user, from, to);
  }
  async generate(user: string, input: GenerateInput) {
    await this.access.require(user, "PRO");
    return this.repo.generate(user, input);
  }
  async edit(user: string, id: string, input: PatchInput) {
    await this.access.require(user, "PRO");
    return this.repo.edit(user, id, input);
  }
}
