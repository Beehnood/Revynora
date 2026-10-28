# G.9 — Recette technique finale

Campagne exécutée le 26 octobre 2026, résultats recueillis et rapport finalisé le 27 octobre 2026 (Europe/Paris).

**Décision : NO-GO pour le commit local G.9.** Les validations automatisées finales passent, mais deux familles d'écarts de contrôle Stripe restent à corriger ou à arbitrer explicitement. Aucun commit, push, déploiement, changement de branche, reset, appel Stripe réel ou opération bancaire n'a été effectué.

## Référence et périmètre

- Branche conservée : `feature/admin-commercial-management`.
- HEAD conservé : `2a3bf2c7fdd0c473477bdddf62fba83bed59bca0`.
- 26 fichiers suivis modifiés et 19 fichiers non suivis, soit 45 fichiers dans le périmètre G.9. Index vide.
- Les sources applicatives, packages, scripts et migrations de la copie validée correspondent aux fichiers du dépôt final : aucune différence d'empreinte SHA-256. La documentation finale est ajoutée après la copie.
- Modification effectuée pendant cette finalisation : identifiant de prix Stripe synthétique unique par exécution dans `commercial.integration.ts`. Aucun comportement commercial de production n'a été corrigé dans cette mission de validation.

Les commandes, durées, codes de sortie, couvertures, empreintes et inventaire sont conservés dans [g9-validation/results.json](g9-validation/results.json). Le diagnostic Stripe reproductible est dans [g9-validation/stripe-safety-probe.cjs](g9-validation/stripe-safety-probe.cjs).

## Diagnostic des ralentissements

### Constats mesurés

Les validations de la reprise précédente étaient encore actives en double : trois compilateurs API, compilateurs Web/Admin, suites Jest/Vitest et nombreux workers, ainsi que Turbo/ESLint. Sept arbres précisément identifiés, soit 71 processus, ont été inventoriés avant SIGTERM. Les deux diagnostics ultérieurs restés bloqués ont également été identifiés avant interruption. Aucun processus utilisateur, éditeur, service iCloud ou conteneur applicatif n'a été arrêté.

Les échantillonnages de TypeScript montrent une attente dans `uv_fs_read` puis `read`. Les fichiers ouverts appartiennent à `node_modules/.pnpm` : déclarations NestJS, AWS/Smithy, Next, ainsi que fichiers ESLint et ioredis selon le processus. Les relectures ciblées à chaud par Node prenaient 0,057 à 0,117 ms. Il ne s'agissait pas d'une boucle CPU du compilateur.

Mesure système : CPU global environ 63 % inactif, disque à 93 % (31 Gio disponibles), environ 48 Mo/s et 3 084 transactions disque/s pendant l'échantillon, mémoire compressée importante et 356 Mio de swap utilisés. Les services iCloud/FileProvider étaient actifs. Cela décrit une contention et des attentes d'E/S ; cela ne démontre ni une panne du disque ni une responsabilité précise d'iCloud ou d'un antivirus.

PostgreSQL était à 0 % CPU, environ 110 Mio de mémoire ; aucun verrou ni requête bloquée dans `pg_stat_activity`. Docker n'est pas la cause observée de l'attente des compilateurs.

### Caches et dépendances

- `node_modules/.pnpm` initial : environ 899 Mio ; cache Turbo : 1,3 Gio ; cache Prisma : 64 Mio. Aucun cache supprimé ou purgé.
- `.modules.yaml` référence le magasin pnpm `~/Library/pnpm/store/v10` (2,3 Gio), tandis que `pnpm store path` dans cet environnement désigne `.pnpm-store/v10`, vide. Le contrôle général `pnpm store status` n'a pas terminé et a été interrompu ; aucune intégrité exhaustive de ce magasin n'est revendiquée.
- Les SHA-256 des moteurs Prisma 6.19.0 présents dans le cache correspondent aux fichiers `.sha256` associés.
- Le lockfile de l'installation initiale diffère du lockfile du dépôt : notamment Expo 57.0.30 installé contre 57.0.31 demandé. Les dépendances initiales ne permettaient pas une validation reproductible de tout le monorepo.
- Une copie isolée de 537 fichiers, sans `.env`, `.git`, dépendances, caches ni résultats antérieurs, a été préparée dans `/private/tmp/revynora-g9-frozen-validation`.
- L'installation hors ligne a échoué avec `ERR_PNPM_NO_OFFLINE_TARBALL` pour Expo 57.0.31. L'installation `--frozen-lockfile` a ensuite réutilisé le magasin et téléchargé sept paquets npm manquants, sans suppression de cache, en 11,9 s.
- Les lockfiles du dépôt et de l'installation neuve ont la même empreinte : `f301fa59bf4728c9228c22a89f059241e8ff0d17a441dd02b75f5b0e5a7bab6a`.

