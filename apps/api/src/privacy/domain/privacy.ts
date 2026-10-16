export interface PrivacyRepository {
  export(user: string): Promise<unknown>;
  remove(user: string, password: string): Promise<unknown>;
}
