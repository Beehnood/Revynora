import { GetEntitlements } from "../billing/application/billing.use-cases";
import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { DatabaseService } from "../database/database.service";
import { ApiError } from "../shared/http/errors";
import { loadEnvironment } from "../shared/config/environment";
import { hashPassword, verifyPassword, DUMMY_HASH } from "./password";
export const publicUser = {
  id: true,
  email: true,
  name: true,
  role: true,
  plan: true,
  createdAt: true,
  disabledAt: true,
  timeZone: true,
  remindersEnabled: true,
} as const;
export const COOKIE = "revynora_session";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Student = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  plan: "FREE" | "PLUS" | "PRO";
};
export type AuthRequest = Request & { student: Student };
@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(GetEntitlements) private readonly access: GetEntitlements,
  ) {}
  private readonly env = loadEnvironment();
  private readonly limits = new Map<string, { count: number; reset: number }>();
  limit(request: Request) {
    const key = digest(request.ip ?? "local");
    const now = Date.now();
    for (const [k, v] of this.limits) if (v.reset < now) this.limits.delete(k);
    if (!this.limits.has(key) && this.limits.size >= 10000)
      throw new ApiError(
        429,
        "AUTH_RATE_LIMIT",
        "Trop de tentatives. Réessayez dans une minute.",
      );
    const limit = this.limits.get(key) ?? { count: 0, reset: now + 60000 };
    limit.count++;
    this.limits.set(key, limit);
    if (limit.count > 20 || this.limits.size > 10000)
      throw new ApiError(
        429,
        "AUTH_RATE_LIMIT",
        "Trop de tentatives. Réessayez dans une minute.",
      );
  }
  private cookie(response: Response, token: string, maxAge: number) {
    response.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge,
    });
  }
  async session(userId: string, response: Response, native = false) {
    const token = randomBytes(32).toString("base64url");
    const maxAge = this.env.SESSION_DAYS * 86400000;
    await this.db.client.session.create({
      data: {
        userId,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + maxAge),
      },
    });
    if (native)
      return { token, expiresAt: new Date(Date.now() + maxAge).toISOString() };
    this.cookie(response, token, maxAge);
    return null;
  }
  async register(
    data: { email: string; name: string; password: string },
    request: Request,
    response: Response,
    native = false,
  ) {
    this.limit(request);
    const passwordHash = await hashPassword(data.password);
    const token = randomBytes(32).toString("base64url");
    const maxAge = this.env.SESSION_DAYS * 86400000;
    const user = await this.db.client.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        sessions: {
          create: {
            tokenHash: digest(token),
            expiresAt: new Date(Date.now() + maxAge),
          },
        },
        subscriptionPeriods: {
          create: {
            subscription: {
              connectOrCreate: {
                where: { code: "FREE" },
                create: {
                  code: "FREE",
                  name: "FREE",
                  priceCents: 0,
                  interval: "none",
                },
              },
            },
            provider: "internal",
            providerSubscriptionId: "free_" + randomUUID(),
            priceCents: 0,
            currency: "eur",
            status: "ACTIVE",
            startsAt: new Date(),
            endsAt: new Date("9999-12-31T00:00:00Z"),
          },
        },
        termsAcceptedAt: new Date(),
        emails: {
          create: {
            kind: "WELCOME",
            subject: "Bienvenue dans Revynora",
            body: "Ton espace personnel est prêt. Commence par un diagnostic ou retrouve tes cours.",
            idempotencyKey: "welcome_" + digest(token),
          },
        },
        role: "STUDENT",
        plan: "FREE",
      },
      select: publicUser,
    });
    if (native)
      return {
        user,
        token,
        expiresAt: new Date(Date.now() + maxAge).toISOString(),
      };
    this.cookie(response, token, maxAge);
    return user;
  }
  async login(
    data: { email: string; password: string },
    request: Request,
    response: Response,
    native = false,
  ) {
    this.limit(request);
    const user = await this.db.client.user.findUnique({
      where: { email: data.email },
    });
    const valid = await verifyPassword(
      data.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid || user.disabledAt)
      throw new ApiError(
        401,
        "AUTH_INVALID",
        "E-mail ou mot de passe incorrect.",
      );
    if (native && user.role !== "STUDENT")
      throw new ApiError(
        403,
        "STUDENT_REQUIRED",
        "L’application mobile est réservée aux étudiants.",
      );
    const credentials = await this.session(user.id, response, native);
    const profile = await this.db.client.user.findUniqueOrThrow({
      where: { id: user.id },
      select: publicUser,
    });
    return native ? { user: profile, ...credentials } : profile;
  }
  token(request: Request) {
    // An invalid bearer never falls back to a browser cookie.
    if (request.headers.authorization !== undefined) {
      const match = /^Bearer ([a-zA-Z0-9_-]{43})$/.exec(
        request.headers.authorization,
      );
      return match?.[1];
    }
    const match = request.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(COOKIE + "="));
    return match?.slice(COOKIE.length + 1);
  }
  async identify(request: Request) {
    const token = this.token(request);
    if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token))
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Connectez-vous pour accéder à votre espace.",
      );
    const session = await this.db.client.session.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: { select: publicUser } },
    });
    if (
      !session ||
      session.user.disabledAt ||
      session.expiresAt.getTime() <= Date.now()
    )
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Votre session a expiré. Reconnectez-vous.",
      );
    return {
      ...session.user,
      plan: (await this.access.execute(session.user.id)).plan,
    };
  }
  async logout(request: Request, response: Response) {
    const token = this.token(request);
    if (token)
      await this.db.client.session.deleteMany({
        where: { tokenHash: digest(token) },
      });
    this.cookie(response, "", 0);
    return { ok: true };
  }
}
