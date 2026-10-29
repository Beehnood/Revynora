# Admin intégré — Phase 2C : abonnements et paiements

État du 29 octobre 2026, branche `feature/admin-web-integration`.

## Référence et routes

La Phase 2B a été contrôlée puis enregistrée localement avec autorisation :
`8d3996d5125e8b3f64d13dffecaf89a8822e934f`,
`feat(web): integrate admin users and catalog views` (17 fichiers).
Inventaire conforme, sources identiques à la copie validée, index initial vide,
aucun secret détecté, `apps/admin` intacte et activation désactivée par défaut.
Aucun push effectué.

La Phase 2C ajoute uniquement :

| Route                | Consultation et filtres G.6                                                    |
| -------------------- | ------------------------------------------------------------------------------ |
| `/admin/abonnements` | Périodes enregistrées ; fournisseur, statut et offre ; pagination de 20 lignes |
| `/admin/paiements`   | Paiements enregistrés ; fournisseur et statut ; pagination de 20 lignes        |

Les liens correspondants sont actifs, avec indication de rubrique courante.
La gestion commerciale reste désactivée et `/admin/offres` renvoie 404.
Les contrats G.6 stricts ne proposent pas de recherche textuelle : aucun champ
sans support API ni nouveau filtre n'est inventé.

## Modules réutilisés et sémantique

Le panneau `apps/admin/modules/billing/billing-panel.tsx` est repris dans
`apps/web/modules/admin/billing`, avec imports Web locaux et masquage des données.
Aucun import entre applications et aucun changement de `apps/admin`.
`@revynora/types`, `@revynora/ui`, le client API, `useResource` et les formatteurs
Admin intégrés sont réutilisés. Les styles supplémentaires restent préfixés
`.integrated-admin`.

Le bloc de résultats est remonté par type, page et filtres. Une nouvelle requête
ne conserve donc pas l'ancienne liste visible. Chargement, erreur, réponse
absente, liste vide, filtres sans résultat et page vide sont distingués.
Les anciennes données et les offres sont masquées en cas d'erreur ou chargement
de leur propre ressource ; la reprise réutilise les lectures existantes.

La sémantique financière G.6 est conservée :

- PAID et REFUNDED sont des statuts enregistrés, jamais une certification
  d'encaissement ou de remboursement réel.
- Les données Mock sont explicitement des simulations ; les autres paiements
  restent non vérifiés selon le contrat existant.
- Aucun total encaissé ou revenu net n'est calculé.
- Un statut de période ACTIVE ne prouve ni paiement ni droit actuel.
- Les montants contractuels historiques ne sont pas remplacés par les prix
  catalogue. Le bloc d'offres décrit les nouvelles souscriptions uniquement.
- Les euros sont formatés exactement ; aucune échelle ou conversion n'est
  présumée pour les autres devises.

Aucun remboursement, versement, checkout, changement de formule, modification
ou annulation d'abonnement n'est ajouté. Aucune commande financière n'est appelée.
La consultation d'offres existante n'intègre pas l'éditeur commercial G.9.

## Permissions et protections

Le layout SSR Phase 1 reste inchangé : vérification du cookie opaque, de la
session, du rôle et de la suspension via l'API commune, lecture `no-store`,
absence de contenu protégé en cas d'échec. Cookie HttpOnly/SameSite et client
`same-origin` inchangés. Le retour de connexion reste strictement local.

Les seuls endpoints de ce module sont les lectures existantes :

- `GET /api/v1/admin/subscriptions` : `AdminGuard`, permission `subscriptions/read`.
- `GET /api/v1/admin/payments` : `AdminGuard`, permission `payments/read`.
- `GET /api/v1/admin/offers` : `AdminGuard`, permission `offers/read`.

Les validations strictes des filtres et la limite de page 10000 restent côté API.
Les refus 401 déclenchent la reconnexion existante ; 403/404/503 affichent une
erreur et une reprise, sans ancienne donnée de la ressource en échec.
Aucun cache public, nouvelle permission, attribution ADMIN, droit G.8 ou
permission commerciale G.9. Aucune modification du backend, schéma ou migration.

## Résultats réels de validation

Validation séquentielle dans `/private/tmp/revynora-admin-web-phase2c-validation`,
avec sources de la branche et dépendances figées de la copie G.9 validée.
Aucun secret d'environnement copié ni réinstallation du dépôt principal.
Manifests, versions et lockfile inchangés. Les sources finales sont comparées à
la copie ; seuls formatage et documentation suivent les essais.

| Contrôle                                  | Résultat final                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Tests Web avec couverture                 | **134 réussis**, 16 fichiers ; inclut les 117 cas antérieurs                                         |
| Couverture Web                            | **97,47 %** lignes/statements, **92,06 %** branches, **91,70 %** fonctions                           |
| Panneau financier et deux nouvelles pages | **100 %** sur les quatre métriques                                                                   |
| Seuils Web                                | Inchangés : 85 lignes/statements/fonctions et 75 branches                                            |
| Tests Admin existants avec couverture     | **49 réussis**, 15 fichiers ; seuils respectés                                                       |
| Couverture Admin                          | 97,57 % lignes/statements, 88,02 % branches, 88,31 % fonctions                                       |
| Playwright                                | **19 réussis**, aucun ignoré : 14 antérieurs et 5 nouveaux                                           |
| Responsive et Axe                         | Les deux pages financières à **375, 768 et 1280 px**, zéro violation et aucun débordement horizontal |
| Régressions navigateur précédentes        | Accueil et consultations utilisateurs/cours réussis aux trois largeurs                               |
| TypeScript Web et ESLint Web              | Réussis                                                                                              |
| Build Web et packages dépendants          | Réussi ; les deux routes sont dynamiques SSR                                                         |
| Frontières du monorepo et tests           | Réussies, **5 tests** réussis                                                                        |
| Intégrité Prisma historique               | Réussie                                                                                              |
| Prettier et `git diff --check`            | Réussis                                                                                              |

