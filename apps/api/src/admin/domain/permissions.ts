import type { AdminRole } from "@revynora/types";
import { DomainError } from "../../shared/domain/errors";

// Only implemented capabilities are granted. Future resources stay denied.
export const adminPermissions = {
  users: ["read", "suspend", "reactivate"],
  metrics: ["read"],
  events: ["read"],
  offers: ["read"],
  audit: ["read"],
  courses: [],
  catalogCourses: ["read"],
  supervision: ["read"],
  ai: [],
  leitner: [],
  planning: [],
  subscriptions: ["read"],
  payments: ["read"],
  settings: [],
  internalLearningGrants: ["read", "create", "revoke"],
} as const;
export type AdminResource = keyof typeof adminPermissions;
export function requireAdminPermission(
  role: AdminRole,
  resource: AdminResource,
  action: string,
) {
  const actions: readonly string[] = adminPermissions[resource];
  if (role !== "ADMIN" || !actions.includes(action))
    throw new DomainError(
      403,
      "ADMIN_REQUIRED",
      "Action administrative interdite.",
    );
}
