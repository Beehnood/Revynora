import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { DatabaseService } from "../database/database.service";
import { DomainError, missing } from "../shared/domain/errors";
import { validateOffer, type CommercialDraft } from "./domain";
import { compatibleStripePrice } from "../billing/infrastructure/stripe-price";
@Injectable()
export class CommercialCatalogService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  private get db() {
    return this.database.client;
  }
  async authorize(
    userId: string,
    db: Prisma.TransactionClient | PrismaClient = this.db,
  ) {
    if (db !== this.db) {
      await db.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR SHARE`;
      await db.$queryRaw`SELECT "userId" FROM "CommercialPermission" WHERE "userId"=${userId} FOR SHARE`;
    }
    const u = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, disabledAt: true, commercialPermission: true },
    });
    if (!u || u.role !== "ADMIN" || u.disabledAt || !u.commercialPermission)
      throw new DomainError(
        403,
        "COMMERCIAL_PERMISSION_REQUIRED",
        "Permission explicite de gestion commerciale requise.",
      );
  }
  async list(actor: string) {
    await this.authorize(actor);
    const offers = await this.db.subscription.findMany({
      orderBy: { code: "asc" },
      include: {
        versions: { orderBy: { number: "desc" }, include: { bindings: true } },
      },
    });
    const starts = await this.db.commercialAudit.findMany({
      where: {
        action: "DRAFT_CREATED",
        versionId: { in: offers.flatMap((o) => o.versions.map((v) => v.id)) },
      },
      select: { versionId: true, beforeVersionId: true },
    });
    const baseline = new Map(
      starts.map((a) => [a.versionId, a.beforeVersionId]),
    );
    return offers.map((o) => ({
      ...o,
      versions: o.versions.map((v) => ({
        ...v,
        basedOnVersionId: baseline.get(v.id) ?? null,
      })),
    }));
  }
  async history(actor: string, page: number) {
    await this.authorize(actor);
    return this.db.commercialAudit.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 20,
    });
  }
  async draft(actor: string, id: string, input: CommercialDraft) {
    return this.db.$transaction(async (tx) => {
      await this.authorize(actor, tx);
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id=${id} FOR UPDATE`;
      const offer = await tx.subscription.findUnique({ where: { id } });
      if (!offer) throw missing();
      if (offer.revision !== input.expectedRevision)
        throw new DomainError(
          409,
          "COMMERCIAL_CONFLICT",
          "Le catalogue a changé. Rechargez avant de continuer.",
        );
      validateOffer(offer.code, input);
      const last = await tx.commercialOfferVersion.findFirst({
        where: { subscriptionId: id },
        orderBy: { number: "desc" },
      });
      const { expectedRevision, ...data } = input;
      const v = await tx.commercialOfferVersion.create({
        data: {
          ...data,
          subscriptionId: id,
          number: (last?.number ?? 0) + 1,
          basedOnRevision: expectedRevision,
          createdById: actor,
        },
      });
      await tx.commercialAudit.create({
        data: {
          actorId: actor,
          action: "DRAFT_CREATED",
          subscriptionId: id,
          versionId: v.id,
          beforeVersionId: offer.currentVersionId,
          reason: input.reason,
        },
      });
      return v;
    });
  }
  stripeClient(key: string) {
    return new Stripe(key);
  }
  async verifyStripe(actor: string, versionId: string, priceId: string) {
    await this.authorize(actor);
    const v = await this.db.commercialOfferVersion.findUnique({
      where: { id: versionId },
    });
    if (!v) throw missing();
    if (v.state !== "DRAFT")
      throw new DomainError(409, "IMMUTABLE_VERSION", "Version déjà publiée.");
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    if (!key.startsWith("sk_test_"))
      throw new DomainError(
        422,
        "STRIPE_TEST_REQUIRED",
        "Vérification disponible uniquement avec Stripe test.",
      );
    // Read-only provider calls. Never create/update Products, Prices or bank settings.
    let accountId: string;
    try {
      const stripe = this.stripeClient(key);
      const [p, account] = await Promise.all([
        stripe.prices.retrieve(priceId),
        stripe.accounts.retrieve(),
      ]);
      if (!account.id || p.id !== priceId || !compatibleStripePrice(p, v))
        throw new Error("incompatible");
      accountId = account.id;
    } catch {
      throw new DomainError(
        422,
        "UNVERIFIED_PROVIDER_PRICE",
        "Prix Stripe test inaccessible ou incompatible.",
      );
    }
    return this.db.$transaction(async (tx) => {
      await this.authorize(actor, tx);
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id=${v.subscriptionId} FOR UPDATE`;
      const fresh = await tx.commercialOfferVersion.findUniqueOrThrow({
        where: { id: versionId },
      });
      if (fresh.state !== "DRAFT")
        throw new DomainError(
          409,
          "IMMUTABLE_VERSION",
          "Version déjà publiée.",
        );
      // Price identity is permanent: reuse an existing version for historical contracts.
      const existing = await tx.commercialProviderPrice.findFirst({
        where: {
          OR: [
            { versionId, provider: "stripe" },
            { provider: "stripe", environment: "test", accountId, priceId },
          ],
        },
      });
      if (existing) {
        if (
          existing.versionId === versionId &&
          existing.priceId === priceId &&
          existing.accountId === accountId
        )
          return existing;
        throw new DomainError(
          409,
          "PROVIDER_PRICE_CONFLICT",
          "Association fournisseur déjà utilisée.",
        );
      }
      const binding = await tx.commercialProviderPrice.create({
        data: {
          versionId,
          provider: "stripe",
          environment: "test",
          accountId,
          priceId,
          verifiedById: actor,
        },
      });
      await tx.commercialAudit.create({
        data: {
          actorId: actor,
          action: "PRICE_VERIFIED",
          subscriptionId: v.subscriptionId,
          versionId,
          reason: v.reason,
        },
      });
      return binding;
    });
  }
  async publish(
    actor: string,
    id: string,
    expectedRevision: number,
    confirmVersionId: string,
  ) {
    if (id !== confirmVersionId)
      throw new DomainError(
        422,
        "CONFIRMATION_REQUIRED",
        "Confirmez la version affichée.",
      );
    return this.db.$transaction(async (tx) => {
      await this.authorize(actor, tx);
      const v = await tx.commercialOfferVersion.findUnique({
        where: { id },
        include: { bindings: true },
      });
      if (!v) throw missing();
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id=${v.subscriptionId} FOR UPDATE`;
      const offer = await tx.subscription.findUniqueOrThrow({
        where: { id: v.subscriptionId },
      });
      if (
        v.state !== "DRAFT" ||
        v.basedOnRevision !== expectedRevision ||
        offer.revision !== expectedRevision
      )
        throw new DomainError(
          409,
          "COMMERCIAL_CONFLICT",
          "Version obsolète ou déjà publiée.",
        );
      validateOffer(offer.code, v);
      if (
        process.env.BILLING_PROVIDER === "stripe" &&
        v.active &&
        offer.code !== "FREE" &&
        !v.bindings.some(
          (b) => b.provider === "stripe" && b.environment === "test",
        )
      )
        throw new DomainError(
          422,
          "PROVIDER_PRICE_REQUIRED",
          "Associez un prix Stripe test vérifié avant publication.",
        );
      await tx.commercialOfferVersion.update({
        where: { id },
        data: { state: "PUBLISHED" },
      });
      const result = await tx.subscription.update({
        where: { id: offer.id },
        data: {
          currentVersionId: id,
          revision: { increment: 1 },
          name: v.name,
          priceCents: v.priceCents,
          currency: v.currency,
          interval: v.interval,
          active: v.active,
        },
      });
      await tx.commercialAudit.create({
        data: {
          actorId: actor,
          action: "VERSION_PUBLISHED",
          subscriptionId: offer.id,
          versionId: id,
          beforeVersionId: offer.currentVersionId,
          reason: v.reason,
        },
      });
      return result;
    });
  }
}
