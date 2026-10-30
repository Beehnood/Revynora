# Admin intégré — Phase 2E : gestion commerciale G.9

État du 29 octobre 2026, branche `feature/admin-web-integration`.

## Références et périmètre

La Phase 2D a été contrôlée et enregistrée avec autorisation :
`c81734e6d0e8d8cf0977ff2605a49b13d743b427`,
`feat(web): integrate admin account actions and G8 grants` (15 fichiers).
Seules les références Git obsolètes de sa documentation ont été actualisées.
Le commit intermédiaire de recette d’inscription
`4f7a5886b0f462aa186ce27b900febf4413dca8d` et ses quatre fichiers sont préservés.
La Phase 2E reste non commitée et n’est pas publiée.

La route `/admin/offres` reprend la gestion commerciale existante de
`apps/admin/modules/commercial/commercial-panel.tsx` :

- Catalogue Free, Plus et Pro, versions, brouillons et comparaison des conditions.
- Nom, prix en centimes d’euro, disponibilité, fonctionnalités et motif.
- Activation/retrait via un nouveau brouillon puis publication confirmée, sans
  nouvel endpoint d’activation directe. Free reste gratuit et disponible.
- Publication avec révision attendue et identifiant de version confirmé.
- Association d’un prix Stripe test existant, sans création/modification distante.
- Versions publiées immuables, historique paginé, refus et conflits explicites.

Le lien « Gestion commerciale » est actif et indique la route courante dans
la navigation responsive. Aucun nouvel écran d’abonnement étudiant, paiement,
remboursement, versement ou gestion de permission n’est ajouté.

## Réutilisation et adaptation Web

Le panneau commercial existant est porté dans
`apps/web/modules/admin/commercial`, avec les mêmes contrats, motifs et
commandes. `apps/admin` reste strictement intacte ; aucun import entre applications.
Les composants `@revynora/ui`, le client API Web, `useResource` et les formatteurs
Admin intégrés `money`/`dateLabel` sont réutilisés. Les types de réponse locaux
reprennent ceux du panneau existant ; aucun type Prisma n’entre dans l’UI.

Les adaptations concernent le conteneur Web, les styles préfixés
`.integrated-admin`, les états de chargement/absence/erreur et la reprise :

- Aucune offre ni commande commerciale tant que la lecture autorisée n’a pas réussi.
- Les anciennes offres sont masquées pendant une relecture ou après son erreur.
- L’historique est monté après la réussite du catalogue ; ses anciennes lignes
  sont masquées lors de son propre chargement/échec.
- Le changement de page remonte la ressource d’historique, sans conserver la
  page précédente visible. Limite API de 20 événements, page maximale 10000 ;
  l’absence de total et la possibilité d’une page suivante vide sont indiquées.
- Après mutation, catalogue et historique sont relus, sans résultat optimiste.
- Refus 401/403 de mutation : revalidation des lectures ; 401 conserve la
  reconnexion globale existante. Conflit/indisponibilité : erreur et bouton
  d’actualisation en lecture seule. Aucune mutation de remplacement.
- La confirmation de publication est réinitialisée après chaque tentative.
  Les verrous de soumission existants sont conservés.

## Contrats API et sécurité

Préfixe commun `/api/v1`, API NestJS et base partagées inchangées.

