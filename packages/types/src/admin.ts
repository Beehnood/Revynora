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

export type AdminStatistics = {
  from: string;
  to: string;
  timeZone: "UTC";
  registrations: { date: string; count: number }[];
  subscriptions: {
    offer: "FREE" | "PLUS" | "PRO";
    status: string;
    periods: number;
  }[];
  ai: {
    provider: string;
    status: string;
    requests: number;
    inputTokens: string;
    outputTokens: string;
    estimatedCostUsd: string | null;
    estimatedRequests: number;
  }[];
  payments: {
    provider: string;
    environment: "SIMULATION" | "UNVERIFIED";
    currency: string;
    status: string;
    count: number;
    amountCents: string;
  }[];
  billedAiCostUsd: null;
};

export type AdminCatalogCourse = {
  id: string;
  title: string;
  domain: string;
  source: "ADMIN";
  createdAt: string;
};
export type AdminCatalogCourseDetail = AdminCatalogCourse & { content: string };
