# Admin intégré — Phase 2B : consultations utilisateurs et cours

## Référence

Branche locale `feature/admin-web-integration`.
La Phase 2A a été revue et enregistrée avec autorisation dans le commit
`ca72af1b07c0100688706dccdcfbfad5b6377abb` :
`feat(web): integrate admin dashboard overview and navigation` (18 fichiers).
Les sources correspondaient exactement à la copie validée ; aucun secret ou
fichier extérieur détecté. Aucun push effectué.

La Phase 2B reste non committée, index vide, en attente de validation.

## Routes et interface

| Route intégrée             | Consultation                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `/admin/utilisateurs`      | Recherche par nom/e-mail, liste et pagination de 20 comptes                         |
| `/admin/utilisateurs/[id]` | Identifiant, nom, e-mail, rôle, inscription, état et date de suspension si présente |
| `/admin/cours`             | Recherche titre/matière, catalogue éditorial et pagination de 20 cours              |
| `/admin/cours/[id]`        | Identifiant, titre, matière, origine, date et contenu textuel du cours éditorial    |

Les liens Utilisateurs et Cours sont actifs dans le shell. La rubrique active
reste identifiée depuis une fiche ; la fermeture mobile, Échap, le focus et les
liens de retour vers les listes sont conservés. Gestion commerciale,
Abonnements et Paiements restent désactivés et leurs routes renvoient 404.

Les contrats G.2 existants ne renvoient **ni abonnement individuel ni activité
pédagogique individuelle** sur la fiche utilisateur : ces informations ne sont
ni reconstruites, ni obtenues depuis des endpoints étudiants. Les filtres
existants sont la recherche nom/e-mail et titre/matière. Aucun faux filtre
rôle/état/date appliqué uniquement sur une page locale n'est introduit.
Aucun endpoint ni contrat API n'a été étendu dans ce lot.

## Réutilisation

Les modules UsersView, UserDetail, CatalogList et CatalogDetail existants sont
repris dans `apps/web/modules/admin`, avec les adaptations nécessaires : préfixe
`/admin`, imports Web locaux, écrans utilisateurs limités à la consultation,
et masquage des données pendant chargement ou erreur. Les commandes de
suspension/réactivation et AccessConfirmation ne sont pas reprises.

Les composants génériques proviennent toujours de `@revynora/ui` ; les contrats
restent dans `@revynora/types`. Le hook Web `useResource`, le client API et les
formatteurs Admin de la Phase 2A sont réutilisés. Aucun import entre applications,
aucune nouvelle copie de composant UI commun et aucun changement de `apps/admin`.

Recherche utilisateur encodée et limitée à 100 caractères ; catalogue appliqué
à la soumission, avec recherche tronquée par la limite du champ et contrôlée
par le contrat API existant. Un changement de recherche ou de page remonte le
bloc de résultats pour ne pas afficher l'ancienne liste sous de nouveaux filtres.
Les paramètres des fiches sont encodés et leurs composants sont remontés par ID.
Le contenu du cours est rendu en texte React, sans HTML interprété.

## Protections conservées

- Layout SSR Phase 1 inchangé : cookie opaque, vérification de session et rôle,
  suspension, `no-store`, API indisponible fermant l'accès.
- Contrôles API existants `AdminGuard`, `users/read`, `catalogCourses/read` à
  chaque lecture, avec validation des identifiants et recherches.
- Réponses 401 : reconnexion Web existante avec retour strictement local vers
  `/admin`. Aucun élargissement des destinations de retour.
- Erreurs de permission, 404, 503 et chargement : aucune ancienne donnée de liste
  ou fiche rendue ; boutons de reprise dédiés.
- Catalogue API limité aux cours `source=ADMIN`, `ownerId=null` ; les cours USER
  privés ne sont accessibles ni par recherche ni par identifiant Admin.
- Cookies HttpOnly et client `same-origin` inchangés ; aucun cache public.
- Aucune mutation métier, attribution ADMIN, droit pédagogique G.8 ou permission
  commerciale G.9 créée par l'interface. Le logout existant reste inchangé.

## Tests réellement exécutés

Validation dans `/private/tmp/revynora-admin-web-phase2b-validation`, avec les
sources de ce lot et les dépendances figées de la copie G.9 déjà validée. Aucun
secret d'environnement copié, aucun changement de version, manifest ou lockfile.
Les sources finales sont comparées à la copie ; seuls formatage et documentation
suivent les validations.

| Vérification                                   | Résultat final                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Web avec couverture                            | **117 tests réussis**, 14 fichiers, dont les 96 tests antérieurs                                   |
| Couverture Web                                 | **97,34 %** lignes/statements, **91,45 %** branches, **91,16 %** fonctions                         |
| Quatre pages et modules utilisateurs/catalogue | **100 %** lignes, statements, branches et fonctions                                                |
| Seuils Web                                     | Inchangés : 85 lignes/statements/fonctions, 75 branches                                            |
| Admin existant avec couverture                 | **49 tests réussis**, 15 fichiers ; seuils inchangés respectés                                     |
| Couverture Admin                               | 97,57 % lignes/statements, 88,02 % branches, 88,31 % fonctions                                     |
| Playwright                                     | **14 scénarios réussis**, aucun ignoré : 9 existants et 5 supplémentaires                          |
| Responsive                                     | Accueil et quatre consultations à **375, 768, 1280 px**, sans débordement horizontal               |
| Axe                                            | **Zéro violation** sur l'accueil et les quatre consultations aux trois largeurs, sans règle exclue |
| TypeScript Web                                 | Réussi                                                                                             |
| ESLint Web                                     | Réussi                                                                                             |
| Build Web et packages dépendants               | Réussi ; les quatre routes sont dynamiques SSR                                                     |
| Frontières et tests du contrôleur              | Réussis, **5 tests** réussis                                                                       |
| Intégrité Prisma historique                    | Réussie                                                                                            |
| Prettier et `git diff --check`                 | Réussis                                                                                            |

