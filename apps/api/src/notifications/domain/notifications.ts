export interface PreferenceRepository {
  preferences(userId: string): Promise<unknown>;
  update(userId: string, enabled: boolean, timeZone: string): Promise<unknown>;
  inbox(userId: string): Promise<unknown>;
}
