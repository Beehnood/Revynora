import type { AdminRole, AdminAccessChange } from "@revynora/types";
import { requireAdminPermission } from "../domain/permissions";
import type { AdminFilter, AdminRepository } from "../domain/admin";
export class AdminUseCases {
  constructor(private readonly repo: AdminRepository) {}
  metrics(f: AdminFilter, role: AdminRole) {
    requireAdminPermission(role, "metrics", "read");
    return this.repo.metrics(f);
  }
  users(f: AdminFilter, role: AdminRole) {
    requireAdminPermission(role, "users", "read");
    return this.repo.users(f);
  }
  events(f: AdminFilter, role: AdminRole) {
    requireAdminPermission(role, "events", "read");
    return this.repo.events(f);
  }
  offers(role: AdminRole) {
    requireAdminPermission(role, "offers", "read");
    return this.repo.offers();
  }
  disable(
    actor: { id: string; role: AdminRole },
    user: string,
    command: AdminAccessChange,
  ) {
    requireAdminPermission(
      actor.role,
      "users",
      command.disabled ? "suspend" : "reactivate",
    );
    return this.repo.disable(actor.id, user, command);
  }
}
