import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Confidentialité · Revynora" };
export default function Page() {
  return (
    <main id="main" className="container section">
      <Link href="/">← Revynora</Link>
      <h1>Confidentialité</h1>
      <p>Version locale de développement · 16 octobre 2026.</p>
      <h2>Les données de ton espace</h2>
      <p>
        Revynora enregistre ton nom, ton e-mail, un mot de passe haché, tes
        diagnostics, réponses, cours, cartes, séances et préférences. Ces
        données servent à fournir ton parcours personnel. Le cookie de session
        HttpOnly permet de rester connecté. Cette version n’utilise ni publicité
        ni cookie analytique.
      </p>
      <h2>Services configurables</h2>
      <p>
        Par défaut, l’IA et la facturation sont simulées et les e-mails restent
        dans la boîte locale. Si OpenAI, Stripe test ou SMTP sont configurés par
        l’opérateur, les données nécessaires au service sont transmises au
        fournisseur concerné : sujet du diagnostic, informations de facturation
        ou adresse e-mail et message.
      </p>
      <h2>Rappels facultatifs</h2>
      <p>
        Les rappels sont désactivés par défaut. L’activation nécessite ton
        consentement dans Notifications. Tu peux le retirer dans le même écran.
        Les messages relatifs au compte et à la facturation restent distincts
        des rappels.
      </p>
      <h2>Exporter et supprimer</h2>
      <p>
        Depuis Mon profil, tu peux télécharger tes données en JSON ou supprimer
        ton compte après vérification de ton mot de passe. Les contenus
        pédagogiques et les sessions sont supprimés. Les écritures financières
        sont conservées sans lien avec ton compte.
      </p>
      <h2>Avant une ouverture publique</h2>
      <p>
        Cette version n’est pas hébergée publiquement. L’identité et le contact
        de l’opérateur, les durées de conservation, les prestataires réellement
        utilisés et les modalités de demande devront être renseignés avant son
        ouverture.
      </p>
      <Link href="/app/profil">Gérer mes données</Link>
    </main>
  );
}
