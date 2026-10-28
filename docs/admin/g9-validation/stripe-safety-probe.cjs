// Régression hors ligne : exit 0 confirme les trois refus avant mutation.
// Le diagnostic historique est conservé dans before-fix/stripe-safety-probe.cjs.
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
let foreignBinding = false;
let mutations = 0;
const quote = {
  commercialVersionId: "version",
  providerPriceId: "price_probe",
  priceCents: 250,
  currency: "eur",
  interval: "month",
};
const binding = {
  versionId: "version",
  priceId: "price_probe",
  accountId: "acct_current",
  provider: "stripe",
  environment: "test",
  version: {
    ...quote,
    state: "PUBLISHED",
    features: ["leitner"],
    subscription: { code: "PLUS" },
  },
};
const db = {
  commercialProviderPrice: {
    findFirst: async () => ({
      ...binding,
      accountId: foreignBinding ? "acct_other" : "acct_current",
    }),
  },
  userSubscriptionHistory: { findFirst: async () => null },
  user: { findUnique: async () => ({ id: "synthetic" }) },
};
const p = new mod.exports.StripeBillingProvider(db);
p.stripe.accounts.retrieve = async () => ({ id: "acct_current" });
const monthlyPrice = {
  id: "price_probe",
  livemode: false,
  active: true,
  type: "recurring",
  unit_amount: 250,
  currency: "eur",
  billing_scheme: "per_unit",
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  transform_quantity: null,
  custom_unit_amount: null,
};
p.stripe.prices.retrieve = async () => ({
  ...monthlyPrice,
  recurring: { ...monthlyPrice.recurring, interval_count: 12 },
});
const rejectMutation = async () => {
  mutations++;
  throw new Error("Unexpected synthetic mutation");
};
p.stripe.customers.create = rejectMutation;
p.stripe.checkout.sessions.create = rejectMutation;
p.stripe.subscriptionSchedules.create = rejectMutation;
p.stripe.subscriptionSchedules.update = rejectMutation;
p.stripe.subscriptions.retrieve = async () => ({
  id: "sub_synthetic",
  customer: "cus_synthetic",
  livemode: false,
  status: "active",
  latest_invoice: null,
  metadata: { commercialVersionId: "version" },
  items: {
    data: [
      {
        quantity: 1,
        price: monthlyPrice,
        current_period_start: 100,
        current_period_end: 200,
      },
    ],
  },
});
(async () => {
  await assert.rejects(
    p.checkout({
      ...quote,
      intentId: "synthetic",
      userId: "synthetic",
      email: "synthetic@example.test",
      customerId: null,
      plan: "PLUS",
    }),
    /Invalid test price/,
  );
  p.stripe.prices.retrieve = async () => ({ ...monthlyPrice, active: false });
  await assert.rejects(
    p.changePlan("sub_synthetic", "PLUS", quote),
    /Invalid test price/,
  );
  foreignBinding = true;
  await assert.rejects(
    p.reconcile({
      id: "evt_synthetic",
      accountId: "acct_current",
      type: "customer.subscription.updated",
      created: 1,
      subscriptionId: "sub_synthetic",
    }),
    /binding account or environment mismatch/,
  );
  assert.equal(mutations, 0);
  console.log(
    "PASS: interval_count=12, inactive new price and foreign-account binding refused; zero provider mutation; every SDK method used is simulated.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
