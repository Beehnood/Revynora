# Admin intégré — Phase 2A : accueil, statistiques et supervision

## Référence et périmètre

Branche `feature/admin-web-integration`, issue du main fusionné G.9
`eafeb16c0e41fa59a4ce5c4920c87b8332eb0356`.

La Phase 1 a été revue puis committée localement avec autorisation :
`b435799bb76b396386124fb420be403dc8528c6d`,
`feat(web): add secure integrated admin foundation` (12 fichiers).
Aucun push. La présente Phase 2A reste non committée en attente de validation.

Seul `/admin` est intégré : navigation, accueil, synthèse, statistiques G.3 et
supervision agrégée G.5. Les lots utilisateurs, catalogue, abonnements,
paiements et gestion commerciale G.9 ne sont pas commencés.

## Réutilisation et frontières

- `@revynora/ui` fournit Brand, Button, Card, PageHeader, Alert, Input,
  FormField, Badge et LoadingState ; aucun nouveau composant UI générique.
- `@revynora/types` conserve AdminMetrics, AdminStatistics et AdminSupervision.
- Le client `@revynora/api-client` et le hook Web `useResource` sont réutilisés.
- Les panneaux StatisticsPanel, RegistrationChart et SupervisionPanel de
  `apps/admin`, ainsi que leurs formatteurs de présentation, sont repris dans
  le périmètre Web avec imports locaux adaptés. Cette copie transitoire permet
  de garder `apps/admin` strictement intacte et évite tout import entre apps.
  Aucune extraction de package partagé nécessitant de modifier Admin n'est
  entreprise dans ce lot.
- Le shell reprend le comportement G.7 : navigation responsive, Échap, retour
  du focus et déconnexion avec effacement de l'état client par navigation complète.
- Les styles adaptés sont tous préfixés `.integrated-admin`, sans modification
  des styles partagés ou de l'espace étudiant.

Les rubriques futures sont des textes désactivés, sans `href`, avec « Bientôt ».
La seule destination Admin active est `/admin`. Les cinq URLs futures renvoient
404 : `/admin/utilisateurs`, `/admin/cours`, `/admin/offres`,
`/admin/abonnements`, `/admin/paiements`.

## Données et sécurité

La vérification SSR Phase 1 demeure inchangée. Sans session valide et ADMIN
actif, le contenu intégré n'est pas rendu. Le mode historique reste le choix
par défaut ; aucun nouveau paramètre public ou modification d'authentification.

Les seules lectures de l'accueil sont les endpoints existants :

- `GET /api/v1/admin/metrics?from=…&to=…`
- `GET /api/v1/admin/statistics?from=…&to=…`
- `GET /api/v1/admin/supervision?from=…&to=…`

Les permissions et suspensions restent vérifiées par l'API commune. Aucun accès
à des données pédagogiques individuelles, aucune mutation métier ni attribution
G.8/G.9. La déconnexion utilise seulement le endpoint existant `/auth/logout`.
Cookie HttpOnly et requêtes `same-origin`, marqueur CSRF, `no-store`, traitement
401 et retours strictement locaux sont conservés. Aucun cache public de données.

Les dates ne s'appliquent qu'après soumission d'un intervalle UTC de 1 à 366
jours, début inclus et fin exclue. Un changement de période remonte les panneaux
pour ne pas associer les anciennes données aux nouvelles dates. Les données sont
masquées pendant chargement ou erreur. Reprise et états sans données sont explicites.

La sémantique G.3/G.5 reste inchangée : coût IA estimé, simulations identifiées,
paiements enregistrés distincts de revenus réels, devises non converties sans
preuve, volumes d'abonnements distincts d'abonnés uniques. Aucun montant ancien,
paiement, livraison de rappel ou activité pédagogique n'est inventé.

## Résultats réellement exécutés

Validation séquentielle dans
`/private/tmp/revynora-admin-web-phase2a-validation`, avec sources de la branche
et dépendances figées de la copie G.9 validée. Aucune réinstallation du dépôt
principal ni modification du lockfile. Les sources finales sont comparées à la
copie de validation ; seuls formatage et documentation ont suivi les essais.

| Contrôle                                    | Résultat final                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| Web avec couverture                         | **96 tests réussis**, 11 fichiers, dont les 80 cas Phase 1                        |
| Couverture Web                              | **97,12 %** lignes/statements, **90,70 %** branches, **90,24 %** fonctions        |
| Seuils Web                                  | Conservés : 85 lignes/statements/fonctions, 75 branches                           |
| Admin existant avec couverture              | **49 tests réussis**, aucun fichier Admin modifié                                 |
| Couverture Admin                            | 97,57 % lignes/statements, 88,02 % branches, 88,31 % fonctions ; seuils respectés |
| Playwright du socle et de l'accueil         | **9 scénarios réussis**, aucun ignoré                                             |
| Responsive                                  | **375, 768 et 1280 px**, sans débordement horizontal                              |
| Axe                                         | **Zéro violation** aux trois largeurs, sans exclusion de règle                    |
| TypeScript Web                              | Réussi après correction d'une option de test invalide                             |
| ESLint Web                                  | Réussi                                                                            |
| Build Web et packages dépendants            | Réussi, `/admin` dynamique SSR                                                    |
| Frontières et leurs tests                   | Réussies, **5 tests** réussis                                                     |
| Intégrité des migrations historiques Prisma | Réussie                                                                           |
| Prettier et `git diff --check`              | Réussis                                                                           |

