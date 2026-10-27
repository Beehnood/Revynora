# G.9 — Corrections commerciales et recette

Validation du 27 octobre 2026, branche `feature/admin-commercial-management`, HEAD conservé `2a3bf2c7fdd0c473477bdddf62fba83bed59bca0`.

**Décision : GO technique pour la revue et le commit local G.9, après validation explicite du propriétaire. Aucun commit effectué.** Les trois anomalies identifiées ont été corrigées et leurs refus sont couverts par des régressions hors ligne et PostgreSQL. Cette décision ne vaut ni autorisation de déploiement ni validation d'un paiement réel.

Le bilan NO-GO précédent est conservé dans [before-fix/G9-RECETTE.md](g9-validation/before-fix/G9-RECETTE.md), ses métriques dans [results.json](g9-validation/results.json), et l'ancienne reproduction dans [before-fix/stripe-safety-probe.cjs](g9-validation/before-fix/stripe-safety-probe.cjs). Ces archives décrivent l'état avant correction. Les résultats courants, commandes, durées, codes de sortie et empreintes sont dans [corrections-20261027.json](g9-validation/corrections-20261027.json).

## 1. Cause et correction des trois anomalies

### Checkout et récurrence

**Cause :** le checkout contrôlait seulement le montant, la devise et `interval=month`, sans vérifier le multiplicateur de période ni toutes les propriétés du prix. De plus, l'intention locale était créée avant cette lecture fournisseur.

**Correction :** `compatibleStripePrice` centralise les règles employées par la vérification administrative, le checkout, le changement de formule et le rapprochement. Une nouvelle vente exige un prix test actif, récurrent mensuel, `interval_count=1`, EUR, montant entier exact, tarification `per_unit`, usage `licensed`, sans quantité transformée ni montant libre. La récurrence de l'offre et celle de sa version publiée doivent correspondre au prix. Le prix doit être associé à cette version et au compte fournisseur courant.

`BillingUseCases.checkout` exécute les lectures de validation avant `createCheckout`. Un refus connu à ce stade ne crée aucune intention locale, aucun client ni session Stripe. Le dépôt compare sous verrou la proposition vérifiée avec le catalogue : version, montant, devise, intervalle et référence fournisseur. Une publication concurrente est refusée sans intention. Le fournisseur relit ensuite le prix et sa preuve avant toute création de client/session, pour détecter une modification distante survenue après le précontrôle.

### Changement de forfait et anciens contrats

**Cause :** le changement ne refusait pas un nouveau prix inactif ; les contrôles des changements programmés et de leurs versions étaient incomplets.

**Correction :** le prix cible passe le même contrôle strict de nouvelle vente avant toute mutation de planning fournisseur. Le contrat courant est vérifié séparément : son prix peut être archivé/inactif, mais montant, devise, récurrence, quantité et preuve historique restent contrôlés. Aucun prix courant de catalogue ne remplace le prix historique.

Les phases conservent la version du contrat courant et portent la version publiée acceptée pour la période suivante, sans prorata. Un planning déjà présent doit correspondre au même abonnement test, à la bonne échéance et à l'unique phase future attendue : prix, quantité et version. Un changement identique est reconnu sans réécriture ; un planning différent ou incohérent est refusé, sans l'écraser. Le rapprochement n'active la nouvelle version que lorsque le fournisseur la retourne effectivement avec le prix et les métadonnées cohérents. Un ancien contrat non versionné reste non versionné tant qu'aucune transition démontrée n'a eu lieu.

Le Mock continue de conserver les conditions acceptées et une proposition suivante distincte. Il contrôle lui aussi la récurrence de la proposition ; il ne devient pas un simulateur automatique de renouvellement.

### Rapprochement et compte fournisseur

**Cause :** l'identité du compte vérifiée lors de l'association n'était pas explicitement utilisée dans la recherche de prix au rapprochement.

