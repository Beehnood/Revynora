# Phase 2.5 — Audit avant réorganisation

Audit du 17 octobre 2026. Branche : `chore/phase-2-5-modular-monorepo`.
Point de restauration : commit `a165be0`, tag `restore/phase-2-5-20261017`.

Le travail non commité de l’audit Phase 2 précédent est sauvegardé dans ce commit séparé : historique FREE, intervalles Leitner et versions de tâches. Ces fonctionnalités ne sont pas développées ni modifiées pendant la Phase 2.5. Référence de comparaison : le checkpoint, pas le précédent commit main `a26f122`.

## État constaté

| Cible               | Avant                                                                                                                                                       | Décision                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| apps/web            | Next 16.4.1, React 19.2.3 ; site public, auth, diagnostics, résultats, cours, révisions, planning, abonnement, préférences, confidentialité ; Admin intégré | Conserver les parcours étudiant et sortir les écrans Admin existants                                |
| apps/api            | Nest 11.1.8 ; Auth, Learning/AI, Billing, Leitner, Planning, Notifications, Admin, Privacy, Health                                                          | Conserver modules, contrats et règles ; adapter seulement configuration des origines/client         |
| apps/admin          | Absent ; `/admin` est dans apps/web                                                                                                                         | Application Next indépendante ; déplacer l’interface déjà livrée, sans nouveau métier               |
| apps/mobile         | README uniquement                                                                                                                                           | Socle Expo/React Native, écran d’attente et configuration du client API ; aucun parcours Phase 3    |
| packages/types      | Types TS partagés                                                                                                                                           | Conserver                                                                                           |
| packages/validation | Zod + build TS partagé                                                                                                                                      | Conserver les schémas métier                                                                        |
| packages/api-client | Absent ; fetch couplé au Web                                                                                                                                | Transport REST indépendant de React/Next/Expo, adaptateurs de navigation par application            |
| packages/config     | TS strict partagé                                                                                                                                           | Conserver et compléter l’orchestration                                                              |
| UI/design system    | Composants, styles et assets dans le Web                                                                                                                    | Extraire le socle Web partagé pour éviter des imports Admin → Web ou une duplication des composants |

## Fonctionnement et dépendances

pnpm 10.18.3 et Turborepo 2.5.6 sont déjà configurés avec `apps/*` et `packages/*`. Les versions Web/API existantes restent épinglées. PostgreSQL 5433 et Redis 6380 sont déjà configurés, avec volumes persistants. Prisma est centralisé à la racine ; ses fichiers et les données doivent rester inchangés pendant la réorganisation. Le manifeste `prisma-baseline.json` permet de vérifier les empreintes après travaux.

Les modules SaaS possèdent leurs couches domain/application/infrastructure/presentation. Les modules historiques Phase 1 conservent leur organisation plus directe, dette déjà documentée dans ADR 006. Réécrire leurs règles pour les uniformiser serait hors périmètre de cette réorganisation.

Couplages repérés : proxy API et fetch serveur sur adresse fixe 3001 ; route Admin et composant Admin dans le bundle Web ; client fetch avec redirection `window` ; CSS/assets dépendants du dossier Web ; CI limitée au Web/API ; aucun build Metro/Expo. Les sessions sont des cookies HttpOnly centralisés par l’API : conserver cette stratégie pour les deux clients Next. Aucune authentification mobile ne sera implémentée ici.

## Séparation progressive

1. Sauvegarder l’état existant : branche + checkpoint + tag, avant tout déplacement.
2. Extraire le transport API et les primitives UI ; maintenir les façades Web existantes.
3. Déplacer l’Admin livré vers une application indépendante sur 3002 ; conserver les anciennes URL par redirection.
4. Ajouter le socle Expo sans métier, hors du lancement Web/API/Admin par défaut.
5. Rendre les origines et destinations API configurables, adapter scripts/Turbo/CI.
6. Exécuter vérifications de frontières, intégrité Prisma, lint, types, tests, builds Next/Nest et export Metro ; terminer par les E2E des parcours existants et Admin séparé.

La Phase 3, les déploiements, la réinitialisation des bases et les migrations métier sont exclus.
