# G.3 — Recette locale

Base Git `7a6b67dc104e7cdb435981c7d7a5b825856d6051`. Développement local uniquement, sans commit, migration, nouvelle dépendance, configuration distante ou appel production. Définitions et limites : [G3-STATISTIQUES.md](G3-STATISTIQUES.md).

## Fonctionnalités

Vue générale G.2 enrichie de statistiques réelles : inscriptions quotidiennes en graphique SVG et tableau, périodes d'abonnement par offre/statut avec barres et valeurs, usage IA par fournisseur/statut avec tokens et couverture des estimations, paiements par fournisseur/devise/statut. Filtre UTC soumis explicitement et validé côté serveur. États chargement, absence de données, erreur et reprise inclus. Les routes et protections existantes sont conservées.

Le nouveau endpoint Admin n'expose aucun fait pédagogique individuel. SQL paramétré avec agrégations et bornes, transaction de lecture cohérente et timeout. L'interface ne présente ni dépenses IA facturées absentes du modèle, ni revenu réel certifié à partir des paiements dont le mode n'est pas enregistré.

## Résultats finaux

Node 24.3.0, pnpm 10.18.3. Vérifications dans une copie locale isolée avec dépendances propres, sans fichier .env copié. Les sources formatées validées sont remises dans le dépôt principal.

| Contrôle                                           | Résultat                                                      |
| -------------------------------------------------- | ------------------------------------------------------------- |
| Tests Admin avec couverture                        | 30 tests réussis, 10 fichiers                                 |
| Tests unitaires API                                | 50 tests réussis, 13 fichiers                                 |
| Intégrations HTTP/PostgreSQL SaaS                  | 18 tests réussis                                              |
| Playwright Chromium                                | 7 scénarios réussis : 4 régressions G.2 et 3 statistiques G.3 |
| ESLint et TypeScript Admin/API                     | Réussis                                                       |
| ESLint nouveaux tests navigateur et TypeScript Web | Réussis                                                       |
| Builds Admin/API HTTPS, Turbo --force              | Réussis                                                       |
| Build Admin loopback pour recette locale           | Réussi, réservé aux tests                                     |
| Frontières du monorepo                             | Réussies                                                      |

Total : **105 tests distincts**. Couverture Admin : lignes/statements 98,95 %, branches 93,89 %, fonctions 88,23 %. Module statistiques couvert à 100 %. Aucun seuil diminué ou exclusion nouvelle.

Le test PostgreSQL utilise des fixtures datées dans un intervalle distinct. Vérifications : inclusivité du début, exclusivité de la fin, jours absents à zéro, statuts/offres, coûts connus et inconnus, comptes sans droit 401/403, paramètres invalides et supplémentaires 400, période vide, aucune identité utilisateur dans la réponse. Les tests unitaires couvrent notamment année bissextile, durée maximale, précision monétaire, absence de classification test/live inventée, borne de groupes et propagation des timeouts.

Playwright teste les statistiques aux largeurs 320/768/1280 px avec authentification locale, période appliquée, graphique non vide, tableau ouvert au clavier, valeur USD stockée sans conversion présumée, estimation exacte, état vide, erreur 503 simulée et reprise. Les quatre scénarios G.2 préservent navigation, ADMIN/STUDENT et confirmations sensibles. Zéro débordement horizontal et zéro violation axe A/AA détectée lors des contrôles. Captures inspectées, conservées hors Git dans le dossier temporaire de recette.

La première recette a détecté des tableaux scrollables inaccessibles au clavier en mobile/tablette ; correction par régions nommées et focusables, puis relance intégrale des scénarios réussie. Un test initial de nom accessible du graphique a conduit à séparer correctement son titre (`aria-labelledby`) de sa description (`aria-describedby`). Aucune règle axe désactivée.

## Commandes et isolation

