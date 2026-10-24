-- FREE has no billing interval and never creates a payment.
INSERT INTO "Subscription" (id,code,name,"priceCents",currency,interval,active)
VALUES ('catalog-free-initial','FREE','FREE',0,'eur','none',true)
ON CONFLICT(code) DO UPDATE SET interval='none';
-- Backfill only the initial Free interval, preserving existing paid periods.
INSERT INTO "UserSubscriptionHistory" (id,"userId","subscriptionId",provider,"providerSubscriptionId","priceCents",currency,status,"startsAt","endsAt","cancelAtPeriodEnd","createdAt")
SELECT 'initial-free-'||u.id,u.id,s.id,'internal','free_'||u.id,0,'eur','ACTIVE',u."createdAt",
 COALESCE((SELECT MIN(h."startsAt") FROM "UserSubscriptionHistory" h WHERE h."userId"=u.id AND h.provider<>'internal' AND h.status='ACTIVE' AND h."startsAt">u."createdAt"),'9999-12-31'::timestamp),false,u."createdAt"
FROM "User" u CROSS JOIN "Subscription" s
WHERE s.code='FREE' AND NOT EXISTS (SELECT 1 FROM "UserSubscriptionHistory" h WHERE h."userId"=u.id AND h.provider='internal');
