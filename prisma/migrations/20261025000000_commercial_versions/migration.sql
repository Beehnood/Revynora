-- G.9 additive evolution. Never alters historical amounts or grants a capability.
ALTER TABLE "Subscription" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "currentVersionId" TEXT;
ALTER TABLE "UserSubscriptionHistory" ADD COLUMN "commercialVersionId" TEXT, ADD COLUMN "contractEvidence" TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED', ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CheckoutIntent" ADD COLUMN "commercialVersionId" TEXT, ADD COLUMN "acceptedPriceCents" INTEGER, ADD COLUMN "acceptedCurrency" TEXT, ADD COLUMN "acceptedInterval" TEXT, ADD COLUMN "acceptedFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "acceptedProviderPriceId" TEXT;
CREATE TABLE "CommercialPermission" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "provenance" TEXT NOT NULL CHECK(length("provenance") BETWEEN 10 AND 500)
);
CREATE TABLE "CommercialOfferVersion" (
 "id" TEXT PRIMARY KEY, "subscriptionId" TEXT NOT NULL REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "number" INTEGER NOT NULL, "basedOnRevision" INTEGER NOT NULL, "name" TEXT NOT NULL,
 "priceCents" INTEGER NOT NULL CHECK("priceCents" BETWEEN 0 AND 1000000), "currency" TEXT NOT NULL CHECK("currency"='eur'),
 "interval" TEXT NOT NULL CHECK("interval" IN ('none','month')), "active" BOOLEAN NOT NULL,
 "features" TEXT[] NOT NULL, "reason" TEXT NOT NULL, "createdById" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "state" TEXT NOT NULL DEFAULT 'DRAFT' CHECK("state" IN ('DRAFT','PUBLISHED')),
 CONSTRAINT "CommercialOfferVersion_subscriptionId_number_key" UNIQUE("subscriptionId","number"),
 CHECK("number">0 AND "basedOnRevision">=0), CHECK(length("reason") BETWEEN 10 AND 500),
 CHECK("features" <@ ARRAY['leitner','planning','reminders']::TEXT[]),
 CHECK(NOT ('reminders'=ANY("features")) OR 'planning'=ANY("features")),
 CHECK(NOT ('planning'=ANY("features")) OR 'leitner'=ANY("features"))
);
CREATE TABLE "CommercialProviderPrice" (
 "id" TEXT PRIMARY KEY, "versionId" TEXT NOT NULL REFERENCES "CommercialOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "provider" TEXT NOT NULL CHECK("provider"='stripe'), "environment" TEXT NOT NULL CHECK("environment"='test'),
 "accountId" TEXT NOT NULL, "priceId" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "verifiedById" TEXT NOT NULL,
 CONSTRAINT "CommercialProviderPrice_provider_environment_accountId_priceId_key" UNIQUE("provider","environment","accountId","priceId"),
 CONSTRAINT "CommercialProviderPrice_versionId_provider_key" UNIQUE("versionId","provider")
);
CREATE TABLE "CommercialAudit" (
 "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL,
 "versionId" TEXT NOT NULL, "beforeVersionId" TEXT, "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Subscription_currentVersionId_key" ON "Subscription"("currentVersionId");
ALTER TABLE "UserSubscriptionHistory" ADD CONSTRAINT "UserSubscriptionHistory_commercialVersionId_fkey" FOREIGN KEY("commercialVersionId") REFERENCES "CommercialOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_commercialVersionId_fkey" FOREIGN KEY("commercialVersionId") REFERENCES "CommercialOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Capture catalogue state only. This is not proof of a past payment or contract.
INSERT INTO "CommercialOfferVersion" ("id","subscriptionId","number","basedOnRevision","name","priceCents","currency","interval","active","features","reason","state")
 SELECT md5(id||':g9-catalogue')::uuid::text,id,1,0,name,"priceCents",currency,interval,active,
 CASE code WHEN 'PRO' THEN ARRAY['leitner','planning','reminders'] WHEN 'PLUS' THEN ARRAY['leitner'] ELSE ARRAY[]::TEXT[] END,
 'Initialisation du catalogue existant, sans preuve contractuelle historique','PUBLISHED' FROM "Subscription";
UPDATE "Subscription" SET "currentVersionId"=md5(id||':g9-catalogue')::uuid::text;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_currentVersionId_fkey" FOREIGN KEY("currentVersionId") REFERENCES "CommercialOfferVersion"("id") ON DELETE RESTRICT;
CREATE FUNCTION g9_immutable_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD."state"='PUBLISHED' THEN RAISE EXCEPTION 'Commercial versions are immutable'; END IF;
 IF NEW."state"<>'PUBLISHED' OR (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') THEN RAISE EXCEPTION 'Only publication of an unchanged draft is allowed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER g9_immutable_version BEFORE UPDATE OR DELETE ON "CommercialOfferVersion" FOR EACH ROW EXECUTE FUNCTION g9_immutable_version();
CREATE FUNCTION g9_immutable_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Verified provider bindings are immutable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "CommercialOfferVersion" WHERE id=NEW."versionId" AND state='DRAFT') THEN RAISE EXCEPTION 'Bind a draft before publication'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER g9_immutable_binding BEFORE INSERT OR UPDATE OR DELETE ON "CommercialProviderPrice" FOR EACH ROW EXECUTE FUNCTION g9_immutable_binding();
CREATE FUNCTION g9_immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Commercial audit is append only'; END $$;
CREATE TRIGGER g9_immutable_audit BEFORE UPDATE OR DELETE ON "CommercialAudit" FOR EACH ROW EXECUTE FUNCTION g9_immutable_audit();
-- Status and end dates may reconcile, but an accepted monetary/capability snapshot cannot be rewritten.
CREATE FUNCTION g9_contract_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW."priceCents",NEW.currency,NEW."commercialVersionId",NEW.features,NEW."contractEvidence") IS DISTINCT FROM
    (OLD."priceCents",OLD.currency,OLD."commercialVersionId",OLD.features,OLD."contractEvidence") THEN
  RAISE EXCEPTION 'Contract snapshots are immutable; reconcile evidence separately';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER g9_contract_snapshot BEFORE UPDATE ON "UserSubscriptionHistory" FOR EACH ROW EXECUTE FUNCTION g9_contract_snapshot();
CREATE FUNCTION g9_checkout_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.plan,NEW.provider,NEW."commercialVersionId",NEW."acceptedPriceCents",NEW."acceptedCurrency",NEW."acceptedInterval",NEW."acceptedFeatures",NEW."acceptedProviderPriceId") IS DISTINCT FROM
    (OLD.plan,OLD.provider,OLD."commercialVersionId",OLD."acceptedPriceCents",OLD."acceptedCurrency",OLD."acceptedInterval",OLD."acceptedFeatures",OLD."acceptedProviderPriceId") THEN
  RAISE EXCEPTION 'Checkout acceptance is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER g9_checkout_snapshot BEFORE UPDATE ON "CheckoutIntent" FOR EACH ROW EXECUTE FUNCTION g9_checkout_snapshot();
