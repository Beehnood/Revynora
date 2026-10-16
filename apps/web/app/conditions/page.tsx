import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Conditions · Revynora" };
export default function Page() {
  return (
    <main id="main" className="container section">
      <Link href="/">← Revynora</Link>
      <h1>Conditions d’utilisation de la version locale</h1>
      <p>Version du 16 octobre 2026.</p>
      <h2>Apprendre avec Revynora</h2>
      <p>
        Le service propose des diagnostics, des cours, des révisions Leitner et
        un planning. Les réponses générées par IA peuvent comporter des erreurs
        : vérifie les notions avec tes supports pédagogiques. N’insère pas de
        données sensibles dans tes diagnostics.
      </p>
      <h2>Offres</h2>
      <p>
        Free : 0 €. Plus : 2,50 € par mois avec Leitner. Pro : 5 € par mois avec
        planning et rappels facultatifs. Les paiements sont simulés ou exécutés
        dans Stripe test. Aucun débit réel n’est prévu dans cette version. Les
        droits payants dépendent d’une confirmation vérifiée côté serveur, puis
        de la validité de la période.
      </p>
      <h2>Compte personnel</h2>
      <p>
        Conserve ton mot de passe privé et utilise le service pour tes propres
        apprentissages. Tu peux exporter tes données et supprimer ton compte
        depuis Mon profil.
      </p>
      <h2>Statut du projet</h2>
      <p>
        Cette version est destinée à une recette locale. Les informations
        légales de l’opérateur et les conditions commerciales complètes restent
        à finaliser avant toute ouverture publique.
      </p>
      <Link href="/confidentialite">Lire la confidentialité</Link>
    </main>
  );
}
