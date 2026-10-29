# Admin intégré — Phase 2D : actions administratives et droits internes

État du 29 octobre 2026, branche `feature/admin-web-integration`.

## Référence et périmètre

La Phase 2C a été contrôlée puis enregistrée localement avec autorisation :
`215c36562ad358d86c202c67e3fa11bf9a086447`,
`feat(web): integrate admin subscriptions and payments views` (10 fichiers).
Le HEAD de départ était `8d3996d5125e8b3f64d13dffecaf89a8822e934f`.
Index initial vide, inventaire conforme à la documentation, aucun secret
détecté, pages financières en lecture seule et `apps/admin` intacte.
Aucun push.

Avant l’enregistrement de la Phase 2D, la recette d’inscription isolée a été
enregistrée séparément : `4f7a5886b0f462aa186ce27b900febf4413dca8d`,
`test(web): add isolated registration E2E validation` (quatre fichiers).
Ce commit intermédiaire ne contient aucun fichier Phase 2D.

La Phase 2D enrichit uniquement les routes existantes :

| Route                      | Actions                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/utilisateurs`      | Suspension/réactivation des étudiants, confirmation, motif et relecture de la liste                                              |
| `/admin/utilisateurs/[id]` | Même commande, journal borné des changements d’accès ; pour les bénéficiaires ADMIN, consultation, attribution et révocation G.8 |

Aucune route commerciale ni opération financière nouvelle. Les abonnements
et paiements restent en lecture seule. Aucun lot 2E commencé.

## Réutilisation et contrats

`access-confirmation.tsx` et ses deux tests reprennent le composant existant
de `apps/admin`, sans modifier cette application ni importer entre applications.
Les contrats `AdminAccessChange`, `AdminUser`, `AdminEvents`, les composants
`@revynora/ui`, le client API Web, `useResource` et les formatteurs existants
sont réutilisés. Les styles restent préfixés `.integrated-admin`.

Il n’existait pas d’écran de gestion des attributions G.8 dans `apps/admin` :
le nouveau panneau Web est une interface limitée aux API G.8 déjà implémentées,
sans changement de backend, de permission ou de modèle. Son type de réponse
reproduit les champs exposés par le contrat existant ; aucun import Prisma côté UI.

| Endpoint existant                             | Permission API et contenu                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `PATCH /admin/users/:id`                      | `users/suspend` ou `users/reactivate` ; `{disabled, confirmed: true, reason}`    |
| `GET /admin/events?from=…&to=…`               | Lecture des événements Admin, journal d’accès filtré localement par bénéficiaire |
| `GET /admin/users/:id/learning-grants?page=…` | `internalLearningGrants/read`, 20 entrées maximum par page                       |
| `POST /admin/users/:id/learning-grants`       | `internalLearningGrants/create` ; dates UTC, provenance et justification         |
| `PATCH /admin/learning-grants/:id/revoke`     | `internalLearningGrants/revoke` ; motif de révocation                            |

Les préfixes HTTP réels sont `/api/v1`. Motifs de suspension/réactivation :
`SECURITY_REVIEW`, `POLICY_REVIEW`, `USER_REQUEST`, `REVIEW_COMPLETED`.
Les commandes exigent une confirmation explicite dans l’interface. Les API G.8
strictes n’acceptent pas de champ `confirmed` : aucun champ non prévu n’est ajouté.
Provenance : 3 à 100 caractères ; justification et motif de révocation : 10 à 500.
Les dates de saisie sont explicitement UTC, l’expiration facultative est validée.

Les doubles soumissions sont bloquées. Après succès, les données sont relues,
sans changement optimiste ; le détail et son journal sont remontés pendant la
relecture. La liste conserve son filtre et sa page mais renouvelle les résultats,
y compris lorsqu’une action se termine après un changement de recherche.
Chargement, absence, erreur et reprise sont distingués. Les anciennes données de
la ressource ne sont pas affichées pendant sa relecture ni après son erreur.
Les erreurs de mutation proposent une actualisation en lecture seule.

## Sécurité et traçabilité

Le layout SSR, le cookie opaque HttpOnly/SameSite, les requêtes `no-store`,
la reconnexion sur 401 et les protections de retour local restent inchangés.
Le layout ne rend aucun contenu Admin avant validation de la session active
et du rôle. Les commandes utilisent le client existant avec marqueur
`X-Revynora-Client: web`, cookie `same-origin` et contrôle d’origine côté API.
Chaque mutation est à nouveau autorisée côté API, indépendamment de l’UI.
Sur refus 401/403 d’une mutation, les lectures parentes sont revalidées ; aucun
résultat optimiste n’est affiché. Les conflits 409 et indisponibilités sont
explicites, sans mutation de secours ni nouvelle commande financière.

Les comptes ADMIN ne présentent pas de commande de suspension/réactivation :
l’API existante protège également l’acteur et les comptes ADMIN. Une suspension
révoque les sessions de la cible ; la réactivation ne les restaure pas. Le motif,
l’auteur et le résultat sont enregistrés atomiquement par l’API existante.

G.8 n’est attribuable qu’à un bénéficiaire ADMIN actif selon le contrat actuel.
Un bénéficiaire suspendu peut être consulté et son attribution révoquée, sans
nouvelle attribution. Le serveur impose ces règles et la concurrence, et trace
`INTERNAL_LEARNING_GRANTED` / `INTERNAL_LEARNING_REVOKED`. Les dates, auteurs,
provenance, justification et motif de révocation sont affichés depuis les
enregistrements, sans reconstruire une histoire financière.

G.8 reste un accès pédagogique équivalent Pro : aucun changement de rôle,
paiement, abonnement commercial, prix ou permission G.9. Aucun accès automatique
n’est attribué à la connexion. Les scénarios vérifient ces invariants en base.

## Résultats réels de validation

Essais dans `/private/tmp/revynora-admin-web-phase2d-validation`, archive du
HEAD et superposition des sources modifiées. Dépendances figées réutilisées
depuis `/private/tmp/revynora-g9-frozen-validation`, sans réinstallation du dépôt
principal, changement de version ou copie de fichier d’environnement secret.
Sources finales comparées à cette copie ; seul le formatage et la documentation
suivent les essais applicatifs.

| Contrôle                                         | Résultat final                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Web avec couverture                              | **164 tests réussis**, 20 fichiers, aucun ignoré                                                                             |
| Couverture Web                                   | **97,67 %** lignes/statements, **92,42 %** branches, **92,76 %** fonctions                                                   |
| Admin existant avec couverture                   | **49 tests réussis**, 15 fichiers                                                                                            |
| Couverture Admin                                 | **97,57 %** lignes/statements, **88,02 %** branches, **88,31 %** fonctions                                                   |
| API complète avec PostgreSQL isolé et couverture | **163 tests réussis**, 26 fichiers                                                                                           |
| Couverture API                                   | **95,61 %** lignes/statements, **88,51 %** branches, **98,11 %** fonctions                                                   |
| Playwright, régressions socle/2A/2B/2C           | **19 réussis**, aucun ignoré                                                                                                 |
| Playwright, actions 2D et refus                  | **5 réussis**, aucun ignoré                                                                                                  |
| Responsive et Axe                                | Actions, confirmations G.8/suspension et résultats à **375, 768 et 1280 px**, zéro violation et aucun débordement horizontal |
| TypeScript Web et ESLint Web                     | Réussis, aucune erreur ni avertissement ESLint final                                                                         |
| Build Web et packages dépendants                 | Réussi, routes Admin dynamiques SSR                                                                                          |
| Frontières du monorepo                           | Réussies, **5 tests** de frontières réussis                                                                                  |
| Prisma                                           | Schéma valide, intégrité des migrations historiques et seed préservée                                                        |
| Prettier et `git diff --check`                   | Réussis                                                                                                                      |

Seuils inchangés : Web 85 % lignes/statements/fonctions et 75 % branches ;
API 80 % lignes/statements/fonctions et 70 % branches ; seuils Admin existants
conservés. Aucun test désactivé, aucun assouplissement des contrôles.

Les tests ajoutés couvrent confirmations, annulation/focus, verrous de
soumission, contrats exacts, dates invalides/expiration facultative, pagination
G.8, bénéficiaire suspendu, masquage des données, refus 401/403/409/503 et reprise.
Les tests API existants réexécutés couvrent permissions, suspensions concurrentes,
révocation des sessions, rollback si l’audit échoue, concurrence et séparation G.8.

Les nouveaux navigateurs utilisent l’API réelle et vérifient les effets en base :
suspension/réactivation, sessions supprimées sans restauration, auteur/motif/audit,
attribution/révocation et droits pédagogiques effectifs, absence de paiement,
d’historique d’abonnement créé et de permission commerciale. Les refus CSRF,
origine étrangère, étudiant, session expirée/suspendue et compte protégé sont
exercés ; un conflit G.8 réel et une panne 503 simulée n’altèrent pas la cible.

Résultats intermédiaires : un nouveau test de rafraîchissement de liste a échoué
et révélé un callback mal raccordé, corrigé avant la réussite des 164 tests.
Le premier passage des actions Playwright a eu 3 échecs et 2 réussites : le test
lisait `Origin` via les en-têtes partiels. Il utilise désormais `allHeaders()` ;
les cinq scénarios ont ensuite réussi sans relâcher l’assertion ni le serveur.
Un avertissement ESLint intermédiaire lié au callback inutilisé a été résolu.
Aucun contrôle final échoué ou interrompu.

Preuves conservées hors Git :

- `/private/tmp/revynora-admin-phase2d-web.log`
- `/private/tmp/revynora-admin-phase2d-api.log`
- `/private/tmp/revynora-admin-phase2d-browser-baseline.log`
- `/private/tmp/revynora-admin-phase2d-browser-actions.log` (premier passage)
- `/private/tmp/revynora-admin-phase2d-browser-actions-attempt2.log` (réussite finale)
- `/private/tmp/revynora-phase2d-actions-attempt1` (contextes d’échec conservés)

Les deux suites Playwright sont lancées séquentiellement, avec redémarrage des
serveurs entre elles pour respecter les limiteurs existants, sans relever leurs
limites. PostgreSQL `revynora-g9-validation-20261026`, loopback port 55439,
base `revynora_test` exclusivement ; Redis de recette port 56389 pour la suite
API. Les 12 migrations de recette préexistantes sont réutilisées, aucune migration
n’est lancée dans cette phase. Nettoyage des seules fixtures possédées par les
tests, aucun conteneur ni preuve supprimé. Providers Mock, worker désactivé pour
les navigateurs ; aucun appel Stripe réel.

## Inventaire exact — 15 fichiers

Modifiés (5) :

- `apps/web/app/admin/admin.css`
- `apps/web/modules/admin/users/user-detail.tsx`
- `apps/web/modules/admin/users/users-view.tsx`
- `apps/web/tests/admin-foundation-e2e/session.spec.ts`
- `apps/web/tests/admin-users.test.tsx`

Ajoutés (10) :

- `apps/web/modules/admin/users/access-confirmation.tsx`
- `apps/web/modules/admin/users/user-access-action.tsx`
- `apps/web/modules/admin/users/user-audit.tsx`
- `apps/web/modules/admin/learning-grants/learning-grants-panel.tsx`
- `apps/web/tests/admin-access-confirmation.test.tsx`
- `apps/web/tests/admin-access-actions.test.tsx`
- `apps/web/tests/admin-user-audit.test.tsx`
- `apps/web/tests/admin-learning-grants.test.tsx`
- `apps/web/tests/admin-foundation-e2e/actions.spec.ts`
- `docs/admin/ADMIN-WEB-INTEGRATION-PHASE2D.md`

## Limitations, risques et rollback

Le journal d’accès est explicitement borné aux 50 dernières entrées globales
sur les 30 derniers jours et la journée UTC courante, puis filtré par cible.
L’API existante ne permet ni filtre serveur par bénéficiaire ni pagination
d’audit : ce panneau ne garantit pas un historique exhaustif. Les attributions
G.8 exposent leurs propres auteurs et motifs persistés. Leur pagination sans
total peut présenter une page suivante vide ; cette limite est indiquée.

Les tests HTTPS de production/Secure et GitHub Actions ne sont pas exécutés dans
cette phase. Les navigateurs de l’application Admin séparée ne sont pas relancés ;
ses 49 tests sont réussis et ses sources sont intactes. Aucune validation ne vaut
autorisation de déploiement ou d’activation en production.

`ADMIN_WEB_INTEGRATION_ENABLED` reste désactivé par défaut (`.env.example=false`,
activation serveur uniquement pour la valeur exacte `true`). Sans activation,
le pont historique vers `apps/admin` est conservé après vérification SSR.
Rollback fonctionnel : désactiver le flag pour revenir au parcours historique.
Rollback du code après un éventuel commit autorisé : revert ciblé de la Phase 2D,
sans toucher aux phases précédentes ni aux migrations. Les actions déjà effectuées
restent auditées ; toute inversion utilise les commandes autorisées et leurs motifs,
jamais une suppression des journaux ou une restauration manuelle de sessions.

## État Git et décision

Branche `feature/admin-web-integration`, HEAD
`4f7a5886b0f462aa186ce27b900febf4413dca8d` (recette d’inscription, après la Phase 2C). Index vide.
Les 15 fichiers ci-dessus constituent toutes les modifications non commitées.
`apps/admin`, API, packages, dépendances, schéma, migrations, workflows et Vercel
inchangés. Aucun secret, fichier confidentiel ou modification hors périmètre
détecté lors du contrôle des ajouts et du diff.

**GO technique pour le commit local Phase 2D, sous validation du propriétaire.**
Aucun commit Phase 2D, push, merge, déploiement, migration applicative/production,
changement Stripe, bancaire ou Vercel effectué. Attente de validation.
