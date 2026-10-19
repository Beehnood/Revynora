# Chantier C — Recette finale G.2

Base `063bc1c65fb44fc374db93f32a2350e522854fdb`. Aucun commit ni changement de production. Résultat : **GO pour revue et autorisation distincte de commit G.2**.

## Parcours validés

Quatre scénarios Playwright Chromium sur serveurs API/Admin locaux dédiés (3411/3412), base `revynora_test` exclusivement :

- À 320, 768 et 1280 px : connexion administrateur réelle locale, navigation vers Utilisateurs, recherche, fiche, suspension et réactivation avec motif et confirmation. À 320 px : ouverture clavier du menu, Escape et restitution du focus.
- Sur les trois routes à chaque largeur : absence de débordement horizontal et zéro violation axe WCAG A/AA détectée, captures des neuf vues.
- Routes protégées : redirection anonyme vers connexion ; refus SSR des trois routes pour STUDENT ; refus backend 403 STUDENT et 401 anonyme sur la fiche.

Deux sélecteurs du test initial étaient incorrects (nom du bouton mobile variant après ouverture ; deuxième alerte technique Next). Corrigés dans le test. Aucun défaut applicatif G.2 confirmé et aucune correction du métier nécessaire.

Fichiers nouveaux de cette recette : `apps/web/playwright.admin.config.ts`, `apps/web/tests/admin-e2e/admin-g2.spec.ts`. Ils utilisent l'outillage Playwright déjà présent dans le workspace Web, sans modifier sa suite E2E standard ni ses dépendances.

## Exécution reproductible

1. Fournir uniquement dans le processus une URL PostgreSQL locale vers `revynora_test` (précondition : schéma existant à jour, aucune migration exécutée par cette recette).
2. Compiler les dépendances partagées et l'API existante ; compiler Admin avec `API_URL=http://127.0.0.1:3411`, sans VERCEL. Ce build est réservé au test local.
3. Exécuter `pnpm --filter @revynora/web exec playwright test --config playwright.admin.config.ts` avec `TEST_DATABASE_URL` local et le chemin des navigateurs installés si nécessaire.

La configuration refuse un hôte distant ou une autre base ; les serveurs existants ne sont pas réutilisés. Les comptes et audits du test sont nettoyés par leurs propres identifiants, sans reset. Chaque exécution est bornée et son groupe de processus arrêté à la fin.

## Vérifications

- Playwright final : 4/4 réussis, environ 14,7 secondes pour la commande finale.
- ESLint des nouveaux fichiers E2E : réussi.
- TypeScript workspace Web incluant les tests : réussi.
- Build Admin local pour la recette : réussi sous Node 24.3.0, `--force`.
- Résultats G.2 antérieurs toujours applicables : 27 Admin, 44 unitaires API, 17 intégrations SaaS, lint/typecheck Admin/API et builds HTTPS réussis ; aucun code applicatif changé depuis.

Journaux et captures : répertoire temporaire référencé par `/private/tmp/revynora-g2-location`, sous `source/apps/web/test-results`. Les données sont exclusivement des fixtures locales. Aucun test d'authentification en production.

Limites : Chromium seulement, pas de lecteur d'écran manuel ni appareil physique. Axe ne constitue pas une certification WCAG exhaustive. Ne pas utiliser les artefacts compilés avec loopback pour un déploiement. La nouvelle fiche nécessite sa version API correspondante avant future mise en service. Le commit G.2 reste en attente d'autorisation ; G.3 non commencé.