**Conclusion du diagnostic :** le ralentissement observé se situe dans les lectures de dépendances de l'installation initiale, aggravées par les validations concurrentes. Une installation figée dans le dossier temporaire rétablit des temps normaux : typage API 4,15 s contre 135,74 s en séquentiel dans le dossier initial, typage Web 3,05 s contre interruption à 180 s, ESLint des workspaces 1 à 4 s contre interruption du premier workspace à 240 s. Le mécanisme système exact des lectures initiales n'est pas isolé ; il serait injustifié de l'attribuer catégoriquement à iCloud. L'installation initiale du dépôt est conservée telle quelle.

## Environnement de validation

- PostgreSQL 17.6 Alpine éphémère : `revynora-g9-validation-20261026`, port `127.0.0.1:55439`, stockage tmpfs, bases `revynora_test` et `revynora_g9_upgrade_final` exclusivement.
- Redis 7.4.6 Alpine dédié : `revynora-g9-redis-20261026`, port `127.0.0.1:56389`, base logique de test et queues nommées pour la recette.
- Fournisseurs IA et paiement simulés, mail local, clés Stripe fictives dans les tests SDK remplacés. Aucun fournisseur Stripe distant ni SMTP réel utilisé.
- Serveurs navigateur de recette : API 3411, Admin 3412, Web 3410. Un worker Playwright ; un worker Vitest et fichiers non parallélisés ; workspaces contrôlés séquentiellement.
- Client Prisma régénéré dans la copie. Les packages `validation` et `api-client` sont construits avant les validations applicatives finales.
- Les builds Next sont des builds locaux avec URL API loopback. L'export Mobile utilise une URL synthétique HTTPS ; aucune publication, signature ou installation native n'est revendiquée.

## Résultats finaux réussis

| Contrôle                                               | Résultat final                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript API, Admin, Web, Mobile                     | Réussis                                                                                                                                                             |
| TypeScript des packages ayant une commande de typage   | Réussis ; les packages de types/configuration sans commande propre sont consommés par les applications                                                              |
| ESLint API, Admin, Web, Mobile, UI, API client         | Réussis ; aucun diagnostic bloquant                                                                                                                                 |
| Tests unitaires API                                    | 19 fichiers, 69 tests réussis                                                                                                                                       |
| Intégration commerciale ciblée G.9                     | 9 tests réussis                                                                                                                                                     |
| Suite API complète avec PostgreSQL/Redis et couverture | 26 fichiers, 131 tests réussis, incluant les 69 unitaires et les 9 intégrations G.9 ; ne pas additionner ces sous-ensembles                                         |
| Tests Admin avec couverture                            | 15 fichiers, 49 tests réussis, dont 6 tests du panneau commercial                                                                                                   |
| Tests Web avec couverture                              | 5 fichiers, 44 tests réussis                                                                                                                                        |
| Tests Mobile avec couverture                           | 4 suites, 24 tests réussis                                                                                                                                          |
| API client avec couverture                             | 3 tests réussis                                                                                                                                                     |
| Playwright Admin et pédagogie associée                 | 25 scénarios réussis : 14 G.2/G.3/G.4/G.6, 5 G.7, 4 G.8, 2 G.9                                                                                                      |
| Régressions G.1–G.8                                    | Fondations/permissions G.1 et supervision G.5 couvertes par API, Admin et scénarios statistiques ; parcours G.2/G.3/G.4/G.6/G.7/G.8 réussis                         |
| Axe et responsive                                      | Assertions Axe sans violation et absence de débordement global dans les scénarios prévus ; G.7 à 320/375/768/1280/1440 px, G.8 à 375/768/1440 px, G.9 à 375/1280 px |
| Builds packages, API, Admin, Web                       | Réussis ; environ 2,36 / 2,79 / 15,42 / 19,68 s                                                                                                                     |
| Build Mobile                                           | Export Metro iOS et Android réussi, environ 15,02 s                                                                                                                 |
| Prisma validate et migrate status                      | Réussis ; 12 migrations à jour sur la base isolée                                                                                                                   |
| Frontières du monorepo                                 | Réussies ; 5 tests du contrôleur de frontières réussis                                                                                                              |
| Intégrité migrations/seed historiques                  | Réussie ; empreintes historiques préservées                                                                                                                         |
| Prettier global et git diff --check                    | Réussis, y compris la vérification finale après documentation                                                                                                       |