**Correction :** le fournisseur lit l'identité du compte accessible avec la clé test et compare l'éventuel compte du webhook signé. La recherche d'association est limitée à ce compte, à `stripe`, à `test` et aux versions publiées. La réponse est également contrôlée explicitement. Abonnement et session live sont refusés ; quantité et version doivent être démontrées. Les factures doivent correspondre au client, à l'abonnement, à la devise et à l'environnement test attendus. Un propriétaire historique différent est refusé.

Les incohérences sont refusées avant `repo.apply` : aucune période, paiement ou preuve de traitement n'est enregistré à partir d'elles. Le verrou et la déduplication existants sont conservés. Un webhook rejeté peut être repris après correction de la configuration ; sa première reprise valide est appliquée une fois et les doublons suivants sont ignorés. Aucune table de quarantaine ni migration supplémentaire n'est nécessaire pour cette stratégie de refus.

## 2. Tests de régression

Le fichier `stripe.provider.spec.ts` passe de 8 à 38 cas, soit 30 cas supplémentaires nets. Il conserve aussi les vérifications de signature réelle du SDK, du mode test, des sessions idempotentes et du portail limité. Tous les appels SDK effectivement utilisés sont remplacés par des réponses locales.

Les cas couvrent notamment :

- Prix tous les douze mois, annuel, à l'usage, inactif, live, non récurrent, montant/devise incompatibles, tarification par paliers, quantité transformée ou montant libre : aucun appel à `createCheckout`, aucune création de client/session.
- Récurrence de l'offre, version absente/non publiée, association absente ou d'un autre compte ; relecture du prix avant mutation Stripe.
- Refus d'un nouveau prix inactif tout en rapprochant l'ancien prix archivé ; phases courante/future portant leurs versions ; planning identique idempotent, planning différent/live/étranger refusé ; transition de version seulement à l'activation fournisseur.
- Compte ou environnement d'événement incompatible, association étrangère, facture live ou d'un autre client/abonnement/devise, quantité et propriétaire incorrects.
- Reprise d'un webhook rejeté et déduplication après application valide ; maintien d'un contrat legacy sans reconstruction de ses capacités ou de son montant.

Deux intégrations PostgreSQL ont été ajoutées, portant G.9 de 9 à 11 tests :

1. Prix incompatible refusé avec **zéro intention en base** et zéro mutation Stripe, puis publication concurrente entre validation et création : `COMMERCIAL_CONFLICT` et toujours zéro intention.
2. Webhooks d'un autre compte ou d'un abonnement live refusés : périodes strictement identiques, aucun paiement, aucune preuve de traitement et audit commercial inchangé. La reprise valide crée une seule preuve/un seul paiement observé ; son doublon est ignoré et le contrat conserve ses conditions.

Le diagnostic courant [stripe-safety-probe.cjs](g9-validation/stripe-safety-probe.cjs) vérifie les trois refus, avec zéro mutation fournisseur. Son exit 0 signifie désormais que ces régressions sont corrigées. L'ancienne version du diagnostic est archivée séparément ; elle décrit les anciens écarts et ne doit pas être interprétée comme un test courant.

## 3. Résultats complets après correction

Campagne séquentielle dans `/private/tmp/revynora-g9-frozen-validation`, installation correspondant exactement au lockfile. Les sources applicatives validées correspondent aux fichiers du dépôt, empreintes consignées dans le JSON. Aucun seuil abaissé ni exclusion de couverture ajoutée.

