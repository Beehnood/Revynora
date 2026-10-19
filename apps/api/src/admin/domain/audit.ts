import type { AdminAccessReason, AdminAuditRecord } from "@revynora/types";
export type AccessAudit = {
  version: 1;
  action: "USER_DISABLED" | "USER_ENABLED";
  reason: AdminAccessReason;
  result: "SUCCESS" | "REJECTED" | "FAILED";
};
const reasons: readonly string[] = [
  "SECURITY_REVIEW",
  "POLICY_REVIEW",
  "USER_REQUEST",
  "REVIEW_COMPLETED",
];
export function encodeAccessAudit(event: AccessAudit): string {
  return "ADMIN_ACCESS_V1:" + JSON.stringify(event);
}
export function decodeAccessAudit(
  action: string,
): Pick<AdminAuditRecord, "action" | "reason" | "result"> {
  if (action.startsWith("ADMIN_ACCESS_V1:")) {
    try {
      const event: unknown = JSON.parse(
        action.slice("ADMIN_ACCESS_V1:".length),
      );
      if (
        typeof event === "object" &&
        event !== null &&
        "version" in event &&
        event.version === 1 &&
        "action" in event &&
        (event.action === "USER_DISABLED" || event.action === "USER_ENABLED") &&
        "reason" in event &&
        typeof event.reason === "string" &&
        reasons.includes(event.reason) &&
        "result" in event &&
        (event.result === "SUCCESS" ||
          event.result === "REJECTED" ||
          event.result === "FAILED")
      ) {
        // Membership was checked above; no arbitrary text enters the DTO.
        const reason = reasons.find(
          (r) => r === event.reason,
        ) as AdminAccessReason;
        return { action: event.action, reason, result: event.result };
      }
    } catch {
      /* Legacy or malformed entries never break the audit reader. */
    }
    return { action: "UNREADABLE_ADMIN_EVENT", reason: null, result: "LEGACY" };
  }
  return { action, reason: null, result: "LEGACY" };
}