Les configurations et seuils de couverture existants n'ont pas été abaissés, ni leurs périmètres réduits.

| Périmètre    | Statements | Branches | Fonctions |  Lignes | Seuils existants respectés                                               |
| ------------ | ---------: | -------: | --------: | ------: | ------------------------------------------------------------------------ |
| API complète |    95,44 % |  87,03 % |   98,07 % | 95,44 % | Oui : 80 / 70 / 80 / 80                                                  |
| Admin        |    97,67 % |  88,31 % |   88,31 % | 97,67 % | Oui : 85 / 75 / 85 / 85                                                  |
| Web          |    96,40 % |  88,90 % |   88,11 % | 96,40 % | Oui : 85 / 75 / 85 / 85                                                  |
| Mobile       |    73,60 % |  66,47 % |   58,28 % | 74,47 % | Oui : 70 / 60 / 50 / 70 ; seuils spécifiques session également respectés |
| API client   |      100 % |  86,36 % |     100 % |   100 % | Oui : 85 / 75 / 85 / 85                                                  |

## Échecs et interruptions conservés dans le bilan

- **Échec initial de configuration** : génération de routes Admin sans `API_URL`. Résolu en fournissant une origine locale explicite ; les contrôles finaux passent.
- **Interrompus** : arbres de validation en double de la reprise précédente ; diagnostic isolé TypeScript API ; `pnpm store status`. Leurs sorties partielles ne sont pas comptées comme réussites.
- **Interrompus à la limite** dans le dossier initial : typage Web à 180 s et lint Turbo à 240 s. Les commandes correspondantes passent ensuite dans l'installation figée.
- **Échec d'installation hors ligne** : archive Expo 57.0.31 absente du cache. Résolu par téléchargement npm des paquets manquants dans la copie isolée.
- **Échecs de prérequis dans la première passe de la copie** : typages Admin/Web/Mobile, tests API/Admin/Web et intégrations ne pouvaient pas résoudre les packages partagés non construits. Toutes les commandes affectées ont été reprises après construction et réussissent. Ces échecs initiaux ne sont pas présentés comme des défauts applicatifs.
- **Échec réel de répétabilité de la fixture G.9** : première suite API complète après le test ciblé, 130 réussites et 1 échec `PROVIDER_PRICE_CONFLICT`. Un identifiant de prix synthétique constant heurtait l'association immuable conservée par la première exécution. Corrigé par UUID dans la fixture, sans supprimer d'audit ni de version ; seconde suite complète : 131/131. Typage API, lint API et formatage du test recontrôlés après correction.
- **Écarts commerciaux toujours présents** : reproductions hors ligne décrites ci-dessous. Leur script termine avec code 0 lorsqu'il reproduit les écarts ; ce code ne signifie pas conformité commerciale.

## Migrations

Les neuf migrations antérieures à G.9 sont inchangées. Les trois migrations additives sont :

1. `20261025000000_commercial_versions` : versions, associations, audit et instantanés contractuels, contraintes et triggers d'immuabilité.
2. `20261025001000_contract_provider_price` : référence de prix fournisseur des périodes.
3. `20261026000000_commercial_catalog_guard` : cohérence entre catalogue projeté et version publiée.

Les 12 migrations ont été appliquées sur la base vide isolée. `migrate status` confirme leur application et `prisma validate` confirme le schéma.

Le script de répétition a également créé un état G.8 dans `revynora_g9_upgrade_final`, inséré une fixture de catalogue à 321 centimes et un ancien contrat à 279 centimes, puis appliqué G.9 et réappliqué `migrate deploy`. Résultats : contrat toujours à 279, catalogue à 321, contrat `LEGACY_UNVERIFIED`, aucune version actuelle artificiellement attribuée, zéro permission commerciale et second déploiement sans migration restante. Le pilote était macOS avec moteur PostgreSQL Linux en conteneur.

