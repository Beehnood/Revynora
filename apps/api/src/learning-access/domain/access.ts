import type { Entitlement } from "../../billing/domain/billing";
export type InternalGrant = {
  id: string;
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};
export type LearningAccount = {
  role: "ADMIN" | "STUDENT";
  disabledAt: Date | null;
  grants: InternalGrant[];
};
export interface LearningAccessRepository {
  account(userId: string, now: Date): Promise<LearningAccount | null>;
}
export function resolveLearningAccess(
  account: LearningAccount | null,
  commercial: Entitlement,
  now: Date,
) {
  const grant =
    account?.role === "ADMIN" && !account.disabledAt
      ? account.grants.find(
          (g) =>
            g.startsAt <= now &&
            (!g.expiresAt || g.expiresAt > now) &&
            !g.revokedAt,
        )
      : undefined;
  const allowed =
    !!account && !account.disabledAt && (account.role === "STUDENT" || !!grant);
  return {
    allowed,
    commercialPlan: commercial.plan,
    effectivePlan: allowed
      ? grant
        ? ("PRO" as const)
        : commercial.plan
      : ("FREE" as const),
    source: grant
      ? ("INTERNAL" as const)
      : allowed
        ? ("COMMERCIAL" as const)
        : ("NONE" as const),
    leitner: allowed && (!!grant || commercial.leitner),
    planning: allowed && (!!grant || commercial.planning),
    internal: grant
      ? {
          startsAt: grant.startsAt.toISOString(),
          expiresAt: grant.expiresAt?.toISOString() ?? null,
        }
      : null,
  };
}

export type GrantInput = {
  startsAt: string;
  expiresAt?: string;
  provenance: string;
  justification: string;
};
export type GrantRecord = {
  id: string;
  userId: string;
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};
export interface InternalGrantRepository {
  list(userId: string, page: number): Promise<GrantRecord[]>;
  issue(
    actorId: string,
    userId: string,
    input: GrantInput,
  ): Promise<GrantRecord>;
  revoke(actorId: string, id: string, reason: string): Promise<GrantRecord>;
}
