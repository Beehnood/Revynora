# Phase 1 · Recette locale du 16 octobre 2026

## Périmètre livré

Le PDF `PHASE_1_MVP_PEDAGOGIQUE_WEB_UI_UX_CODEX.pdf` est utilisé comme spécification. Le socle Phase 0 est conservé : un Next.js et un monolithe modulaire NestJS, TypeScript strict, pnpm/Turborepo, PostgreSQL et Prisma. Son bloc « prompt à donner à Codex » n’est pas traité comme une autorisation de déployer ou d’entamer une autre phase. Aucun hébergement, paiement ni appel OpenAI réel n’a été effectué.

Le parcours est utilisable avec un compte créé par l’utilisateur, des sessions réelles et des données persistées. Le fournisseur local actif est **mock**, identifié dans l’assistant, le quiz, les résultats et l’historique. L’adaptateur OpenAI existe et est testé avec des réponses HTTP simulées ; son fonctionnement avec un compte et une clé réels reste à vérifier par le propriétaire.

## Tickets et preuves

| Ticket | Réalisation                                                                                                                                                      | Fichiers principaux                                                                              | Vérification                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-T01 | User, Course, Quiz, Question, QuestionOption, QuizAttempt, Answer, AIUsage ; Session ; FREE par défaut ; contraintes et index ; seed éditorial sans compte connu | `prisma/schema.prisma`, migration `20261016010000_learning`, `prisma/seed.cjs`                   | Client généré, migration appliquée sur revynora et revynora_test, seed local réussi, tests SQL/HTTP                                               |
| P1-T02 | Inscription atomique, scrypt versionné, sessions opaques HttpOnly, guard STUDENT/FREE, propriété, anti-CSRF et limite auth                                       | `apps/api/src/auth`, `shared/http` ; ADR 004                                                     | Hashs salés, e-mails normalisés, sessions absentes/expirées/révoquées, rôles et origine refusés, 429 d’auth vérifiés                              |
| P1-T03 | Cours privés/éditoriaux, quiz sans solutions, endpoints validés, erreurs structurées et OpenAPI requêtes/réponses                                                | `learning.controller.ts`, `learning.service.ts`, `shared/http/openapi.ts`, `packages/validation` | DTO invalides, accès croisés 404, cours d’un autre compte absents, contrat OpenAPI servi                                                          |
| P1-T04 | Port IA, trois banques mock débutant, Responses JSON strict, Zod et invariants, timeout/retry, quota SQL et traces sans prompt                                   | `apps/api/src/ai` ; ADR 005                                                                      | Erreurs HTTP 401/429/500, refus, timeout et JSON invalide simulés ; 503 sans quiz fictif ; quota concurrent et sujet mock refusé                  |
| P1-T05 | Sauvegarde, effacement de sélection, reprise, notation exacte, soumission atomique et idempotente, résultat et historique paginé                                 | `learning.service.ts`, `scoring.ts`, `learning.integration.ts`                                   | Double soumission concurrente identique, 5 réponses uniques, score déterministe, sauvegarde tardive 409, incomplet 409, historique et progression |
| P1-T06 | Inscription, connexion, dashboard réel, assistant, quiz radio/checkbox, confirmation, correction, mini-cours, cours, profil et historique                        | `apps/web/app/app`, `components/learning`, `lib`                                                 | Parcours complet sur 4 largeurs, sauvegarde/rechargement/reconnexion, formulaire cours, erreurs visibles et reprise                               |
| P1-T07 | Unitaires, PostgreSQL isolé, E2E, axe, couverture, pipeline, captures et documentation                                                                           | `tests`, configs Vitest/Playwright, `scripts/prepare-test-db.cjs`, `.github/workflows/ci.yml`    | Résultats détaillés ci-dessous ; CI distante non exécutée                                                                                         |

Le fichier [FICHIERS.txt](FICHIERS.txt) donne l’inventaire des sources ajoutées ou modifiées pour cette phase. Les fichiers de fondation non suivis par Git au début de la phase ont été préservés.

## Commandes réellement exécutées

