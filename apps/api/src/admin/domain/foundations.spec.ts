import { describe, it, expect } from "vitest";
import { adminAccessChangeSchema } from "@revynora/validation";
import { adminPermissions, requireAdminPermission } from "./permissions";
import { decodeAccessAudit, encodeAccessAudit } from "./audit";
describe("Admin foundations", () => {
  it("refuse chaque permission étudiant et les futures capacités Admin", () => {
    for (const resource of Object.keys(
      adminPermissions,
    ) as (keyof typeof adminPermissions)[]) {
      expect(() =>
        requireAdminPermission("STUDENT", resource, "read"),
      ).toThrow();
      if (adminPermissions[resource].length === 0)
        expect(() =>
          requireAdminPermission("ADMIN", resource, "read"),
        ).toThrow();
    }
    for (const action of ["read", "suspend", "reactivate"])
      expect(() =>
        requireAdminPermission("ADMIN", "users", action),
      ).not.toThrow();
    expect(() => requireAdminPermission("ADMIN", "users", "delete")).toThrow();
  });
  it("exige confirmation, motif contrôlé et refuse les champs supplémentaires", () => {
    const valid = {
      disabled: true,
      confirmed: true,
      reason: "SECURITY_REVIEW",
    };
    expect(adminAccessChangeSchema.safeParse(valid).success).toBe(true);
    for (const body of [
      { disabled: true },
      { ...valid, confirmed: false },
      { ...valid, reason: "secret" },
      { ...valid, role: "ADMIN" },
    ])
      expect(adminAccessChangeSchema.safeParse(body).success).toBe(false);
  });
  it("lit les résultats versionnés, historiques et corrompus sans exposer leur contenu", () => {
    for (const result of ["SUCCESS", "REJECTED", "FAILED"] as const) {
      const event = {
        version: 1,
        action: "USER_DISABLED",
        reason: "USER_REQUEST",
        result,
      } as const;
      expect(decodeAccessAudit(encodeAccessAudit(event))).toEqual({
        action: event.action,
        reason: event.reason,
        result,
      });
    }
    expect(decodeAccessAudit("USER_ENABLED")).toEqual({
      action: "USER_ENABLED",
      reason: null,
      result: "LEGACY",
    });
    expect(
      decodeAccessAudit('ADMIN_ACCESS_V1:{"secret":"hidden"}').action,
    ).toBe("UNREADABLE_ADMIN_EVENT");
    expect(decodeAccessAudit("ADMIN_ACCESS_V1:invalid").result).toBe("LEGACY");
  });
});
