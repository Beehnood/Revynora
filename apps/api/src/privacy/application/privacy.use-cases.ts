import type { PrivacyRepository } from "../domain/privacy";
export class PrivacyUseCases {
  constructor(private readonly repo: PrivacyRepository) {}
  export(user: string) {
    return this.repo.export(user);
  }
  remove(user: string, password: string) {
    return this.repo.remove(user, password);
  }
}