| Commande                                                                | Résultat                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm install` puis `pnpm install --frozen-lockfile`                    | Réussite ; lockfile à jour, installation sans modification                                                |
| `pnpm exec prisma generate`                                             | Client généré pour les nouveaux modèles                                                                   |
| `pnpm db:migrate`                                                       | Migration pédagogique appliquée à la base applicative locale                                              |
| `pnpm db:seed`                                                          | Ressource éditoriale initialisée, aucun compte ou mot de passe prédéfini                                  |
| `pnpm test:prepare`                                                     | Base revynora_test séparée, migrations idempotentes, aucune suppression de données applicatives           |
| `pnpm lint`                                                             | Réussite, aucune erreur ni alerte ESLint                                                                  |
| `pnpm typecheck`                                                        | Réussite sur Web, API et validations partagées                                                            |
| `pnpm test`                                                             | **41 unitaires réussis** : 25 Web et 16 API                                                               |
| `pnpm test:coverage`                                                    | **52 tests réussis** : 25 Web, 16 API unitaires et **11 intégrations PostgreSQL/HTTP** ; seuils respectés |
| `pnpm build`                                                            | Réussite Web, API et paquets partagés ; les pages `/app/*` sont dynamiques et protégées                   |
| `pnpm format:check`                                                     | Réussite                                                                                                  |
| `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/revynora-browsers pnpm test:e2e` | **11 scénarios navigateur** : parcours complets, erreurs, pagination, responsive et axe                   |

Les 11 intégrations incluent des requêtes HTTP sur un serveur Nest éphémère et de vraies transactions PostgreSQL. Les tests de couverture API les réexécutent sans cache. Les bases locales ont été préparées avec l’accès réseau/loopback autorisé hors sandbox. Le chemin Chromium temporaire correspond uniquement à cette session ; le README décrit l’installation standard.

## Couverture

| Périmètre instrumenté                                | Lignes      | Instructions | Fonctions | Branches |
| ---------------------------------------------------- | ----------- | ------------ | --------- | -------- |
| Web : landing, tous les composants et helpers client | **98,81 %** | 98,81 %      | 94,73 %   | 96,28 %  |
| API : auth, IA, pédagogie, DB et HTTP/OpenAPI        | **97,81 %** | 97,81 %      | 100 %     | 91,35 %  |

Les chiffres ne représentent pas tout le dépôt. CSS, fichiers de configuration, wrappers Next et layout serveur, bootstrap Nest, modules déclaratifs, Prisma généré, scripts et schémas partagés ne sont pas inclus dans ces pourcentages. Les validations partagées sont exercées par les tests API et formulaires ; le layout serveur, les styles, les migrations et les scripts sont contrôlés par la recette navigateur et les commandes réelles.

Seuils : Web 85 % lignes/instructions/fonctions et 75 % branches ; API intégrée 80 % lignes/instructions/fonctions et 70 % branches. Le périmètre API est beaucoup plus large que les deux fichiers de Phase 0, ce qui explique une grille de seuils différente. Aucun seuil Web existant n’a été réduit.

Le contrat figé est livré dans [openapi.json](openapi.json) ; l’endpoint `/api/v1/openapi.json` reste la version actualisée par le serveur.

Les valeurs brutes sont archivées dans [couverture.json](couverture.json). Rapports HTML : `apps/web/coverage/index.html` et `apps/api/coverage/integration/index.html`.

## Recette UI et accessibilité

Les pages publiques, inscription, connexion, maquette admin et galerie sont vérifiées à **320, 375, 768 et 1280 px**. Le parcours connecté est intégralement joué à chacune de ces largeurs : création de compte, diagnostic, sauvegarde partielle, rechargement et reprise, sauvegarde finale, confirmation, soumission, correction, mini-cours, historique, création d’un cours privé, profil, déconnexion et reconnexion.

Les contrôles axe sélectionnent WCAG 2 A/AA, 2.1 AA et 2.2 AA ; aucune violation n’est détectée lors de la recette finale. L’absence de débordement horizontal est vérifiée sur chaque écran. Tab, Enter, Escape, focus du menu et affichage/masquage du mot de passe sont testés. Ceci ne constitue pas un audit humain complet ni une certification WCAG.

Les premières exécutions ont révélé un titre principal masqué sur mobile et le contraste insuffisant des libellés « À venir » ; ces points ont été corrigés. Les sélecteurs d’erreur excluent maintenant l’annonceur de navigation natif de Next. La configuration Playwright charge l’environnement en CommonJS compatible Node 24 et fixe explicitement les ports 3000/3001 pour éviter que PORT=3001 du backend ne soit repris par Next.

Captures : inscription, connexion, dashboard vide et avec résultat, assistant, quiz, correction, historique et cours à 375/1280 px dans ce dossier. Elles utilisent uniquement des comptes de test, nettoyés après recette.

## Critères d’acceptation

- [x] Compte étudiant FREE réel et session protégée.
- [x] Parcours sujet/domaine/niveau jusqu’à correction et mini-cours persisté.
- [x] Exactement cinq questions, type unique/multiple explicite.
- [x] Aucun indicateur correct, justification ou mini-cours fourni avant soumission, y compris via `/courses`.
- [x] Score serveur, comparaison exacte des options, notions maîtrisées/faibles cohérentes.
- [x] Double soumission stable et absence de doublons ; réponses finales non modifiables.
- [x] Propriété contrôlée côté API pour chaque ressource privée.
- [x] Quotas concurrents bornés, échecs/retries tracés sans prompt sensible.
- [x] Erreur IA simulée visible, bouton réactivé et reprise possible ; aucun succès fictif.
- [x] Historique paginé, dernier score et progression fondés sur les données du compte.
- [x] Tests unitaires, intégration, E2E, lint, types, build et couverture locaux.
- [x] OpenAPI disponible et documentation mise à jour.
- [ ] Appel réel avec une clé OpenAI : non exécuté, aucune clé fournie.
- [ ] Exécution distante de GitHub Actions : résultat non vérifié dans cette recette ; le workflow est inclus dans la livraison Git demandée ensuite.
- [ ] Audit humain complet WCAG/lecteur d’écran : non exécuté.
- [x] Aucune phase suivante, aucun paiement, aucun déploiement ni hébergement.

## Points restants hors de cette phase

La vérification d’e-mail, la récupération de mot de passe, la gestion avancée du compte et les mesures d’exploitation publique restent à concevoir avant exposition extérieure. Le mode OpenAI nécessite une clé valide et la vérification du modèle choisi ; les tarifs éventuels sont à configurer, pas codés en dur. Les contenus IA peuvent comporter des erreurs factuelles malgré un schéma valide. Les deux ADR 004 et 005 détaillent ces limites.

La phase a été initialement livrée localement, alors que seul le README Phase 0 était sur GitHub. Une demande ultérieure du propriétaire autorise le commit et le push de toutes les sources et des livrables des phases 0 et 1, sans déploiement. Voir [le workflow de livraison](../WORKFLOW.md).