- `pnpm exec prettier --write` puis contrôle des seuls fichiers du lot.
- `pnpm exec turbo run build --filter=@revynora/validation --filter=@revynora/api-client --force`.
- `pnpm --filter @revynora/admin test:coverage`.
- `pnpm --filter @revynora/api test`.
- `pnpm --filter @revynora/api exec vitest run --config vitest.integration.config.ts src/saas/saas.integration.ts`.
- `pnpm exec turbo run lint typecheck --filter=@revynora/admin --filter=@revynora/api`.
- `pnpm exec turbo run build --filter=@revynora/admin --filter=@revynora/api --force`, avec origine API HTTPS attendue et drapeaux Vercel dans le processus uniquement.
- `pnpm check:boundaries`.
- `pnpm --filter @revynora/web exec eslint playwright.admin.config.ts tests/admin-e2e/statistics-g3.spec.ts` et `tsc --noEmit`.
- Build Admin dédié à la recette avec `API_URL=http://127.0.0.1:3411`, puis `pnpm --filter @revynora/web exec playwright test --config playwright.admin.config.ts`.

Seule la base existante locale `revynora_test` est utilisée. L'URL est contrôlée en mémoire : loopback et nom exact. Pas de migration, reset ou données de production. Les fixtures nouvelles de paiements sont supprimées par leurs utilisateurs propres avant suppression de ces derniers. Les adaptateurs distants des tests sont simulés ; les processus de recette sont bornés et arrêtés à leur fin. L'accès local PostgreSQL et l'écoute HTTP ont nécessité une exécution hors sandbox après les refus réseau initiaux.

Journaux : dossier indiqué par `/private/tmp/revynora-g3-location`. Le build HTTPS a été validé avant le build loopback de recette ; ne pas livrer ce dernier. Aucun build de cette session n'est déployé.

## Dernière revue avant commit

Correction monétaire limitée à G.3 : formatCents reçoit désormais la devise. Seul EUR est converti depuis les centimes ; les autres devises sont affichées en entiers stockés, avec échelle non vérifiée. Les tests couvrent EUR en casse différente, USD, JPY, KWD, code inconnu/vide, négatifs et grands entiers. Aucun changement du modèle ou des adaptateurs de paiement.

La base locale a été inspectée en lecture seule : types timestamp(3) sans fuseau et index conformes aux migrations. EXPLAIN sans ANALYZE révèle des scans séquentiels possibles sur les quatre tables de faits. Aucun benchmark sur volume production ni accès distant. Voir le document des KPI pour les limites des index et des délais.

Un test d'intégration ajouté à la suite existante force Pacific/Auckland et vérifie l'identité des agrégats avec UTC. Il a détecté le décalage des comparaisons Date ; correction par fuseau UTC strictement local à la transaction de lecture. Aucun paramètre PostgreSQL global ou permanent modifié. Les 21 chemins du lot sont conservés ; seuls les éléments nécessaires à ces corrections et leur documentation évoluent.

Après ces corrections, les 105 tests ont de nouveau réussi : 30 Admin, 50 unitaires API, 18 intégrations PostgreSQL et 7 Playwright. ESLint, TypeScript, builds Admin/API HTTPS et local, frontières et formatage sont réussis. Le cas de session Pacific/Auckland est maintenant vert. La lecture du catalogue et des plans a été effectuée en transaction READ ONLY ; aucun EXPLAIN ANALYZE, aucune configuration globale changée. Avant création des fixtures de contrôle, la base de test conservée ne présentait que des paiements EUR/mock ; les lignes USD sont des fixtures explicites de non-conversion, pas une preuve de prise en charge commerciale de cette devise.

## Limites et décision

**GO pour revue locale G.3.** La certification du mode test/live des paiements historiques reste impossible sans information persistée supplémentaire. Les montants non vérifiables sont explicitement isolés des simulations et ne deviennent pas un KPI de revenu réel. Les périodes d'abonnement ne sont pas des abonnés uniques. Les comptes supprimés ne peuvent pas être reconstruits. Pas de facture IA, MRR, ARR ou conversion monétaire inventés.

La période, le nombre de groupes et les délais sont bornés ; le nombre de lignes scannées peut augmenter avec la base, à mesurer et optimiser avant de fortes volumétries sans anticiper une migration. Chromium et axe ne remplacent pas un audit manuel au lecteur d'écran ou des tests sur appareils physiques. Aucun commit, push, déploiement ou G.4 autorisé par cette recette.
