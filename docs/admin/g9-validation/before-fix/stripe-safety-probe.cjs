// Diagnostic hors ligne : exit 0 confirme les écarts, pas la conformité.
// Lancer depuis la racine du dépôt ; toutes les méthodes SDK utilisées sont simulées.
const fs = require("node:fs");
const Module = require("node:module");
const assert = require("node:assert/strict");
const root = process.cwd();
const ts = require(root + "/node_modules/typescript");
const source =
  root + "/apps/api/src/billing/infrastructure/billing.provider.ts";
const compiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    f,
  );
const mod = new Module(source, module);
mod.filename = source;
mod.paths = Module._nodeModulePaths(require("node:path").dirname(source));
mod._compile(compiled, source);
process.env.STRIPE_SECRET_KEY = "sk_test_offline_probe";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline_probe";
let query;
const db = {
  commercialProviderPrice: {
    findFirst: async (q) => {
      query = q;
      return {
        versionId: "version_other_account",
        accountId: "acct_other",
        version: {
          priceCents: 250,
          currency: "eur",
          features: ["leitner"],
          subscription: { code: "PLUS" },
        },
      };
    },
  },
  userSubscriptionHistory: { findFirst: async () => null },
  user: { findUnique: async () => ({ id: "synthetic" }) },
};
const p = new mod.exports.StripeBillingProvider(db);
let calls = 0;
p.stripe.accounts.retrieve = async () => {
  calls++;
  return { id: "acct_current" };
};
p.stripe.prices.retrieve = async () => ({
  id: "price_probe",
  livemode: false,
  active: true,
  type: "recurring",
  unit_amount: 250,
  currency: "eur",
  billing_scheme: "per_unit",
  recurring: { interval: "month", interval_count: 12, usage_type: "licensed" },
  transform_quantity: null,
  custom_unit_amount: null,
});
p.stripe.customers.create = async () => ({ id: "cus_synthetic" });
p.stripe.checkout.sessions.create = async () => ({
  id: "cs_synthetic",
  url: "https://example.test/checkout",
});
p.stripe.subscriptions.retrieve = async () => ({
  id: "sub_synthetic",
  customer: "cus_synthetic",
  livemode: false,
  status: "active",
  latest_invoice: "in_synthetic",
  items: {
    data: [
      {
        price: { id: "price_probe", unit_amount: 250, currency: "eur" },
        current_period_start: 100,
        current_period_end: 200,
      },
    ],
  },
});
p.stripe.invoices.retrieve = async () => ({
  id: "in_synthetic",
  status: "paid",
});
(async () => {
  const checkout = await p.checkout({
    intentId: "synthetic",
    userId: "synthetic",
    email: "synthetic@example.test",
    customerId: null,
    plan: "PLUS",
    priceCents: 250,
    currency: "eur",
    providerPriceId: "price_probe",
    commercialVersionId: "version",
  });
  assert.equal(checkout.id, "cs_synthetic");
  console.log(
    "FINDING: checkout accepts a 12-month interval_count despite a monthly commercial quote. All SDK calls replaced locally.",
  );
  p.stripe.prices.retrieve = async () => ({
    id: "price_probe",
    livemode: false,
    active: false,
    type: "recurring",
    unit_amount: 250,
    currency: "eur",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  });
  p.stripe.subscriptionSchedules.create = async () => ({
    id: "schedule_synthetic",
  });
  p.stripe.subscriptionSchedules.update = async () => ({});
  await p.changePlan("sub_synthetic", "PLUS", {
    priceCents: 250,
    currency: "eur",
    providerPriceId: "price_probe",
    commercialVersionId: "version",
  });
  console.log(
    "FINDING: changePlan accepts an inactive provider price before calling the synthetic schedule methods.",
  );
  const snapshot = await p.reconcile({
    id: "evt_synthetic",
    type: "customer.subscription.updated",
    created: 1,
    subscriptionId: "sub_synthetic",
  });
  assert.equal(snapshot.commercialVersionId, "version_other_account");
  assert.equal(calls, 0);
  assert.equal(query.where.accountId, undefined);
  console.log(
    "FINDING: reconciliation uses binding from acct_other without checking current account; binding query has no accountId. All SDK calls replaced locally.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