| Endpoint existant                                  | Contrat                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/commercial/offers`                     | Catalogue et versions avec associations fournisseur et version de départ                                                         |
| `GET /admin/commercial/history?page=…`             | Audits commerciaux, 20 par page                                                                                                  |
| `POST /admin/commercial/offers/:id/drafts`         | `expectedRevision`, nom, prix, devise EUR, intervalle none/month, disponibilité, fonctionnalités et motif de 10 à 500 caractères |
| `POST /admin/commercial/versions/:id/publish`      | `expectedRevision` et `confirmVersionId` correspondant à la version affichée                                                     |
| `POST /admin/commercial/versions/:id/verify-price` | `priceId` d’un prix Stripe test existant                                                                                         |

Le layout SSR existant valide session, rôle ADMIN et absence de suspension
avant de rendre le parcours intégré. Chaque lecture et mutation G.9 revalide
côté API le rôle, l’état actif et la ligne **CommercialPermission** spécifique.
L’interface ne crée ni n’accorde cette permission. Un ADMIN sans capacité G.9
reçoit un refus sans données ni commandes commerciales. G.8 ne confère pas G.9.

Le client conserve les cookies HttpOnly/SameSite, `same-origin`, `no-store` et
le marqueur CSRF `X-Revynora-Client: web`. L’API conserve son contrôle d’origine,
les schémas stricts, les verrous et contrôles de révision, les audits atomiques
et les réponses 409. Aucun assouplissement des règles ni nouveau droit.

Les prix historiques sont lus depuis leurs contrats, jamais remplacés par le
prix courant. Un retrait ne supprime pas les droits contractuels existants.
La publication ne modifie ni périodes historiques ni paiements. Une version
publiée ne présente aucune commande de modification dans l’interface.

L’association Stripe reste protégée côté serveur : clé de test obligatoire,
prix compatible/actif, environnement test et identité du compte contrôlés par
les règles G.9 existantes. Les seuls appels fournisseur autorisés par ce contrat
sont des lectures. Aucun appel Stripe réel n’a été fait pendant cette phase.

## Validation réelle

Essais dans `/private/tmp/revynora-admin-web-phase2e-validation`, archive du HEAD
avec superposition des sources de Phase 2E, sans copie d’environnement secret.
Dépendances figées réutilisées depuis `/private/tmp/revynora-g9-frozen-validation`.
Versions, lockfile et installation principale inchangés. Les sources finales
sont comparées à la copie validée.

| Contrôle                              | Résultat                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Web avec couverture                   | **184 tests réussis**, 21 fichiers                                                                                                  |
| Couverture Web                        | **97,75 %** lignes/statements, **92,31 %** branches, **93,44 %** fonctions                                                          |
| Panneau commercial Web                | **98,98 %** lignes/statements, **91 %** branches, **100 %** fonctions                                                               |
| Admin existant avec couverture        | **49 réussis**, 15 fichiers, dont les six tests commerciaux existants                                                               |
| Couverture Admin                      | **97,57 %** lignes/statements, **88,05 %** branches, **88,31 %** fonctions                                                          |
| API complète et PostgreSQL isolé      | **163 réussis**, 26 fichiers, dont les 11 intégrations commerciales G.9                                                             |
| Couverture API                        | **95,61 %** lignes/statements, **88,51 %** branches, **98,11 %** fonctions                                                          |
| Playwright commercial intégré         | **6 réussis**, aucun ignoré                                                                                                         |
| Régressions Playwright socle/2A/2B/2C | **19 réussis**, aucun ignoré                                                                                                        |
| Régressions Playwright actions 2D     | **5 réussis**, aucun ignoré                                                                                                         |
| Axe et responsive commercial          | Zéro violation, aucun débordement horizontal à **375, 768 et 1280 px**                                                              |
| TypeScript et ESLint Web              | Réussis, sans avertissement ESLint final                                                                                            |
| Build Web et packages dépendants      | Réussi, `/admin/offres` dynamique SSR                                                                                               |
| Frontières et tests de frontières     | Réussis, **5 tests**                                                                                                                |
| Prisma                                | Schéma valide ; **12 migrations** appliquées en recette, sommes de contrôle cohérentes ; aucune migration exécutée dans cette phase |
| Intégrité Prisma historique           | Réussie, migrations et seed inchangés                                                                                               |
| Prettier et `git diff --check`        | Réussis                                                                                                                             |

Seuils inchangés : Web 85 % lignes/statements/fonctions et 75 % branches,
API 80 % lignes/statements/fonctions et 70 % branches ; seuils Admin préservés.
Aucun test supprimé ou ignoré et aucune limite relevée.

Les navigateurs vérifient réellement la préparation, le retrait puis la
réactivation de Plus, la publication confirmée, l’immutabilité d’une version
publiée, l’audit et la conservation du prix et de la version d’un contrat
historique de fixture. Un deuxième brouillon publié concurremment provoque
un vrai 409, sans publication du brouillon obsolète. Les cas étudiant, ADMIN
sans permission, session expirée/suspendue, CSRF et origine étrangère sont refusés.
Une panne catalogue simulée masque les offres et permet une reprise.

Le navigateur vérifie le refus Stripe sans configuration test (422, aucune
association créée). L’association réussie et sa publication sont couvertes par
les intégrations API avec lectures Stripe simulées : compatibilité du prix,
identité de compte/environnement, récurrence, concurrence et absence de mutation
distante. La suite API vérifie aussi les anciens prix, le checkout contractuel,
les audits atomiques et l’idempotence du rapprochement fournisseur.

Les serveurs utilisent uniquement `revynora_test` sur loopback port 55439,
PostgreSQL de recette préexistant, Redis de recette port 56389 pour la suite API,
fournisseurs Mock et worker navigateur désactivé. Les suites navigateur sont
séquentielles avec redémarrage des serveurs entre suites, sans modifier leurs
limiteurs. Les rôles/capacités des seuls comptes synthétiques sont préparés
directement dans cette base isolée ; aucune attribution automatique applicative.

## Résultats intermédiaires et preuves

- TypeScript a d’abord détecté un mauvais nom de modèle Prisma dans le nouveau
  test navigateur ; corrigé en `commercialProviderPrice` avant la réussite finale.
- Premier passage commercial : six scénarios marqués en échec. Le nettoyage
  tentait de supprimer des audits append-only, correctement refusés par PostgreSQL,
  et oubliait la dépendance restrictive CommercialPermission. Deux sélecteurs
  d’alerte étaient aussi ambigus avec l’annonceur Next.js. Le nettoyage conserve
  désormais les versions/audits et retire les permissions de ses fixtures avant
  les utilisateurs ; les sélecteurs ciblent les erreurs métier. Les six cas ont
  ensuite réussi. Aucune protection de base désactivée.
- Premier passage des régressions : 16 réussites, trois échecs car le test attendait
  encore cinq liens et une rubrique future. Les attentes sont actualisées à six
  liens opérationnels et aucune rubrique future, avec vérification de `/admin/offres`.
- Un contrôle ponctuel de migrations a initialement échoué sur le chemin local du
  client Prisma ; corrigé, les 12 sommes de contrôle ont ensuite été vérifiées.

Le catalogue de recette est restauré après les scénarios ; les nouvelles
versions commerciales et leurs audits sont conservés immuables dans la base
isolée, conformément à G.9. Des fixtures du premier passage échoué ont été
conservées ; leurs **cinq permissions commerciales** ont été identifiées par
leur provenance de recette unique et retirées après les essais. Aucun audit,
conteneur ou fichier de preuve supprimé et aucune donnée applicative touchée.

Preuves hors Git :

- `/private/tmp/revynora-admin-phase2e-web.log`
- `/private/tmp/revynora-admin-phase2e-api.log`
- `/private/tmp/revynora-admin-phase2e-browser-commercial-attempt1.log`
- `/private/tmp/revynora-admin-phase2e-browser-commercial-attempt2.log`
- `/private/tmp/revynora-admin-phase2e-browser-baseline.log`
- `/private/tmp/revynora-admin-phase2e-browser-baseline-attempt2.log`
- `/private/tmp/revynora-admin-phase2e-browser-actions.log`
- `/private/tmp/revynora-phase2e-commercial-attempt1-contexts`
- `/private/tmp/revynora-phase2e-baseline-attempt1-contexts`

## Inventaire exact — 9 fichiers

Modifiés (4) :

- `apps/web/app/admin/admin.css`
- `apps/web/components/admin/admin-shell.tsx`
- `apps/web/tests/admin-shell.test.tsx`
- `apps/web/tests/admin-foundation-e2e/session.spec.ts`

Ajoutés (5) :

- `apps/web/app/admin/offres/page.tsx`
- `apps/web/modules/admin/commercial/commercial-panel.tsx`
- `apps/web/tests/admin-commercial.test.tsx`
- `apps/web/tests/admin-foundation-e2e/commercial.spec.ts`
- `docs/admin/ADMIN-WEB-INTEGRATION-PHASE2E.md`

## Limites, activation et rollback

Cette phase n’exécute pas de validation HTTPS de production, de CI distante,
d’association Stripe avec un service réel ou de déploiement. Le contrôle Secure
sur TLS local relève de la recette d’inscription séparée ; il ne remplace pas
une recette du domaine de production. Les navigateurs historiques de l’application
Admin séparée ne sont pas relancés ; ses sources sont intactes et ses 49 tests
existants réussissent.

Le contrat G.9 actuel se limite à EUR, Free sans récurrence et Plus/Pro mensuels ;
aucune périodicité ou devise nouvelle n’est ajoutée. L’historique paginé ne fournit
pas de total. Les permissions ne sont pas surveillées en continu : elles sont
revalidées côté API à chaque requête, et aucun échec n’autorise de mutation locale.

`ADMIN_WEB_INTEGRATION_ENABLED` reste **false par défaut**, opt-in serveur exact
`true` uniquement. Sans activation, le pont vers `apps/admin` reste en place après
les contrôles SSR. Une activation future demande une recette de l’origine API,
des cookies HTTPS, de la capacité commerciale explicitement préexistante et du
mode Stripe test, sans création automatique de permission.

Rollback du parcours : désactiver le flag pour revenir à l’application Admin
historique. Rollback du code après commit autorisé : revert ciblé Phase 2E,
sans modifier les migrations ou les contrats. Une version déjà publiée reste
immuable ; toute correction commerciale passe par un nouveau brouillon et une
publication confirmée, jamais une suppression d’audit ou une réécriture des prix
historiques.

## État Git et décision

Branche `feature/admin-web-integration`, HEAD
`c81734e6d0e8d8cf0977ff2605a49b13d743b427`, index vide. Les neuf fichiers ci-dessus
constituent les seules modifications Phase 2E. `apps/admin`, backend, packages,
lockfile, Prisma, recette d’inscription et paramètres Vercel inchangés.

**GO technique pour le commit local Phase 2E, sous validation du propriétaire.**
Les 30 scénarios Playwright sont réussis (19 socle, 5 actions G.8, 6 commerciaux),
sans scénario ignoré. Aucun contrôle final échoué ou interrompu. Le scan des
ajouts et du diff ne révèle aucun secret ni fichier confidentiel.
Aucun commit Phase 2E, push, merge, déploiement, migration applicative/production,
changement Stripe réel ou bancaire effectué. Validation du propriétaire requise
avant le commit Phase 2E.