Les tests unitaires couvrent la navigation, les sections futures désactivées,
le menu clavier, la déconnexion, les KPI, les dates non appliquées avant
soumission, les intervalles invalides, les erreurs avec reprise, le vide, les
formats exacts des montants et les tableaux/graphique accessibles.
Les 27 tests de fondation conservent notamment les refus STUDENT, expiration,
suspension, API indisponible, profil malformé et mode historique.

Les scénarios navigateur réutilisent exclusivement PostgreSQL isolé
`revynora-g9-validation-20261026`, port `127.0.0.1:55439`, base `revynora_test`,
sans migration ni seed. API locale 3451, Web local 3450, fournisseurs Mock,
worker désactivé. L'API utilise son build G.9 validé, dont les sources sont
inchangées. Comptes éphémères créés puis supprimés.

Les cinq scénarios de fondation vérifient le cookie réel HttpOnly, la connexion,
les refus étudiant/expiré/suspendu et zéro attribution pédagogique ou permission
commerciale automatique. Trois scénarios responsive/Axe vérifient en plus les
réponses API agrégées autorisées et `Cache-Control: no-store`, les URLs futures
404 et la déconnexion effective (API Admin 401 après logout).
Le neuvième scénario intercepte uniquement les réponses de présentation des
agrégats pour contrôler chargement, 503, reprise et tableaux vides ; la session
SSR continue d'être contrôlée par la véritable API isolée.

Essais intermédiaires : deux essais unitaires ont échoué sur une simulation de
`window` incomplète dans le test de déconnexion ; la simulation a été corrigée.
Un typage a échoué sur l'option `exact` non admise par Testing Library ; corrigé.
La première campagne navigateur a donné 7 réussites et 2 échecs de sélecteur
(libellé du menu après ouverture, annonceur `alert` Next.js). Les sélecteurs ont
été corrigés puis les 9 scénarios relancés avec succès. Aucun échec intermédiaire
n'est compté comme une réussite et aucune règle d'accessibilité n'est désactivée.

Commandes principales, après build API/Web et configuration explicite de
`TEST_DATABASE_URL` vers la base isolée déjà migrée :

```sh
pnpm --filter @revynora/web test:coverage
pnpm --filter @revynora/admin test:coverage
pnpm --filter @revynora/web typecheck
pnpm --filter @revynora/web lint
pnpm build:web
G8_ISOLATED_TEST_DB=true pnpm --filter @revynora/web exec playwright test --config=playwright.admin-foundation.config.ts
node scripts/check-boundaries.mjs
node --test scripts/check-boundaries.test.mjs
node scripts/check-prisma-integrity.mjs
```

Pour cette configuration navigateur, construire Web avec
`API_URL=http://127.0.0.1:3451` afin que la réécriture du build cible l'API isolée.
La configuration refuse une base autre que `127.0.0.1/revynora_test`.

## Activation, limites et rollback

`ADMIN_WEB_INTEGRATION_ENABLED` doit valoir exactement `true` **côté serveur**.
Sans cette valeur, le pont protégé vers `ADMIN_ORIGIN` est conservé. L'exemple
reste à `false`. Aucune activation de production ou modification Vercel faite.
Le rollback fonctionnel consiste à revenir à `false` puis redémarrer le runtime
selon une procédure autorisée ; aucune restauration de base n'est nécessaire.

Les écrans métier et leurs actions ne sont pas migrés. Le cookie Secure HTTPS
n'est pas retesté par le navigateur local HTTP ; sa configuration API reste
inchangée. Les 25 scénarios historiques G.2–G.9 ne sont pas relancés dans ce lot ;
les 49 tests Admin existants passent. Les suites Web/Playwright de ce lot ne sont
pas encore raccordées à une nouvelle étape CI. Aucun résultat GitHub n'est
revendiqué pour ces modifications locales.

**GO technique pour revue et commit local Phase 2A, sous nouvelle validation du
propriétaire.** Aucun commit Phase 2A, push, merge, déploiement, migration
applicative, changement Stripe/bancaire ou lot 2B–2E effectué.

## Fichiers Phase 2A (18)

```text
apps/web/app/admin/admin.css
apps/web/app/admin/layout.tsx
apps/web/app/admin/page.tsx
apps/web/components/admin/admin-dashboard.tsx
apps/web/components/admin/admin-shell.tsx
apps/web/lib/admin-presentation.ts
apps/web/modules/admin/statistics/registration-chart.tsx
apps/web/modules/admin/statistics/statistics-panel.tsx
apps/web/modules/admin/supervision/supervision-panel.tsx
apps/web/tests/admin-dashboard.test.tsx
apps/web/tests/admin-foundation-e2e/session.spec.ts
apps/web/tests/admin-foundation.test.tsx
apps/web/tests/admin-presentation.test.tsx
apps/web/tests/admin-shell.test.tsx
apps/web/tests/admin-statistics.test.tsx
apps/web/tests/admin-supervision.test.tsx
apps/web/vitest.config.ts
docs/admin/ADMIN-WEB-INTEGRATION-PHASE2A.md
```
