import type { AdminRole, AdminAccessChange } from "@revynora/types";
import { requireAdminPermission } from "../domain/permissions";
import type { AdminFilter, AdminRepository } from "../domain/admin";
import type { PaymentQuery, SubscriptionQuery } from "../domain/finance";
export class AdminUseCases {
  payments(query: PaymentQuery, role: AdminRole) {
    requireAdminPermission(role, "payments", "read");
    return this.repo.payments(query);
  }
  subscriptions(query: SubscriptionQuery, role: AdminRole) {
    requireAdminPermission(role, "subscriptions", "read");
    return this.repo.subscriptions(query);
  }
  constructor(private readonly repo: AdminRepository) {}
  supervision(period: { from: Date; to: Date }, role: AdminRole) {
    requireAdminPermission(role, "supervision", "read");
    return this.repo.supervision(period);
  }
  catalogCourses(query: { page: number; search: string }, role: AdminRole) {
    requireAdminPermission(role, "catalogCourses", "read");
    return this.repo.catalogCourses(query);
  }
  catalogCourse(id: string, role: AdminRole) {
    requireAdminPermission(role, "catalogCourses", "read");
    return this.repo.catalogCourse(id);
  }
  statistics(period: { from: Date; to: Date }, role: AdminRole) {
    requireAdminPermission(role, "metrics", "read");
    return this.repo.statistics(period);
  }
  metrics(f: AdminFilter, role: AdminRole) {
    requireAdminPermission(role, "metrics", "read");
    return this.repo.metrics(f);
  }
  users(f: AdminFilter, role: AdminRole) {
    requireAdminPermission(role, "users", "read");
    return this.repo.users(f);
  }
  user(id: string, role: AdminRole) {
    requireAdminPermission(role, "users", "read");
    return this.repo.user(id);
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