Les unités couvrent filtres, pagination, retour à la page 1, montants exacts,
statuts distincts du réel, périodes historiques, annulations déjà enregistrées,
offres actuelles, chargement, vide, réponse absente et reprise. Les anciennes
données sont explicitement testées comme masquées pour 401, 403, 404 et 503.
Les 27 tests SSR de fondation sont conservés, ainsi que les tests de navigation.

Les navigateurs utilisent exclusivement le conteneur PostgreSQL isolé existant
`revynora-g9-validation-20261026`, port `127.0.0.1:55439`, base `revynora_test`.
API locale 3451, Web local 3450, worker désactivé, fournisseurs Mock. Le build API
G.9 validé est réutilisé, ses sources sont inchangées. Aucun reset, migration ou
seed exécuté. Les comptes, sessions et cours éphémères sont nettoyés.

Les permissions financières et en-têtes `Cache-Control: no-store` sont lus sur
la véritable API. Sans session, avec étudiant, expiration ou suspension, les
deux pages refusent l'accès et les endpoints donnent les 401/403 attendus.
Pour ces nouveaux cas, des sessions opaques hachées sont provisionnées uniquement
en base isolée ; la validation des cookies réellement émis à la connexion reste
couverte par les scénarios de fondation existants.

Les lignes financières, les offres et leurs variations de filtres sont des
réponses interceptées dans le navigateur, pas des écritures de Payment ou de
UserSubscriptionHistory. Aucun paiement, contrat ou montant historique n'est
créé pour ces tests. Une réponse différée vérifie le masquage immédiat après
changement de filtre, puis 403/404/503, reprise 200 et reconnexion sur 401.
Aucune règle Axe n'est exclue et aucun délai de test n'est augmenté.

Première campagne navigateur : **15 réussis et 4 échecs par délai dépassé**.
Les quatre échecs venaient de `getByLabel(..., exact: true)` sur les sélecteurs
imbriqués dans leurs labels avec les options. Les contrôles sont bien nommés
comme combobox dans l'arbre d'accessibilité. Les tests ont été corrigés pour les
cibler par rôle et nom accessible. Après cette seule correction des sélecteurs,
la campagne complète donne **19 réussis**. Les premiers contextes d'échec sont
conservés dans `/private/tmp/revynora-admin-phase2c-first-browser-results`.
La première campagne unitaire avec couverture, typage, lint et build a réussi.
Aucun test demandé ne reste échoué ou interrompu.

Commandes principales :

```sh
pnpm --filter @revynora/web test:coverage
pnpm --filter @revynora/admin test:coverage
pnpm --filter @revynora/web typecheck
pnpm --filter @revynora/web lint
API_URL=http://127.0.0.1:3451 pnpm build:web
G8_ISOLATED_TEST_DB=true pnpm --filter @revynora/web exec playwright test --config=playwright.admin-foundation.config.ts
node scripts/check-boundaries.mjs
node --test scripts/check-boundaries.test.mjs
node scripts/check-prisma-integrity.mjs
```

La suite navigateur exige un build API existant et `TEST_DATABASE_URL` explicite
vers la base isolée déjà migrée. Sa configuration refuse une cible autre que
`127.0.0.1/revynora_test`.

## Activation, limitations et rollback

`ADMIN_WEB_INTEGRATION_ENABLED` reste désactivé par défaut. Seule la valeur
serveur exacte `true` active les routes intégrées. Sinon, le pont historique
protégé reste en place. Aucun paramètre Vercel ou production modifié.
Rollback fonctionnel : désactiver l'activation puis redémarrer le runtime Web
selon une procédure autorisée ; aucun rollback de données n'est nécessaire.

Limites : le contrat G.6 n'atteste pas un encaissement réel et ne propose pas de
recherche textuelle. Le rendu détaillé des tableaux est validé avec des réponses
interceptées ; les autorisations réelles sont vérifiées séparément. Le cookie
Secure HTTPS n'est pas retesté dans le navigateur local HTTP. Les 25 scénarios de
l'application Admin séparée et l'API complète ne sont pas relancés dans ce lot ;
les 49 tests Admin sont réussis et aucun code backend n'a changé. Aucune nouvelle
CI GitHub n'est revendiquée pour ce travail local non publié. Les nouvelles
suites ne sont pas encore raccordées à une étape CI dédiée.

**GO technique pour revue et commit local Phase 2C, sous nouvelle validation.**
Aucun commit 2C, push, merge, déploiement, migration applicative/production,
changement Stripe/bancaire ou lot 2D/2E effectué. `apps/admin` reste intacte.

## Inventaire Phase 2C (10 fichiers)

```text
apps/web/app/admin/abonnements/page.tsx
apps/web/app/admin/admin.css
apps/web/app/admin/paiements/page.tsx
apps/web/components/admin/admin-shell.tsx
apps/web/modules/admin/billing/billing-panel.tsx
apps/web/tests/admin-billing-routes.test.tsx
apps/web/tests/admin-billing.test.tsx
apps/web/tests/admin-foundation-e2e/session.spec.ts
apps/web/tests/admin-shell.test.tsx
docs/admin/ADMIN-WEB-INTEGRATION-PHASE2C.md
```
