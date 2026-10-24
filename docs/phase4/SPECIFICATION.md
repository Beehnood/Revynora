# REVYNORA — Phase 4 : Déploiement et application Mobile

Tu es un ingénieur senior Full-Stack, DevOps et React Native spécialisé dans Next.js, NestJS, PostgreSQL, Prisma, Docker, GitHub Actions, Expo et EAS Build.

## Mission

Notre application SaaS éducative Revynora a terminé la Phase 3.

Nous voulons désormais :

1. Héberger le Backend sur Oracle Cloud.
2. Déployer le Frontend Web et le Dashboard Admin sur Vercel.
3. Finaliser l'application Mobile React Native / Expo.
4. Installer une version de test sur de vrais téléphones Android et iOS.
5. Vérifier la synchronisation des données entre Web et Mobile.

Ne réécris pas les modules existants. Ne commence pas de nouvelle architecture et ne remplace pas les technologies déjà utilisées.

## Étape 1 — Audit technique

Analyse entièrement le monorepo :

- `apps/api`
- `apps/web`
- `apps/admin`
- `apps/mobile`
- `packages/`
- `infra/`
- `.github/workflows/`

Lis les documents de spécification, les rapports de Phase 3 et les migrations Prisma.

Identifie les composants déjà fonctionnels et les fonctionnalités encore absentes.

Vérifie les prérequis de production et signale les risques.

## Étape 2 — Préparation du Backend de production

Prépare le déploiement NestJS sur Oracle Cloud Ubuntu avec :

- Docker et Docker Compose.
- Nginx comme reverse proxy.
- HTTPS avec certificats TLS.
- Variables d'environnement sécurisées.
- PostgreSQL persistant.
- Healthchecks et redémarrage automatique.
- Migrations Prisma contrôlées.
- Sauvegardes PostgreSQL régulières et procédure de restauration.
- Rotation des journaux et supervision minimale.
- CORS limité aux domaines autorisés.
- Rate limiting et protection des endpoints sensibles.

Ne lance aucune migration destructive.

Ne copie jamais de secrets dans Git.

Ne déploie pas réellement sur une infrastructure distante sans présenter d'abord les changements et demander une validation explicite.

## Étape 3 — Déploiement Next.js

Prépare deux déploiements indépendants sur Vercel :

- `apps/web` pour l'application étudiant.
- `apps/admin` pour le dashboard administrateur.

Configure les builds Turborepo, les variables d'environnement et les appels à l'API publique HTTPS.

Vérifie les redirections d'authentification, les cookies éventuels, les sessions, les routes protégées et les erreurs réseau.

## Étape 4 — Finalisation React Native / Expo

Complète `apps/mobile` avec les fonctionnalités existantes du Backend.

Écrans attendus :

- Splash screen et onboarding.
- Inscription et connexion.
- Dashboard étudiant.
- Liste des cours.
- Détail des cours.
- QCM et réponses.
- Résultats et corrections IA.
- Flashcards Leitner.
- Révisions.
- Calendrier et planning.
- Planning intelligent IA.
- Statistiques de progression.
- Profil et paramètres.
- Informations d'abonnement.

Réutilise les contrats et types partagés du monorepo.

Prévois une gestion sécurisée des sessions, le stockage adapté des jetons, les états hors ligne, les chargements et les erreurs réseau.

L'application Mobile doit communiquer avec l'API publique, sans dépendre de localhost ou du serveur de développement Metro en utilisation normale.

## Étape 5 — Synchronisation Web / Mobile

Vérifie qu'un même utilisateur retrouve sur les deux plateformes :

- Ses cours et QCM.
- Ses tentatives et scores.
- Ses flashcards.
- Ses révisions Leitner.
- Son planning.
- Ses statistiques.
- Son niveau d'abonnement.

La source de vérité reste PostgreSQL via l'API NestJS.

## Étape 6 — Builds Android et iOS

Configure EAS Build avec les profils :

- development
- preview
- production

Prépare un APK Android de test et une distribution iOS adaptée aux appareils de test ou à TestFlight.

Vérifie les identifiants d'application, les permissions, les icônes, le splash screen et les configurations d'environnement.

Ne publie pas dans les stores sans validation explicite.

## Étape 7 — Qualité et validation

Exécute les tests unitaires, d'intégration et E2E disponibles.

Vérifie également :

- Authentification et expiration des sessions.
- Droits Free, Plus et Pro.
- Accès interdit aux données d'autres utilisateurs.
- Protection des secrets.
- Comportement après perte de connexion.
- Synchronisation Web/Mobile.
- Responsive et accessibilité.
- Fonctionnement sur Android et iOS.
- Absence de régression des phases précédentes.

Les tests non exécutés doivent être signalés explicitement.

## Étape 8 — CI/CD

Prépare des pipelines GitHub Actions indépendants pour :

- Backend.
- Frontend Web.
- Administration.
- Mobile.

Les pipelines doivent exécuter les validations appropriées sans déployer les applications non concernées.

## Livrables

Présente :

1. L'architecture finale.
2. Les fichiers modifiés.
3. Les commandes de déploiement.
4. La configuration des environnements.
5. Les endpoints de production.
6. Les résultats des tests.
7. La procédure de construction Mobile.
8. Les étapes manuelles nécessaires.
9. Les risques restants avant publication.

Commence par un audit et un plan détaillé. Travaille ensuite par étapes avec validation des tests, sans supprimer les données ni modifier les fonctionnalités opérationnelles des phases précédentes.
