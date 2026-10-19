export type AdminRole = "STUDENT" | "ADMIN";
export type AdminAccessReason =
  | "SECURITY_REVIEW"
  | "POLICY_REVIEW"
  | "USER_REQUEST"
  | "REVIEW_COMPLETED";
export type AdminAccessChange = {
  disabled: boolean;
  confirmed: true;
  reason: AdminAccessReason;
};
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  disabledAt: string | null;
  createdAt: string;
};
export type AdminPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type AdminMetrics = {
  users: number;
  newUsers: number;
  from: string;
  to: string;
  billingMode: string;
  workerEnabled: boolean;
  payments: {
    provider: string;
    status: string;
    _sum: { amountCents: number | null };
    _count: number;
  }[];
  ai: {
    _count: number;
    _sum: {
      estimatedCostUsd: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
    };
  };
  subscriptions: { status: string; _count: number }[];
};
export type AdminOffer = {
  code: "FREE" | "PLUS" | "PRO";
  name: string;
  priceCents: number;
  currency: string;
  active: boolean;
};
export type AdminAuditRecord = {
  id: string;
  actorId: string | null;
  targetUserId: string | null;
  action: string;
  reason: AdminAccessReason | null;
  result: "SUCCESS" | "REJECTED" | "FAILED" | "LEGACY";
  createdAt: string;
};
export type AdminEvents = AdminPage<{
  id: string;
  eventType: string;
  status: string;
  amountCents: number | null;
  createdAt: string;
}> & { audit: AdminAuditRecord[] };
