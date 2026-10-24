# Phase 2.5 — Bilan de réorganisation modulaire

17 octobre 2026. Branche `chore/phase-2-5-modular-monorepo`. Aucun déploiement et aucune Phase 3. [Audit préalable](AUDIT.md), [ADR 007](../adr/007-four-independent-apps.md).

## Protection de l’existant

L’état de travail initial comprenait des corrections non commitées de l’audit Phase 2. Elles sont isolées dans le commit de restauration **a165be0**, tag **restore/phase-2-5-20261017**, avant tout déplacement. La comparaison des modifications structurelles part de ce checkpoint. La branche main n’est ni réinitialisée ni fusionnée.

`pnpm check:prisma-integrity` vérifie les SHA-256 du schéma Prisma, du seed et des migrations existantes : **inchangés octet par octet**. Aucun reset, db push, suppression de données, nouvelle migration ou migration de la base applicative n’a été exécuté pendant cette phase. Les tests continuent d’utiliser uniquement `revynora_test` et leurs fixtures dédiées.

Une lecture `prisma migrate status` sur la base applicative a constaté deux migrations **préexistantes au checkpoint**, en attente : `20261017010000_free_history` et `20261017011000_task_versions`. Elles ne sont pas introduites par la Phase 2.5 et n’ont pas été appliquées à cette base pendant la réorganisation. Leur application via le workflow existant `pnpm db:migrate` reste nécessaire pour utiliser localement toutes les corrections de l’audit Phase 2. Ce constat ne signifie pas qu’une base a été réinitialisée.

## Structure obtenue

```text
apps/
  web/          Next étudiant et site public — 3000
  api/          Nest, API REST centrale — 3001
  admin/        Next administratif indépendant — 3002
  mobile/       Expo/React Native, socle sans métier — Metro 8081
packages/
  types/        Contrats TS existants
  validation/   Schémas existants, ajout de la configuration ADMIN_ORIGIN
  api-client/   Fetch portable, erreurs, callback de session
  ui/           Primitives DOM/Next, Brand et CSS existants
  config/       TS strict partagé
prisma/         Emplacement, schéma, seed et migrations conservés
```

## Modifications réalisées

| Lot               | Réalisation                                                                                                                                        | Fichiers principaux                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sauvegarde/audit  | Inventaire, comparaison à la cible, branche, checkpoint et tag ; empreintes Prisma                                                                 | `docs/phase2.5/AUDIT.md`, `prisma-baseline.json`                                                 |
| Client partagé    | Transport REST extrait sans changer les contrats ; aucune dépendance React/Next/Expo/Nest/Prisma ; navigation d’expiration dans chaque application | `packages/api-client/`, `apps/web/lib/api.ts`, `apps/admin/lib/api.ts`, `apps/mobile/src/api.ts` |
| UI partagée       | Composants et CSS conservés ; façades pour les anciens imports Web ; assets de marque identiques dans chaque Next                                  | `packages/ui/`, `apps/web/components/ui/`, `apps/web/components/brand.tsx`, CSS des applications |
| Admin indépendant | Dashboard Phase 2 déplacé ; connexion centrale réutilisée ; ancien `/admin` protégé conservé comme pont ; tests du composant déplacés              | `apps/admin/app/`, `components/`, `lib/`, `tests/`, `apps/web/app/admin/`                        |
| Mobile préparé    | Entrée Expo, écran d’attente, Metro officiel, client API configuré sans requête ; aucune auth native, notification, révision ou facturation        | `apps/mobile/`                                                                                   |
| Configuration     | API_URL/config par Next ; ADMIN_ORIGIN explicite côté API ; outils TS isolés ; scripts filtrés et lockfile ; contrôles de frontières               | `package.json`, `turbo.json`, `.env.example`, configs Next/Expo, `scripts/check-*.mjs`           |
| CI/documentation  | Lint/types/tests/builds sur workspaces, export Expo et vérification de versions, intégrité Prisma, rapports partagés ; guides de démarrage         | `.github/workflows/ci.yml`, README et ADR 007                                                    |

Liste exacte des fichiers de la réorganisation : [FILES.md](FILES.md). Le dashboard et les tests Admin sont déplacés, pas recréés comme de nouvelles fonctionnalités métier. Les services, use cases, repositories et règles API restent identiques au checkpoint ; seule la configuration HTTP ajoute l’origine Admin autorisée. Le nettoyage du callback de rechargement dans le Web et le formatage ne changent pas leur comportement.

