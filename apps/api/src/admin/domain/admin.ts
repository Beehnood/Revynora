import type {
  AdminMetrics,
  AdminSupervision,
  AdminCatalogCourse,
  AdminCatalogCourseDetail,
  AdminStatistics,
  AdminPage,
  AdminUser,
  AdminEvents,
  AdminOffer,
  AdminAccessChange,
} from "@revynora/types";
export type AdminFilter = {
  from: Date;
  to: Date;
  page: number;
  search: string;
};
import type { AdminPayment, AdminSubscriptionPeriod } from "@revynora/types";
import type { PaymentQuery, SubscriptionQuery } from "./finance";
export interface AdminRepository {
  payments(query: PaymentQuery): Promise<AdminPage<AdminPayment>>;
  subscriptions(
    query: SubscriptionQuery,
  ): Promise<AdminPage<AdminSubscriptionPeriod>>;
  supervision(period: { from: Date; to: Date }): Promise<AdminSupervision>;
  catalogCourses(query: {
    page: number;
    search: string;
  }): Promise<AdminPage<AdminCatalogCourse>>;
  catalogCourse(id: string): Promise<AdminCatalogCourseDetail>;
  statistics(period: { from: Date; to: Date }): Promise<AdminStatistics>;
  metrics(filter: AdminFilter): Promise<AdminMetrics>;
  users(filter: AdminFilter): Promise<AdminPage<AdminUser>>;
  user(id: string): Promise<AdminUser>;
  events(filter: AdminFilter): Promise<AdminEvents>;
  offers(): Promise<AdminOffer[]>;
  disable(
    actor: string,
    user: string,
    command: AdminAccessChange,
  ): Promise<{ ok: true }>;
}