| Validation                                                   | Résultat                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API complète, unitaires et PostgreSQL/Redis, avec couverture | **163 tests, 26 fichiers réussis** ; inclut les 99 unitaires et les 11 intégrations G.9                                                                 |
| Unitaires Stripe                                             | **38 réussis**, inclus dans les chiffres API                                                                                                            |
| Admin avec couverture                                        | **49 tests réussis**                                                                                                                                    |
| Web avec couverture                                          | **44 tests réussis**                                                                                                                                    |
| Mobile avec couverture                                       | **24 tests réussis**                                                                                                                                    |
| API client avec couverture                                   | **3 tests réussis**                                                                                                                                     |
| Playwright G.2–G.9                                           | **25 scénarios réussis**, dont les 2 G.9 à 375/1280 px, Axe et absence de débordement                                                                   |
| Régressions G.1–G.8                                          | Fondations/permissions, supervision, statistiques, catalogue, finance et droits internes préservés dans les suites API/Admin et les scénarios existants |
| TypeScript API, Admin, Web, Mobile et packages               | Réussi                                                                                                                                                  |
| ESLint API, Admin, Web, Mobile, UI, API client               | Réussi                                                                                                                                                  |
| Builds packages, API, Admin, Web                             | Réussis                                                                                                                                                 |
| Export Mobile                                                | Bundles Android et iOS réussis, sans publication ni signature native                                                                                    |
| Permissions et audit                                         | Refus Admin sans capacité/étudiant/suspendu, confirmation stricte, concurrence, rollback de l'audit et séparation G.8 réussis                           |
| Frontières du monorepo                                       | Réussies, 5 tests du contrôleur réussis                                                                                                                 |
| Prisma validate / migrate status                             | Réussis ; les 12 migrations isolées sont à jour                                                                                                         |
| Migrations historiques / seed                                | Empreintes préservées ; aucune migration ni modification de schéma ajoutée pendant ces corrections                                                      |
| Prettier et git diff --check                                 | Réussis ; contrôle final de la documentation effectué avant remise                                                                                      |
| Reproduction négative hors ligne                             | Trois refus confirmés, zéro mutation fournisseur                                                                                                        |

| Couverture   | Statements | Branches | Fonctions |  Lignes | Seuils existants respectés                          |
| ------------ | ---------: | -------: | --------: | ------: | --------------------------------------------------- |
| API complète |    95,61 % |  88,44 % |   98,11 % | 95,61 % | Oui : 80 / 70 / 80 / 80                             |
| Admin        |    97,67 % |  88,28 % |   88,31 % | 97,67 % | Oui : 85 / 75 / 85 / 85                             |
| Web          |    96,40 % |  88,90 % |   88,11 % | 96,40 % | Oui : 85 / 75 / 85 / 85                             |
| Mobile       |    73,60 % |  66,47 % |   58,28 % | 74,47 % | Oui : 70 / 60 / 50 / 70 et seuil spécifique session |
| API client   |      100 % |  86,36 % |     100 % |   100 % | Oui : 85 / 75 / 85 / 85                             |

### Essais intermédiaires et limites de mesure

Un typage intermédiaire a échoué sur le mock de webhook après enrichissement de `BillingEvent`. La signature de `verify` a été explicitée avec ce contrat partagé ; les typages et tests complets ont ensuite réussi.

Une relance finale utilisait par erreur l'origine navigateur 3412 au lieu de `localhost:3002` attendue par les tests API. Le contrôle d'origine a correctement renvoyé 403 : 162 tests réussis et 1 échec de configuration. Le lanceur a été corrigé, sans changer la sécurité applicative, puis la suite complète a été reprise. Cet essai n'est pas présenté comme une réussite ; son statut et l'assertion 403/400 sont conservés dans les résultats. Le lanceur a réutilisé le nom du journal temporaire pour la reprise réussie ; le JSON distingue explicitement l'échec capturé et cette reprise.

Les lenteurs et échecs d'installation de la campagne antérieure restent documentés dans l'archive NO-GO. Les contrôles présents ont utilisé les dépendances figées de la copie, pas l'installation désynchronisée du dépôt principal. Les avertissements bénins de couleur de terminal et de dimensions Recharts sous JSDOM ne constituent pas des échecs de tests.

## 4. Installation locale : diagnostic et procédure proposée

L'installation principale **n'a pas été réécrite** pendant cette mission, conformément à la demande de proposer une procédure. Aucune version de dépendance, aucun manifest ni lockfile n'a été modifié.

