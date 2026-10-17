import { createApiClient, RequestError } from "@revynora/api-client";
import type { MobileSession, UserProfile } from "@revynora/types";
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
}
export function apiUrl(raw: string, development: boolean) {
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "") !== "/api/v1" ||
    (url.protocol !== "https:" && !(development && url.protocol === "http:"))
  )
    throw new Error("Adresse API HTTPS /api/v1 requise.");
  if (
    !development &&
    /^(localhost|127\.|0\.|10\.|192\.168\.|\[?::1\]?)/.test(url.hostname)
  )
    throw new Error("Une API publique HTTPS est requise.");
  return url.toString().replace(/\/$/, "");
}
export class NativeSession {
  private token: string | null = null;
  private readonly transport: ReturnType<typeof createApiClient>;
  private listener: (user: UserProfile | null) => void = () => {};
  constructor(
    baseUrl: string,
    private readonly store: TokenStore,
    fetcher?: typeof fetch,
  ) {
    this.transport = createApiClient({ baseUrl, credentials: "omit", fetcher });
  }
  subscribe(listener: (user: UserProfile | null) => void) {
    this.listener = listener;
    return () => {
      this.listener = () => {};
    };
  }
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const used = this.token;
    try {
      return await this.transport<T>(path, {
        ...options,
        headers: {
          ...options.headers,
          "X-Revynora-Client": "mobile",
          ...(used ? { Authorization: "Bearer " + used } : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof RequestError &&
        error.status === 401 &&
        used === this.token
      ) {
        this.token = null;
        try {
          await this.store.remove();
        } finally {
          this.listener(null);
        }
      }
      throw error;
    }
  }
  async restore() {
    this.token = await this.store.get();
    if (!this.token) {
      this.listener(null);
      return;
    }
    const used = this.token;
    try {
      const user = await this.request<UserProfile>("/users/me");
      if (used === this.token) this.listener(user);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) return;
      throw error;
    }
  }
  async authenticate(mode: "login" | "register", input: unknown) {
    const session = await this.request<MobileSession>("/auth/mobile/" + mode, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (session.user.role !== "STUDENT") {
      await this.transport("/auth/logout", {
        method: "POST",
        headers: {
          "X-Revynora-Client": "mobile",
          Authorization: "Bearer " + session.token,
        },
      });
      throw new Error("Utilise la console Web pour ton compte administrateur.");
    }
    try {
      await this.store.set(session.token);
    } catch (error) {
      await this.transport("/auth/logout", {
        method: "POST",
        headers: {
          "X-Revynora-Client": "mobile",
          Authorization: "Bearer " + session.token,
        },
      }).catch(() => {});
      throw error;
    }
    this.token = session.token;
    const user = await this.request<UserProfile>("/users/me");
    if (this.token === session.token) this.listener(user);
  }
  async refreshUser() {
    const used = this.token;
    const user = await this.request<UserProfile>("/users/me");
    if (used && used === this.token) this.listener(user);
  }
  async logout() {
    await this.request("/auth/logout", { method: "POST" });
    this.token = null;
    try {
      await this.store.remove();
    } finally {
      this.listener(null);
    }
  }
}