Les tests unitaires couvrent listes, fiches, recherche encodée, application des
filtres et retour page 1, pagination, pages vides, réponse absente, erreurs et
reprise, données anciennes masquées et contenu de cours non interprété.
Les tests de navigation couvrent les rubriques actives sur les URLs imbriquées.
Les 27 cas SSR de fondation sont conservés.

Les navigateurs utilisent uniquement le PostgreSQL isolé existant
`revynora-g9-validation-20261026`, port `127.0.0.1:55439`, base `revynora_test`.
API locale 3451, build Web local 3450, worker désactivé et fournisseurs Mock.
Le build API G.9 validé est réutilisé ; ses sources sont inchangées. Aucun reset,
seed ni migration exécuté. Comptes/cours aléatoires créés puis supprimés, dont
un cours privé explicitement exclu du catalogue et refusé par son identifiant.

Les scénarios réels couvrent recherche, pagination de 21 résultats, liens et
retours, fiches, cours privé, cookie HttpOnly, refus sans session/STUDENT,
expiration et suspension persistées. Les quatre URLs imbriquées sont testées
contre chaque état d'authentification ; les endpoints API sont également
contrôlés (403 étudiant, 401 expiré/suspendu). Les réponses de fiches autorisées
confirment `Cache-Control: no-store`.

Une partie du dernier scénario intercepte les seules données de fiche utilisateur
pour vérifier 403, masquage puis reprise 503, et les données de liste catalogue
pour vérifier le vide. Le contrôle SSR de session utilise toujours l'API réelle.
Les unités couvrent aussi les pannes de chacune des quatre consultations.

Essai intermédiaire : le typage a relevé `passwordHash` manquant dans les comptes
éphémères de pagination. Une empreinte scrypt de mot de passe aléatoire a été
ajoutée à la fixture ; typage autonome et build ont ensuite réussi. La première
campagne Web avec couverture et la campagne navigateur ont réussi. Aucune règle
ni aucun seuil n'a été assoupli. Aucun test demandé n'est laissé interrompu ou
en échec au terme de cette campagne.

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

La commande navigateur exige un build API existant et `TEST_DATABASE_URL`
explicitement configuré vers la base isolée déjà migrée. La configuration refuse
une cible autre que `127.0.0.1/revynora_test`.

## Activation, limitations et rollback

`ADMIN_WEB_INTEGRATION_ENABLED` reste à `false` dans l'exemple. Seule la valeur
serveur exacte `true` active l'espace intégré. Désactivée, la vérification SSR
reste en place et redirige vers l'application Admin historique.

Rollback fonctionnel : désactiver ce paramètre puis redémarrer le runtime Web
selon une procédure autorisée ; aucun rollback de données n'est nécessaire.
`apps/admin` reste intacte et toutes les branches antérieures sont préservées.

Limites : aucune information utilisateur hors du contrat G.2, aucun filtre
additionnel sans support API, aucune modification de compte/cours, aucune
intégration des lots 2C–2E. Le cookie Secure n'est pas validé en HTTPS par le
navigateur local HTTP. Les 25 scénarios historiques de l'application Admin
séparée ne sont pas relancés dans ce lot ; sa suite de 49 tests reste réussie.
Aucune nouvelle CI GitHub exécutée pour ces modifications non publiées ; le
raccordement CI des nouvelles suites demeure un chantier ultérieur.

**GO technique pour revue et commit local Phase 2B, sous nouvelle validation.**
Aucun commit 2B, push, merge, déploiement, migration applicative ou de production,
changement Stripe/bancaire ou paramètre Vercel effectué.

## Inventaire Phase 2B (17 fichiers)

```text
apps/web/app/admin/admin.css
apps/web/app/admin/cours/page.tsx
apps/web/app/admin/cours/[id]/page.tsx
apps/web/app/admin/utilisateurs/page.tsx
apps/web/app/admin/utilisateurs/[id]/page.tsx
apps/web/components/admin/admin-shell.tsx
apps/web/modules/admin/catalog/catalog-detail.tsx
apps/web/modules/admin/catalog/catalog-list.tsx
apps/web/modules/admin/users/user-detail.tsx
apps/web/modules/admin/users/users-view.tsx
apps/web/tests/admin-catalog-routes.test.tsx
apps/web/tests/admin-catalog.test.tsx
apps/web/tests/admin-foundation-e2e/session.spec.ts
apps/web/tests/admin-foundation.test.tsx
apps/web/tests/admin-shell.test.tsx
apps/web/tests/admin-users.test.tsx
docs/admin/ADMIN-WEB-INTEGRATION-PHASE2B.md
```