Cette fixture historique synthétique ne remplace pas un inventaire et une répétition sur une copie représentative des données réelles. Aucune migration ni requête de recette n'a ciblé la base applicative.

## Vérification commerciale

### Protections constatées et testées

- Versions publiées et contenu des brouillons immuables en base ; seule publication d'un brouillon inchangé autorisée. Associations fournisseur immuables et audit append-only.
- Instantanés monétaires des checkouts et contrats préservés. Un nouvel affichage catalogue n'est pas utilisé pour fabriquer le montant d'un ancien paiement ; absence de preuve contractuelle explicitement refusée.
- Publication concurrente sérialisée par verrou de l'offre et révision attendue ; une seule publication concurrente réussit. Un brouillon obsolète est refusé.
- Session Admin active et capacité `CommercialPermission` explicite requises ; refus des étudiants, Admin sans capacité et comptes suspendus. Aucun endpoint d'auto-attribution.
- Publication et audit atomiques ; rollback testé par échec injecté de l'audit.
- Prix Stripe live refusés, vérification administrative d'un prix test simulée par lectures SDK remplacées. Aucune opération Stripe distante n'a été utilisée pour la recette.
- Mock conserve les conditions acceptées et expose un mode simulation ; un statut simulé n'est pas présenté comme preuve d'encaissement réel.
- Aucune colonne, formulaire ou route G.9 de stockage d'IBAN, numéro de carte, coordonnées de versement ou mutation bancaire ajouté.
- Droits pédagogiques internes G.8 indépendants des paiements et de la permission commerciale ; accès et révocation recontrôlés par API et navigateur.

### Écarts restant à arbitrer avant commit

**S1 — Contrôle incomplet du prix au moment de la vente/changement.** `billing.provider.ts`, checkout vers lignes 42–50 : le contrôle ne vérifie pas `recurring.interval_count`, le schéma unitaire, l'usage licensed ou les transformations de quantité comme le fait la vérification administrative. Une réponse SDK synthétique EUR/250, `interval=month`, `interval_count=12` est acceptée jusqu'à la création de session simulée. Dans `changePlan`, vers lignes 96–103, un prix synthétique `active=false` est également accepté jusqu'aux méthodes de planning fournisseur simulées. Le contrôle au changement est donc plus faible que celui de la vérification initiale. Un prix Stripe vérifié ne peut pas nécessairement voir tous ces champs modifiés à distance ; ces reproductions montrent une lacune du contrôle local, pas une exploitation Stripe réelle démontrée.

**S2 — Compte fournisseur mémorisé mais non contrôlé lors du rapprochement.** Dans `reconcile`, la recherche d'association filtre provider, environnement, prix et état publié, sans `accountId`. La reproduction retourne une association synthétique `acct_other` ; elle est acceptée sans lecture ni comparaison avec le compte courant. Il manque une preuve explicite de cohérence du compte dans ce chemin, notamment en cas de changement de configuration fournisseur. Aucune collision réelle d'identifiants Stripe entre comptes ni exploitation distante n'est revendiquée.

Reproduction : `node docs/admin/g9-validation/stripe-safety-probe.cjs` depuis la racine avec les dépendances installées. Toutes les méthodes SDK effectivement utilisées sont remplacées par des réponses synthétiques ; clés fictives et aucun chargement de `.env`. Les trois constats ont été reproduits à nouveau dans l'installation figée. Ne pas interpréter l'exit 0 de ce diagnostic comme un test de sécurité réussi.

Recommandation : compléter les validations du prix et du compte fournisseur, ajouter les cas de refus correspondants aux tests, puis reprendre les contrôles ciblés et les parcours de facturation. Ces corrections ne sont pas incluses dans cette mission de validation.

## Non exécuté et limites

- Aucun appel Stripe réel, lecture de compte distant, création/modification de Product/Price, opération bancaire ou paiement réel : exclus par les restrictions.
- Aucun test sur données de production ou base applicative, aucune migration réelle : exclus.
- Pas d'audit manuel au lecteur d'écran, appareil physique ou build natif signé ; les exports Mobile et les tests Axe ne les remplacent pas.
- La suite Playwright exécutée est celle de régression Admin G.2–G.9 incluant l'espace pédagogique G.8. La suite généraliste distincte `apps/web/tests/e2e` n'a pas été relancée ; elle n'est pas incluse dans les 25 scénarios annoncés.
- Le diagnostic système n'a pas établi le mécanisme macOS exact de la lenteur initiale ; aucune suppression de cache ou de service système n'a été utilisée pour prétendre le résoudre.
- Les tests automatisés actuels passent mais ne prouvent pas l'absence des écarts S1/S2, qu'ils ne couvrent pas suffisamment.

