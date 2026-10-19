# G.2 — Dashboard et gestion des utilisateurs

Développement local du 19 octobre 2026, base Git `063bc1c65fb44fc374db93f32a2350e522854fdb`. Aucun commit, déploiement, changement distant, nouvelle permission, dépendance ou migration.

## Fonctionnalités

- Layout partagé protégé par la vérification de session SSR G.1 : marque, sidebar, navigation active, menu mobile repliable, Escape et retour du focus, déconnexion avec état occupé et erreur. Les deux seules entrées métier sont Vue générale et Utilisateurs. Les futurs modules ne disposent ni de routes métier ni de nouvelles permissions.
- `/` conserve les métriques réelles, les dates de filtrage, paiements agrégés, offres, événements financiers et audit G.1. Pagination des événements ajoutée. Les actions utilisateurs sont déplacées vers leur module dédié.
- `/utilisateurs` : recherche nom/e-mail encodée, remise en page 1 à la recherche, pagination de 20 utilisateurs, liens vers les fiches, rôles/états affichés, chargement, résultat vide, erreur et reprise. Aucun filtre rôle/état/date n'est présenté comme fonctionnel : l'API existante de liste ne les applique pas. Le filtre réellement disponible est la recherche.
- `/utilisateurs/[id]` : identité administrative limitée à id, nom, e-mail, rôle, date d'inscription et date de suspension. Aucun mot de passe, session, secret, contenu de cours, diagnostic ou historique pédagogique.
- Suspension/réactivation sur liste et fiche via le composant G.1, avec confirmation et motif contrôlé obligatoires. Administrateurs protégés, révocation des sessions, transaction et audit inchangés. La fiche rafraîchit l'état après mutation.
- Nouveau `GET /api/v1/admin/users/:id` : session/AdminGuard, permission `users/read`, UUID validé, 404 si absent. Projection Prisma explicite des six champs du contrat `AdminUser` existant. Aucun nouveau contrat ou rôle nécessaire.
- Le hook de chargement masque immédiatement les anciennes données lors d'un changement de chemin ou d'une reprise, et ignore les réponses tardives après navigation.

## Responsabilités et fichiers

- `apps/admin/components/admin-shell.tsx`, layout protégé et CSS : navigation partagée et responsive.
- `apps/admin/components/admin-view.tsx` : synthèse existante conservée et gestion utilisateurs extraite.
- `apps/admin/modules/users/users-view.tsx`, `user-detail.tsx`, routes correspondantes : module Utilisateurs.
- `apps/admin/lib/use-resource.ts` : séparation des résultats par chemin et version de reprise.
- Backend `admin/domain/admin.ts`, `application/admin.use-cases.ts`, `infrastructure/admin.repository.ts`, `presentation/admin.controller.ts` : lecture individuelle suivant les couches existantes.
- Tests Admin existants adaptés à la séparation, nouveaux `g2.test.tsx` et `resource.test.tsx`. Test HTTP ajouté dans `saas.integration.ts`.

## Vérifications effectuées

Node 24.3.0, pnpm 10.18.3. Vérifications exécutées dans une copie locale isolée reprenant les sources modifiées, pour éviter les blocages d'accès aux dépendances du dépôt principal. Les essais initiaux bloqués dans le dépôt principal ont été arrêtés ; aucun processus de recette laissé actif.

| Contrôle                             | Résultat                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| Tests Admin avec couverture          | 27 réussis, 8 fichiers                                            |
| Tests unitaires API                  | 44 réussis, 11 fichiers                                           |
| Intégration HTTP/PostgreSQL SaaS     | 17 réussis, dont fiche G.2 et régressions d'audit/concurrence G.1 |
| ESLint Admin et API                  | Réussi                                                            |
| TypeScript Admin et API              | Réussi, routes Next générées                                      |
| Builds Admin et API, Turbo `--force` | Réussis, aucun résultat build restauré du cache                   |
| Frontières du monorepo               | Réussi                                                            |
| Diff whitespace                      | Réussi                                                            |

Total initial : 88 tests distincts, complétés par 4 scénarios navigateur (92 au total). Couverture Admin : lignes/statements 98,71 %, branches 92,04 %, fonctions 87,09 %. Seuils existants inchangés.

Le premier essai unitaire API sans configuration de base a échoué dans cinq tests IA préexistants ; la suite complète passe avec la configuration locale de test explicite. L'intégration a nécessité l'autorisation réseau local hors sandbox pour joindre PostgreSQL. URL vérifiée en mémoire : hôte loopback exclusivement, base forcée à `revynora_test`. Aucun fichier `.env` copié, aucune migration, aucun reset, aucun appel API de production. Fournisseurs IA/facturation/e-mail simulés par les tests existants.

Build Admin effectué avec `API_URL=https://api.revynora.watercode.dev`, `VERCEL=1`, `VERCEL_ENV=production` dans son processus uniquement, sans changement de fichier d'environnement. Le manifest contient `/api/v1/:path*` vers `https://api.revynora.watercode.dev/api/v1/:path*`, sans loopback. Les trois routes protégées sont dynamiques. Aucune requête de production nécessaire au build.

## Limites et revue

Recette navigateur locale complémentaire : quatre scénarios Playwright réussis (320, 768 et 1280 px, puis refus anonyme/STUDENT). Les trois routes sont visitées à chaque largeur, avec contrôles de débordement horizontal et axe A/AA : aucune violation détectée sur les neuf écrans. Connexion ADMIN, menu clavier mobile, Escape/focus, recherche, fiche, suspension/réactivation confirmées et refus backend sont vérifiés sur la base locale revynora_test. Les comptes jetables et leurs audits sont nettoyés par leurs identifiants propres. Deux sélecteurs de test ont été corrigés, sans changement applicatif. Captures inspectées sur desktop et mobile ; aucun appareil physique ni audit manuel au lecteur d’écran. Les scripts dédiés apps/web/playwright.admin.config.ts et tests/admin-e2e/admin-g2.spec.ts restent séparés de la suite Web standard. La recette requiert un build Admin avec API_URL=http://127.0.0.1:3411 ; cet artefact local ne doit pas servir de livraison. Le build HTTPS précédemment vérifié reste la référence pour préparer une future livraison.

La fiche reste volontairement limitée aux champs administratifs déjà autorisés. Aucun filtre supplémentaire, changement de rôle, création/suppression de compte, gestion des cours ou des abonnements, MFA ni module G.3–G.8 ajouté. La coordination de versions API/Admin du contrat PATCH G.1 reste applicable ; les nouvelles pages nécessitent l'endpoint de fiche avant toute future mise en service.

Décision : **GO pour revue locale G.2**. Aucun commit ou déploiement autorisé par ce rapport. Toute suite attend une nouvelle autorisation.
