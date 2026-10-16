import type { AdminFilter, AdminRepository } from "../domain/admin";
export class AdminUseCases {
  constructor(private readonly repo: AdminRepository) {}
  metrics(f: AdminFilter) {
    return this.repo.metrics(f);
  }
  users(f: AdminFilter) {
    return this.repo.users(f);
  }
  events(f: AdminFilter) {
    return this.repo.events(f);
  }
  offers() {
    return this.repo.offers();
  }
  disable(actor: string, user: string, disabled: boolean) {
    return this.repo.disable(actor, user, disabled);
  }
}
