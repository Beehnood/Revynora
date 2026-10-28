# Admin intégré — Phase 1 : socle sécurisé

État du 28 octobre 2026, sans commit ni publication de cette phase.

## Prérequis GitHub confirmés

La PR #6 est fusionnée (`merged: true`) depuis le 28 octobre 2026 à
20:19:58 UTC. Commit de fusion et point de départ :
`eafeb16c0e41fa59a4ce5c4920c87b8332eb0356`.
Le commit source `e9dd9e628ce2e5554360ccbbe0f8f6db2a4f98e3` est ancêtre de
`origin/main`. G.1 à G.9 sont présents dans son historique.

Les cinq checks de ce main sont réussis : quality-foundation,
backend-validation, web-validation, admin-validation, mobile-validation.
Nouvelle branche locale : `feature/admin-web-integration`, issue de ce SHA.
Les branches existantes, notamment G.9, sont conservées.

## Comportement

`ADMIN_WEB_INTEGRATION_ENABLED` est une activation **serveur**, sans préfixe
`NEXT_PUBLIC_`. Seule la valeur exacte `true` active le nouvel accueil.
Absente ou désactivée, elle conserve le pont vers `ADMIN_ORIGIN`, après
vérification de session et de rôle. Aucun paramètre Vercel n'a été changé.

En mode intégré, `/admin` rend uniquement un accueil et la navigation vers
`/app`. Aucun écran commercial ni autre écran métier Admin n'est migré.
`apps/admin` reste strictement inchangée et fonctionne comme auparavant.

Le layout vérifie le cookie opaque `revynora_session` côté serveur avec
`GET /api/v1/users/me`, `cache: no-store`, délai maximal de cinq secondes et
redirections fournisseur refusées. Un cookie absent ou malformé n'est pas
transmis à l'API. L'origine API est validée, explicite en production et HTTPS
sur Vercel. Seul le cookie de session est transféré, pas tous les en-têtes.

- Session absente, expirée ou suspendue : connexion. En mode intégré, retour
  strictement local vers `/admin` après authentification.
- Étudiant ou réponse 403 : refus du contenu Admin et retour vers `/app`.
- API indisponible, réponse malformée ou rôle inconnu : page d'indisponibilité,
  sans rendu du contenu protégé.
- ADMIN actif : accueil intégré uniquement si l'activation est explicite.

Le client Web conserve `credentials: same-origin` et son marqueur anti-CSRF.
Les réponses 401 sous `/admin` déclenchent une reconnexion avec retour vers la
racine `/admin`. Les retours `/app` existants sont conservés ; aucun retour
externe ni chemin Admin arbitraire n'est accepté.

Le rôle, les permissions, la suspension et les droits restent contrôlés par
l'API NestJS commune. Aucune API, base, session alternative ou attribution
ADMIN n'est créée. La connexion n'accorde ni attribution interne G.8 ni
permission commerciale G.9. Le lien pédagogique reste soumis au contrôle G.8.

## Résultats locaux

Validation dans `/private/tmp/revynora-admin-web-foundation-validation`, avec
les sources de cette branche et les dépendances figées de la copie G.9
précédemment validée. Aucun fichier d'environnement confidentiel copié et
aucune réinstallation du dépôt principal. Les dépendances et le lockfile
restent inchangés.

| Vérification                                         | Résultat                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Tests Admin existants avec couverture                | 49 réussis ; seuils inchangés                                  |
| Tests Web avec couverture                            | 80 réussis, dont 36 nouveaux cas                               |
| Couverture Web                                       | 96,67 % lignes/statements, 89,73 % branches, 89,18 % fonctions |
| Nouveau layout, accueil, shell et lecteur de session | 100 % sur les quatre métriques                                 |
| Seuils existants                                     | Conservés : 85 lignes/statements/fonctions, 75 branches        |
| TypeScript Web                                       | Réussi                                                         |
| ESLint Web                                           | Réussi                                                         |
| Build Web et packages dépendants                     | Réussi ; `/admin` dynamique SSR                                |
| Playwright du socle                                  | 5 scénarios réussis, aucun ignoré                              |
| Frontières du monorepo                               | Réussies, 5 tests réussis                                      |
| Intégrité Prisma historique                          | Réussie                                                        |

Les tests navigateur utilisent uniquement le PostgreSQL isolé existant
`revynora-g9-validation-20261026`, sur `127.0.0.1:55439`, base `revynora_test`.
Ils démarrent une API locale (3451) et le build Web local (3450), avec fournisseurs
Mock et worker désactivé. L'API exécutée reprend le build G.9 déjà validé : ses
sources n'ont pas changé.

Les comptes de test sont aléatoires puis supprimés. Le parcours réel couvre
connexion ADMIN, cookie HttpOnly/SameSite=Lax/chemin `/`, cookie inaccessible au
JavaScript, refus étudiant, expiration persistée et suspension persistée.
Il vérifie aussi zéro attribution interne, zéro permission commerciale,
refus commercial 403 et refus pédagogique sans attribution G.8.
Le cookie Secure en HTTPS n'est pas validé par ce navigateur local HTTP ; la
configuration de cookie de l'API reste inchangée. Les pannes API, les profils
malformés et le mode historique sont couverts par les tests unitaires SSR.

Commande navigateur reproductible, après build API/Web et configuration
explicite de la seule base isolée :

```sh
G8_ISOLATED_TEST_DB=true pnpm --filter @revynora/web exec playwright test --config=playwright.admin-foundation.config.ts
```

`TEST_DATABASE_URL` doit désigner `127.0.0.1` et `/revynora_test`. La configuration
refuse toute autre cible. Aucune migration ni initialisation du catalogue n'est
exécutée par cette suite ; elle exige le schéma G.9 déjà validé.

## Limites, rollback et suite

La phase n'est ni committée ni poussée. Les checks GitHub cités concernent le
main fusionné, pas ces modifications locales. Les nouvelles suites ne sont pas
encore raccordées à un job CI dédié. Les scénarios Admin G.2–G.9 existants sont
conservés ; leur migration et leur relance complète feront partie des lots
d'écrans ultérieurs. Aucun changement fonctionnel G.9, d'API ou de schéma.

Rollback fonctionnel : conserver ou remettre l'activation serveur à `false` et
redémarrer le runtime Web selon la procédure d'exploitation approuvée ; le pont
historique redevient effectif. Aucun rollback de données n'est nécessaire.
Aucune activation réelle, modification Vercel, migration applicative,
opération Stripe, modification bancaire ou déploiement effectué.

La migration des écrans requiert une validation distincte. L'architecture cible
reste une application Next.js dans `apps/web`, le domaine principal et `/admin`,
une seule API NestJS et une seule base PostgreSQL, sans second backend Oracle.

## Inventaire local (12 fichiers)

```text
apps/web/.env.example
apps/web/app/admin/layout.tsx
apps/web/app/admin/page.tsx
apps/web/components/admin/admin-shell.tsx
apps/web/lib/admin-session.ts
apps/web/lib/api.ts
apps/web/playwright.admin-foundation.config.ts
apps/web/tests/admin-foundation-e2e/session.spec.ts
apps/web/tests/admin-foundation.test.tsx
apps/web/tests/api.test.tsx
apps/web/vitest.config.ts
docs/admin/ADMIN-WEB-INTEGRATION-PHASE1.md
```

Prettier sur les sources et la documentation modifiées, puis
`git diff --check` : réussis. Aucun fichier ajouté à l'index Git.
