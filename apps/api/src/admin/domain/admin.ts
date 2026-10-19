import type {
  AdminMetrics,
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
export interface AdminRepository {
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
