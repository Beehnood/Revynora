export type AdminFilter = {
  from: Date;
  to: Date;
  page: number;
  search: string;
};
export interface AdminRepository {
  metrics(filter: AdminFilter): Promise<unknown>;
  users(filter: AdminFilter): Promise<unknown>;
  events(filter: AdminFilter): Promise<unknown>;
  offers(): Promise<unknown>;
  disable(actor: string, user: string, disabled: boolean): Promise<unknown>;
}