## Vérifications exécutées

| Contrôle                                                   | Résultat                                                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check:boundaries`                                    | Réussi : aucune application n’importe une autre ; client API sans framework UI/backend                                                                                           |
| `pnpm check:prisma-integrity`                              | Réussi : schéma, migrations et seed inchangés                                                                                                                                    |
| `pnpm format:check`                                        | Réussi                                                                                                                                                                           |
| `pnpm lint`                                                | Réussi sur les six workspaces possédant du code exécutable                                                                                                                       |
| `pnpm typecheck`                                           | Réussi, y compris les quatre applications et le socle Expo TS 6                                                                                                                  |
| `pnpm test` / `pnpm test:coverage`                         | Tests Web, Admin, transport et API ; intégrations PostgreSQL/Redis incluses dans la couverture                                                                                   |
| `pnpm build`                                               | Réussi : deux applications Next, API Nest, packages compilés et bundles Hermes Android/iOS                                                                                       |
| `pnpm --filter @revynora/mobile exec expo install --check` | Réussi : dépendances compatibles                                                                                                                                                 |
| `pnpm test:e2e`                                            | 14 tests Chromium réussis ; Web 320/375/768/1280 px, SaaS 375/1280 px et Admin séparé avec vraie reconnexion sur 3002 ; audits axe A/AA sans violation sur les parcours vérifiés |
| `CI=1 pnpm dev:mobile`, puis `/status` sur 8081            | Metro démarre ; HTTP 200 `packager-status:running` ; serveur de contrôle arrêté ensuite                                                                                          |
| Graphes Turbo filtrés Admin/Mobile                         | Le build Admin n’inclut pas le Web ; le build Mobile n’inclut aucune autre application                                                                                           |

Total : **116 tests distincts** : 36 Web + 10 Admin + 3 client API + 28 unitaires API + 25 intégrations API + 14 E2E. Les 53 tests du rapport API incluent déjà les 28 unitaires, sans double comptage.

Couverture des lignes : **Web 96,94 %**, **Admin 98,34 %**, **API 94,88 %**, **client API 100 %**. Seuils conservés ; les périmètres ont été séparés avec les applications. Les [chiffres détaillés](coverage-summary.json) et les rapports locaux `apps/*/coverage`, `apps/api/coverage/integration` et `packages/api-client/coverage` sont disponibles. Les captures de cette phase sont dans ce dossier ; les captures historiques ne sont pas remplacées.

Le premier build Expo a été arrêté par les permissions du bac à sable sur `~/.expo`, puis a réussi avec l’autorisation adaptée. Les versions d’outils Mobile ont été ajustées aux exigences officielles Expo, sans mise à niveau des runtimes Web/API existants. Aucune erreur de vérification restante n’est masquée.

## Commandes locales

```sh
pnpm install --frozen-lockfile
# Si nécessaire, créer .env d’après .env.example sans remplacer un fichier existant.
docker compose up -d --wait
pnpm db:generate
pnpm dev
```

`pnpm dev` lance Web/API/Admin. Pour une application seule : `pnpm dev:web`, `dev:api`, `dev:admin`, `dev:mobile`. Les scripts `pnpm build:web`, `build:api`, `build:admin`, `build:mobile` construisent seulement la cible et ses packages. Mobile reste volontairement hors du lancement par défaut.

## Éléments restant hors périmètre

- Phase 3 : parcours natifs, authentification/stockage sécurisé Mobile, notifications et tests device ; aucun de ces développements n’a commencé.
- L’export Metro vérifie le bundling Android/iOS, pas une compilation Xcode/Gradle ni un IPA/APK signé. Aucun déploiement/store/EAS n’a été exécuté.
- Les identifiants Stripe/SMTP, validations externes et durcissement production restent ceux signalés en Phase 2 ; aucun paiement ou e-mail réel dans cette recette.
- Les modules historiques Phase 1 gardent leur dette Clean Architecture déjà documentée ; une refonte de leurs règles aurait dépassé cette séparation structurelle.
- La CI a été adaptée et ses commandes exécutées localement ; son résultat distant n’est pas inventé.
- Le contrôle d’empreintes fige volontairement Prisma pour la Phase 2.5. Une phase ultérieure autorisant un changement de données devra mettre à jour consciemment cette référence.
