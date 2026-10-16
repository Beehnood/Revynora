# Recette locale · 16 octobre 2026

## Livré

Dépôt initial vide. Création du monorepo pnpm/Turborepo, applications Next.js et NestJS, paquets partagés, configuration stricte, Prisma et migration minimale, Compose PostgreSQL, workflow GitHub Actions, documentation et ADR 001–003.

Interfaces : `/`, `/app`, `/admin` et galerie supplémentaire `/design-system`. Identité : logo livre ouvert, versions claire/sombre, icônes application, favicons PNG et sprite de 22 icônes SVG. Six captures desktop/mobile dans `docs/ui`. Les illustrations et tokens reprennent les références sans présenter les tableaux de bord comme des produits déjà opérationnels.

## Commandes réellement exécutées et résultats

| Vérification                                                                          | Résultat final                                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm install` puis `pnpm install --frozen-lockfile`                                  | Réussite, lockfile unique                                         |
| `pnpm db:generate`                                                                    | Client Prisma généré                                              |
| `docker compose up -d --wait`                                                         | PostgreSQL healthy sur 127.0.0.1:5433                             |
| `pnpm db:migrate`                                                                     | Migration 20261016000000_init appliquée                           |
| `pnpm db:check`                                                                       | PostgreSQL disponible                                             |
| `pnpm dev`                                                                            | Web et API démarrent ; menu et formulaire contrôlés avec Chromium |
| `pnpm lint`                                                                           | Réussite sans erreur ni avertissement ESLint                      |
| `pnpm typecheck`                                                                      | Réussite Web, API, validations                                    |
| `pnpm test`                                                                           | 11 tests unitaires réussis : 6 Web et 5 API                       |
| `pnpm test:coverage`                                                                  | Réussite, seuils de couverture respectés                          |
| `pnpm build`                                                                          | Réussite API, validations et 4 routes Web statiques               |
| `pnpm format:check`                                                                   | Réussite                                                          |
| `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/revynora-browsers pnpm test:e2e`               | 18 scénarios réussis sur build compilé                            |
| `node scripts/check-health.mjs`                                                       | Health et readiness HTTP 200                                      |
| `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/revynora-browsers node scripts/capture-ui.cjs` | Captures et contrôle des interactions de développement réussis    |

Les dépendances et Chromium ont nécessité un accès réseau autorisé hors sandbox. Chromium a été téléchargé dans `/private/tmp/revynora-browsers` pour cette session ; en usage normal, la commande du README utilise le cache Playwright par défaut.

Les premières recettes ont révélé des débordements liés aux orbites décoratives et à leur marge de découpe CSS ; ils sont corrigés, sans masquer globalement le débordement de la page. Un sélecteur de test de navigation ambigu a été précisé. Les interactions de développement ont nécessité l’utilisation explicite de Webpack à la place de Turbopack dans cet environnement. Les recettes finales sur build compilé et les contrôles de développement sont réussis.

## Couverture mesurée

| Périmètre instrumenté                     | Lignes | Instructions | Fonctions | Branches |
| ----------------------------------------- | ------ | ------------ | --------- | -------- |
| Web : composants, primitives et landing   | 100 %  | 100 %        | 100 %     | 99,33 %  |
| API : HealthController et DatabaseService | 100 %  | 100 %        | 100 %     | 100 %    |

Ces chiffres ne signifient pas une couverture de 100 % du dépôt. Les fichiers de configuration, CSS, wrappers de routes, bootstrap Nest, scripts, code généré Prisma et validations partagées ne sont pas inclus dans ces pourcentages. Les validations partagées sont exercées par les tests API et formulaire. La migration et le bootstrap sont vérifiés séparément par des commandes et requêtes réelles. Seuils bloquants configurés : Web 85 % lignes/instructions/fonctions et 75 % branches ; API 90 % lignes/instructions/fonctions et 80 % branches. Rapports HTML et json-summary dans `apps/*/coverage`.

## Base et HTTP réels

- GET `/api/v1/health` : 200, `{"status":"ok","version":"0.0.0"}`.
- GET `/api/v1/health/ready` : 200, `{"status":"ready"}`.
- Conteneur PostgreSQL arrêté temporairement : health reste à 200 ; readiness passe à 503 avec uniquement `{"status":"unavailable"}`.
- Après remise en route : readiness retourne à 200.
- Témoin inséré dans FoundationCheck, conteneur redémarré, témoin retrouvé : persistance confirmée. Seul ce témoin a ensuite été supprimé.

## Checklist de recette

- [x] Fondation et arborescence demandées ; aucune phase métier supplémentaire.
- [x] Installation verrouillée, scripts, lint, typecheck et build locaux.
- [x] PostgreSQL local, migration et persistance vérifiées.
- [x] Liveness et readiness séparées, panne DB réellement simulée.
- [x] Landing, étudiant, admin et galerie navigables.
- [x] Données indisponibles clairement indiquées ; aucun faux KPI réel.
- [x] Responsive 320, 375, 768 et 1280 px sur les quatre routes, aucun débordement horizontal.
- [x] Axe : aucune violation détectée sur les règles WCAG A/AA sélectionnées.
- [x] Tab, Enter, Escape, lien d’évitement, focus du menu, formulaire invalide/valide.
- [x] Meta noindex/nofollow de l’administration vérifiée dans Chromium.
- [x] Logo, icônes, composants, tokens, README et ADR livrés.
- [x] GitHub Actions configuré pour pull_request vers main et push main, permissions lecture seule, PostgreSQL et artefacts de couverture.
- [ ] Exécution du workflow sur GitHub : non exécutée, aucun dépôt distant fourni.
- [ ] Audit humain complet WCAG 2.2 AA / lecteur d’écran : à prévoir ; les contrôles automatisés et clavier ne constituent pas une certification.
- [x] Aucune production, aucun hébergement, aucun appel OpenAI/Stripe, aucun envoi externe de données métier.

## Décisions et limites

L’interface suit l’identité violette des références, en adaptant les tokens bleus provisoires du PDF. La police système évite les dépendances réseau. L’administration n’a pas d’authentification car elle ne contient que des maquettes. Le choix du fournisseur d’identité, les droits, le schéma des 16 entités, les prix définitifs, les textes juridiques, les paiements et l’application mobile sont reportés comme demandé.

Next.js est verrouillé à 16.4.1 d’après la [mise à jour de sécurité officielle du 14 octobre 2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026). Aucune affirmation d’aptitude à la production n’est faite. Les scripts de postinstallation non nécessaires de @nestjs/core et unrs-resolver restent bloqués par pnpm ; les builds et tests passent sans eux.