Constat répété : `node_modules/.pnpm/lock.yaml` a l'empreinte `327f1899bee4640aef68c78125ee513c5eb749c8b2124409a876599f97f8c57f`, tandis que le lockfile du dépôt et celui de la copie figée ont `f301fa59bf4728c9228c22a89f059241e8ff0d17a441dd02b75f5b0e5a7bab6a`. Expo 57.0.30 est installé dans le dépôt contre 57.0.31 demandé. Cela démontre qu'un état d'installation antérieur est resté en place ; l'historique exact des commandes ayant produit cette dérive n'est pas établi.

`.modules.yaml` référence le magasin `~/Library/pnpm/store/v10`. Aucun `store-dir` n'est explicitement configuré dans le projet ; le chemin par défaut observé dans l'environnement de validation différait. Utiliser explicitement le magasin existant évite cette ambiguïté. Les lectures lentes de l'installation initiale sont décrites dans l'archive ; aucune corruption du cache ni responsabilité précise d'iCloud n'a été prouvée. L'installation figée indépendante a restauré les temps normaux sans purge.

Procédure reproductible à appliquer séparément si l'on veut rétablir le répertoire principal :

1. Vérifier la branche/HEAD, arrêter proprement les seules validations identifiées et s'assurer qu'aucun build ne consomme les dépendances. Ne pas arrêter les conteneurs de preuve ni nettoyer leurs volumes.
2. Sauvegarder les modifications et métadonnées avant l'installation. Depuis la racine :

```sh
g9_backup_dir=$(mktemp -d /private/tmp/revynora-g9-install-backup.XXXXXX)
git status --porcelain=v1 > "$g9_backup_dir/git-status.txt"
git diff --binary > "$g9_backup_dir/tracked.patch"
git ls-files --others --exclude-standard -z > "$g9_backup_dir/untracked.list0"
tar --null -T "$g9_backup_dir/untracked.list0" -czf "$g9_backup_dir/untracked.tgz"
cp pnpm-lock.yaml "$g9_backup_dir/pnpm-lock.yaml"
cp node_modules/.modules.yaml "$g9_backup_dir/modules-before.yaml"
cp node_modules/.pnpm/lock.yaml "$g9_backup_dir/installed-lock-before.yaml"
```

Les `.env` ignorés par Git ne font pas partie de cette archive. Conserver également les dossiers de journaux déjà présents sous `/private/tmp` et les deux conteneurs de recette ; aucun des chemins de preuve n'est visé par la commande d'installation.

3. Utiliser pnpm 10.18.3, tel que déclaré par `packageManager`, avec une version Node conforme à `>=22 <25`. Vérifier `pnpm --version` puis installer sans mise à jour de version :

```sh
pnpm install --frozen-lockfile --store-dir /Users/behnoodpazhang/Library/pnpm/store/v10
```

Ne pas utiliser `--force` ou une purge de cache. Si pnpm demande une suppression complète des dépendances, ne pas accepter automatiquement : conserver l'installation existante et reprendre la méthode de copie isolée employée pour cette recette. Les paquets manquants peuvent être téléchargés depuis le registre npm ; cela ne nécessite aucun appel Stripe.

4. Vérifier la concordance avant de relancer les applications :

```sh
cmp pnpm-lock.yaml node_modules/.pnpm/lock.yaml
node -e 'console.log(require("./apps/mobile/package.json").dependencies.expo, require("./apps/mobile/node_modules/expo/package.json").version)'
git diff -- pnpm-lock.yaml package.json apps/mobile/package.json
```

Le résultat attendu est 57.0.31 des deux côtés, un lockfile identique et aucun nouveau changement de versions.

5. Régénérer le client Prisma avec une URL de test explicite, puis construire les packages partagés avant les contrôles applicatifs. Ces commandes n'appliquent aucune migration :

```sh
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:generate
API_URL=http://127.0.0.1:3411 pnpm exec turbo build --filter='./packages/*' --concurrency=1
API_URL=http://127.0.0.1:3411 pnpm typecheck
```

`TEST_DATABASE_URL` doit être préalablement défini et vérifié comme URL de la base isolée `revynora_test` en loopback. Pour les intégrations, conserver les fournisseurs simulés et les origines locales attendues par leurs fixtures. Comparer ensuite l'état Git à la sauvegarde. Aucun commit, reset, migration applicative ou suppression des preuves n'est requis.

