// Presentation only: never infer settlement or a currency's unknown minor unit.
export function formatCents(value: string, currency: string) {
  const cents = BigInt(value);
  if (currency.toLowerCase() !== "eur")
    return cents.toString() + " unités stockées (échelle non vérifiée)";
  const abs = cents < 0n ? -cents : cents;
  return (
    (cents < 0n ? "−" : "") +
    (abs / 100n).toString() +
    "," +
    (abs % 100n).toString().padStart(2, "0")
  );
}
export function money(value: string | number, currency: string) {
  return (
    formatCents(String(value), currency) +
    (currency.toLowerCase() === "eur" ? " €" : " " + currency.toUpperCase())
  );
}
export function dateLabel(value: string, time = true) {
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "Date indisponible";
  return (
    date.toLocaleString("fr-FR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
    }) + (time ? " UTC" : "")
  );
}
const labels: Record<string, string> = {
  ALL: "Tous",
  mock: "Simulation",
  stripe: "Stripe",
  internal: "Interne",
  other: "Autre fournisseur",
  FREE: "Free",
  PLUS: "Plus",
  PRO: "Pro",
  ACTIVE: "Actif",
  PAST_DUE: "Paiement en retard",
  CANCELLED: "Annulé",
  INCOMPLETE: "Incomplet",
  PENDING: "En attente",
  PAID: "Marqué payé",
  FAILED: "Échec",
  REFUNDED: "Marqué remboursé",
  SUCCESS: "Réussite",
  ERROR: "Erreur",
  LEGACY: "Historique",
  REJECTED: "Refusé",
  USER_ENABLED: "Compte réactivé",
  USER_DISABLED: "Compte suspendu",
  ADMIN_PROMOTED_CLI: "Attribution du rôle administrateur",
  UNREADABLE_ADMIN_EVENT: "Événement historique illisible",
};
export const label = (value: string) => labels[value] ?? value;