## État final et preuves

Les validations sont terminées ; aucun processus TypeScript, ESLint, Vitest, Jest ou serveur de recette navigateur de cette campagne n'est encore actif. Les deux conteneurs de test identifiés restent démarrés pour conserver les bases synthétiques et leurs audits immuables ; ils ne sont pas des services applicatifs déployés. Les copies et journaux temporaires sont conservés, sans purge.

Journaux détaillés : `/private/tmp/revynora-g9-final-validation`, `/private/tmp/revynora-g9-frozen-results` (première passe et builds), `/private/tmp/revynora-g9-frozen-final` (reprise des types et tests), `/private/tmp/revynora-g9-retry-results` (couverture API corrigée, Mobile et Playwright). Captures navigateur : sous-dossier `browser` du dernier dossier. Les synthèses de couverture sont dans la copie isolée, chemins enregistrés dans le JSON de résultats. Les fichiers temporaires ne sont pas des livrables pérennes ; les métriques, commandes, états et empreintes utiles sont repris dans ce dépôt.

La recommandation reste **NO-GO pour le commit local G.9** tant que S1/S2 ne sont pas corrigés ou arbitrés explicitement. Aucun commit ni ajout à l'index effectué. Aucun push ni déploiement. Arrêt du travail après le rapport demandé.

## Liste exacte des 45 fichiers G.9 modifiés ou ajoutés

Les 26 fichiers suivis modifiés et 19 nouveaux fichiers sont listés ci-dessous ; le JSON conserve également l'inventaire et les empreintes des sources validées.

```text
apps/admin/app/(protected)/offres/page.tsx
apps/admin/components/admin-shell.tsx
apps/admin/components/admin-view.tsx
apps/admin/modules/billing/billing-panel.tsx
apps/admin/modules/commercial/commercial-panel.tsx
apps/admin/tests/commercial.test.tsx
apps/api/src/admin/admin.module.ts
apps/api/src/admin/infrastructure/admin.repository.ts
apps/api/src/auth/auth.service.ts
apps/api/src/billing/application/billing.use-cases.ts
apps/api/src/billing/domain/billing.ts
apps/api/src/billing/infrastructure/billing.provider.ts
apps/api/src/billing/infrastructure/prisma-billing.repository.ts
apps/api/src/billing/infrastructure/stripe.provider.spec.ts
apps/api/src/commercial-catalog/commercial.integration.ts
apps/api/src/commercial-catalog/controller.ts
apps/api/src/commercial-catalog/domain.spec.ts
apps/api/src/commercial-catalog/domain.ts
apps/api/src/commercial-catalog/service.ts
apps/api/src/learning-access/domain/access.ts
apps/api/src/notifications/application/notifications.use-cases.ts
apps/api/src/notifications/infrastructure/reminder.worker.ts
apps/api/src/saas/saas.integration.ts
apps/api/vitest.integration.config.ts
apps/mobile/src/screens/account.tsx
apps/web/components/saas/billing-view.tsx
apps/web/playwright.polyvalent.config.ts
apps/web/tests/admin-e2e/commercial-g9.spec.ts
docs/admin/G9-GESTION-COMMERCIALE.md
docs/admin/G9-RECETTE.md
docs/admin/g9-validation/results.json
docs/admin/g9-validation/stripe-safety-probe.cjs
package.json
packages/types/src/admin.ts
packages/types/src/index.ts
prisma/migrations/20261025000000_commercial_versions/migration.sql
prisma/migrations/20261025001000_contract_provider_price/migration.sql
prisma/migrations/20261026000000_commercial_catalog_guard/migration.sql
prisma/schema.prisma
scripts/admin-ci-browser.cjs
scripts/initialize-catalog.cjs
scripts/initialize-commercial-catalog.cjs
scripts/initialize-test-catalog.cjs
scripts/prepare-test-db.cjs
scripts/test-commercial-upgrade.cjs
```