## 5. Préservation de l'Admin et des données

`apps/admin` et tous ses tests sont conservés. Aucune migration du Dashboard vers la route `/admin` d'`apps/web` n'a été commencée ; le routage et les applications existants restent en place. Aucune permission commerciale ni droit interne réel n'a été provisionné.

Les conteneurs PostgreSQL `revynora-g9-validation-20261026` (55439) et Redis `revynora-g9-redis-20261026` (56389) ont été réutilisés sans recréation, arrêt, reset ou purge. Les fixtures sont synthétiques et nettoyées par leurs identifiants propres ; les versions et audits immuables déjà présents sont conservés. Aucune requête de recette n'a visé la base applicative/production. Les douze migrations existantes n'ont pas été modifiées dans cette mission.

Les journaux de correction sont conservés dans `/private/tmp/revynora-g9-corrections-20261027`, les captures sous son dossier `browser`. Les journaux et métriques précédents restent conservés ; les éléments pérennes utiles sont repris dans les deux JSON du dépôt.

## 6. Risques résiduels et décision

- Aucune interaction Stripe distante n'a été utilisée : les lectures, mutations et webhooks testés sont simulés. Un test de bout en bout sur un vrai compte Stripe test reste hors autorisation et n'est pas présenté comme effectué.
- Les lectures Stripe et la transaction PostgreSQL ne sont pas une transaction distribuée. Une modification distante après le précontrôle peut provoquer l'échec de la seconde lecture ; l'intention locale éventuellement créée est alors marquée en échec et aucune session Stripe n'est créée par ce chemin. Il n'est pas prétendu que le système réserve atomiquement un état distant.
- Un compte fournisseur ou un planning préexistant incohérent est refusé ; une réconciliation explicitement autorisée peut être nécessaire. Aucun compte, prix ou contrat historique n'est réattribué automatiquement pour contourner le refus.
- Le magasin et l'installation principale restent à réaligner par la procédure proposée ; la validation actuelle est reproductible dans la copie figée dont les dépendances correspondent au lockfile.
- Pas de test sur appareil physique, signature native ou données de production. L'ancienne répétition de migration sur fixture G.8 demeure une preuve synthétique, pas une répétition sur données réelles représentatives.

**GO pour le commit local G.9 après validation utilisateur**, avec ces limites documentées. Aucun commit, push, merge, déploiement, modification bancaire ou changement de branche effectué. L'index reste vide. Attente de la validation avant tout commit.

## 7. État Git et fichiers

Branche et HEAD inchangés. Le périmètre G.9 compte **49 fichiers : 26 suivis modifiés et 23 nouveaux fichiers**. La liste des fichiers touchés par cette mission puis l'inventaire complet figurent ci-dessous et dans le JSON de correction.

### Fichiers touchés par cette mission (13)

```text
apps/api/src/billing/application/billing.use-cases.ts
apps/api/src/billing/domain/billing.ts
apps/api/src/billing/infrastructure/billing.provider.ts
apps/api/src/billing/infrastructure/prisma-billing.repository.ts
apps/api/src/billing/infrastructure/stripe-price.ts
apps/api/src/billing/infrastructure/stripe.provider.spec.ts
apps/api/src/commercial-catalog/commercial.integration.ts
apps/api/src/commercial-catalog/service.ts
docs/admin/G9-RECETTE.md
docs/admin/g9-validation/stripe-safety-probe.cjs
docs/admin/g9-validation/before-fix/stripe-safety-probe.cjs
docs/admin/g9-validation/before-fix/G9-RECETTE.md
docs/admin/g9-validation/corrections-20261027.json
```

### Inventaire complet G.9 (49)

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
apps/api/src/billing/infrastructure/stripe-price.ts
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
docs/admin/g9-validation/before-fix/G9-RECETTE.md
docs/admin/g9-validation/before-fix/stripe-safety-probe.cjs
docs/admin/g9-validation/corrections-20261027.json
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
