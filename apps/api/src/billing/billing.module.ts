import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { PrismaBillingRepository } from "./infrastructure/prisma-billing.repository";
import {
  MockBillingProvider,
  StripeBillingProvider,
} from "./infrastructure/billing.provider";
import {
  BILLING_PROVIDER,
  BILLING_REPOSITORY,
  type BillingProvider,
  type BillingRepository,
} from "./domain/billing";
import {
  BillingUseCases,
  GetEntitlements,
  ProcessBillingWebhook,
} from "./application/billing.use-cases";
@Global()
@Module({
  providers: [
    {
      provide: BILLING_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) =>
        new PrismaBillingRepository(db.client),
    },
    {
      provide: BILLING_PROVIDER,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => {
        const provider = process.env.BILLING_PROVIDER ?? "mock";
        if (provider === "stripe") return new StripeBillingProvider(db.client);
        if (provider !== "mock") throw new Error("Invalid BILLING_PROVIDER");
        return new MockBillingProvider(db.client);
      },
    },
    {
      provide: GetEntitlements,
      inject: [BILLING_REPOSITORY],
      useFactory: (repo: BillingRepository) => new GetEntitlements(repo),
    },
    {
      provide: BillingUseCases,
      inject: [BILLING_REPOSITORY, BILLING_PROVIDER, GetEntitlements],
      useFactory: (
        repo: BillingRepository,
        provider: BillingProvider,
        access: GetEntitlements,
      ) => new BillingUseCases(repo, provider, access),
    },
    {
      provide: ProcessBillingWebhook,
      inject: [BILLING_REPOSITORY, BILLING_PROVIDER],
      useFactory: (repo: BillingRepository, provider: BillingProvider) =>
        new ProcessBillingWebhook(repo, provider),
    },
  ],
  exports: [
    GetEntitlements,
    BillingUseCases,
    ProcessBillingWebhook,
    BILLING_PROVIDER,
  ],
})
export class BillingModule {}
