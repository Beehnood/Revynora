import type { CardRepository, CardInput } from "../domain/leitner";
import type { GetEntitlements } from "../../billing/application/billing.use-cases";
export class LeitnerUseCases {
  constructor(
    private readonly repo: CardRepository,
    private readonly access: GetEntitlements,
  ) {}
  async list(user: string, due: boolean, page = 1, pageSize = 100) {
    await this.access.require(user, "PLUS");
    return this.repo.list(user, due, page, pageSize);
  }
  async create(user: string, input: CardInput) {
    await this.access.require(user, "PLUS");
    return this.repo.create(user, input);
  }
  async edit(user: string, id: string, version: number, input: CardInput) {
    await this.access.require(user, "PLUS");
    return this.repo.edit(user, id, version, input);
  }
  async archive(user: string, id: string) {
    await this.access.require(user, "PLUS");
    return this.repo.archive(user, id);
  }
  async review(
    user: string,
    id: string,
    input: { requestId: string; version: number; remembered: boolean },
  ) {
    await this.access.require(user, "PLUS");
    return this.repo.review(user, id, input);
  }
  async stats(user: string) {
    await this.access.require(user, "PLUS");
    return this.repo.stats(user);
  }
}
