# Recette — Phase 3 Leitner, Planning et Progression

17 octobre 2026. Branche `feature/phase-3-leitner-planning`, base `c99b400`, restauration Git `restore/phase-3-20261017`. Périmètre : [spécification explicitement demandée](SPECIFICATION.md), et non PDF Mobile de la roadmap initiale. [Audit préalable](AUDIT.md), [décisions](../adr/008-intelligent-planning-and-progress.md), [liste exacte des fichiers](FILES.md).

## Fonctionnalités livrées

- Leitner Plus/Pro conservé et complété : cinq boîtes, configuration 1/3/7/14/30 jours, carte immédiatement due à sa création, bonnes réponses vers la boîte suivante, échec en boîte 1, plafond 5, dates UTC après chaque révision. Les échéances déjà enregistrées restent intactes. CRUD par archivage confirmé ; historique conservé ; cours associé modifiable ; recto/verso, clavier, progression de séance et durée déclarée bornée. Verrou de ligne, version et identifiant de révision stables empêchent les doubles écritures.
- Planning Pro : programmes créés et renommables, tâches reliées facultativement à un cours, révisions/examens, priorité 1..3, statuts existants, modification/déplacement, gestion des collisions, historique immuable des versions et rappels existants conservés. Calendrier semaine/mois/liste, filtre cours, indication des retards et fuseau IANA. Une modification partielle préserve les champs omis, notamment le rappel.
- Disponibilités ponctuelles futures persistées, sans chevauchement, ajout/retrait avec confirmation. Les créneaux occupés sont soustraits du contexte intelligent.
- Planning personnalisé : cours accessibles, moyennes QCM, lacunes des tentatives soumises, échéances Leitner, examens et disponibilités. Mode local déterministe explicitement simulé ; adaptateur OpenAI configurable avec JSON Schema, Zod, timeout, tentatives bornées et quota quotidien partagé avec les diagnostics. Aucun outil SQL ni écriture directe du modèle. Proposition sans création de tâches, confirmation explicite ; contrôle transactionnel des conflits/cours/examens/disponibilités à nouveau effectué. Retries de confirmation idempotents.
- Progression accessible Free/Plus/Pro : KPIs réels, scores QCM, activité de révision, cinq boîtes, matières et historique. Recharts avec tableaux accessibles. Statistiques historiques du seul compte connecté ; activité 7/30 jours calendaires UTC. Aucun chiffre de démonstration injecté. Les durées anciennes inconnues ne sont pas estimées ; les tâches de planning ne sont pas comptées comme révisions réellement effectuées.
- Contrats portables dans types/validation ; appels Web via api-client existant. Module Progress et nouvelles règles Planning en Clean Architecture. Admin et Expo préservés sans nouveau métier. Export de confidentialité étendu aux disponibilités.

## Étapes et contrôles

| Ticket                   | Résultat                                              | Vérification effectuée                                                                                                                                    |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 Audit et modèle      | Audit, branche, tag ; migration additive              | Prisma validate/generate ; conservation des migrations historiques ; application sur revynora_test                                                        |
| T02 Règles/API Leitner   | Intervalles, dates, durée, concurrence                | Tests unitaires règles et intégration HTTP/PostgreSQL des cinq boîtes, erreur, plafond et doublon concurrent                                              |
| T03 UI Leitner           | Cours, séance, progression, confirmation              | 36 tests Web de régression initialement verts ; tests navigateur ensuite                                                                                  |
| T04 API Planning         | Priorité, examen, disponibilité, renommage, snapshots | Régression 53 tests API puis tests Phase 3 ; correction d’un défaut de valeurs par défaut Zod en PATCH détecté par l’intégration                          |
| T05 Calendrier Web       | Semaine/mois/liste, filtres, retards, formulaires     | Tests Web des nouveaux contrôles, loading/empty/error, reprise et modification                                                                            |
| T06 Planning intelligent | Ports, contexte, simulation et OpenAI, confirmation   | Réponse invalide, injection de champs, cours étrangers, collision, examen, quota, timeout/refus/HTTP 500, double confirmation et retrait de disponibilité |
| T07 Progression          | Agrégats personnels et graphiques                     | Faits connus agrégés exactement, durées nulles, compte vide, tableaux accessibles et graphique avec diagnostic réellement soumis                          |
| T08 Recette finale       | Vérifications, captures, conservation des données     | Suites complètes ci-dessous ; aucune phase suivante démarrée                                                                                              |

## Migrations et données

Deux migrations nouvelles :

1. `20261017020000_phase3_learning_plans` : durationSeconds nullable sur Revision ; courseId/kind/priority sur tâches et snapshots ; StudyAvailability, index et contraintes.
2. `20261017021000_planning_idempotency` : generationKey unique et generationHash nullable sur StudyPlan pour les confirmations rejouées.

Aucune ancienne migration ni seed modifié. Le gel de schéma de Phase 2.5 est terminé ; `check:prisma-integrity` continue de vérifier l’intégrité des six anciennes migrations et du seed, tout en autorisant le nouveau schéma et les migrations additives.

Les huit migrations sont appliquées sur revynora_test. La base normale locale revynora a été sauvegardée avant application de ses quatre migrations en attente (les deux antérieures FREE/task_versions et les deux de cette phase). `prisma migrate status` indique ensuite une base à jour. Les comptages User, Course, Quiz, QuizAttempt, LeitnerCard, Revision, StudyPlan, StudyPlanItem, Payment et UserPaymentHistory sont identiques avant/après. Les historiques FREE et snapshots initiaux sont complétés par les migrations antérieures prévues.

Sauvegarde locale hors Git : `/private/tmp/revynora-before-phase3-20261017.dump`, permissions 0600. Archive pg_dump custom inspectée par pg_restore --list ; restauration complète non exécutée pendant cette phase. Les comptages avant/après sont dans des fichiers privés du même dossier temporaire. Aucun reset, db push, effacement de volume ou déploiement. Les nettoyages de tests ciblent uniquement leurs propres utilisateurs dans revynora_test.

## Endpoints

Préfixe `/api/v1`, session étudiant et propriété vérifiées côté serveur.

| Méthode        | Chemin                                                   | Droits / comportement                                                                |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET            | `/leitner/cards`, `/leitner/cards/due`, `/leitner/stats` | Plus/Pro ; collections paginées, échéances, boîtes, intervalles et historique récent |
| POST           | `/leitner/cards`                                         | Plus/Pro ; nouvelle carte en boîte 1                                                 |
| PATCH / DELETE | `/leitner/cards/:id`                                     | Plus/Pro ; modification versionnée / archivage                                       |
| POST           | `/leitner/cards/:id/review`                              | Plus/Pro ; requestId UUID, version, remembered, durationSeconds optionnel            |
| GET            | `/study-plans?from=…&to=…`                               | Pro ; fenêtre maximale 62 jours, plafond 500 tâches                                  |
| POST           | `/study-plans/generate`                                  | Pro ; création manuelle conservée, types/priorités/cours ajoutés                     |
| PATCH          | `/study-plans/:id`                                       | Pro ; titre du programme personnel                                                   |
| PATCH          | `/study-plan-items/:id`                                  | Pro ; horaire/durée/statut/type/priorité/cours/rappel, version et conflits           |
| GET            | `/study-plan-items/:id/history`                          | Pro ; versions paginées privées, metadata de tâche incluses                          |
| GET / PUT      | `/study-availability`                                    | Pro ; lire/remplacer les disponibilités, dates locales + fuseau IANA en entrée       |
| POST           | `/study-plans/ai/propose`                                | Pro ; timeZone ; retourne proposal et provider, aucun programme enregistré           |
| POST           | `/study-plans/ai/confirm`                                | Pro ; timeZone, proposal, requestId ; confirmation atomique et idempotente           |
| GET            | `/progress`                                              | Tous les étudiants ; statistiques personnelles, aucun userId accepté en entrée       |

OpenAPI interactif `/api/v1/docs`, JSON `/api/v1/openapi.json`. Les DTO Planning sont dérivés des schémas Zod partagés, avec adaptation nullable à OpenAPI 3.

## Tests et builds

Résultats finaux consignés dans `coverage-summary.json` : API 66 tests (36 unitaires et 30 intégrations), Web 43, Admin 10, client partagé 3, E2E 17 : **139 tests distincts réussis**. Les tests de contrat/validation inclus dans ces suites couvrent les nouvelles requêtes et les droits réels, sans activer d’abonnement réel.

| Workspace  | Lignes  | Branches | Fonctions |
| ---------- | ------- | -------- | --------- |
| web        | 97.55 % | 90.9 %   | 88.4 %    |
| api        | 94.74 % | 86.61 %  | 97.93 %   |
| admin      | 98.34 % | 93.15 %  | 91.66 %   |
| api-client | 100 %   | 86.36 %  | 100 %     |

Commandes exécutées :

```sh
pnpm install --frozen-lockfile
pnpm exec prisma validate
pnpm db:generate
pnpm test:prepare
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:coverage
pnpm build
pnpm check:boundaries
pnpm check:prisma-integrity
pnpm format:check
pnpm --filter @revynora/mobile exec expo install --check
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/revynora-browsers pnpm test:e2e
```

Builds Next étudiant, Next Admin, Nest et export Expo iOS/Android réussis. Les seuils de couverture précédents sont conservés ; aucun fichier métier nouveau exclu pour contourner les seuils. Aucun test natif sur appareil/simulateur, APK/IPA ou publication. La CI existante découvre les nouvelles suites automatiquement ; son exécution distante n’est pas revendiquée sur cette branche.

17 E2E : régression des phases précédentes à 320/375/768/1280 px et nouveaux parcours Phase 3 à 320/768/1280 px ; zéro violation axe A/AA détectée sur les écrans testés. Les graphiques possèdent des alternatives en tableau. Captures Phase 3 planning/progression dans ce dossier ; les anciennes captures Phase 2.5 restent historiques. Les logs de cette session sont dans `/private/tmp/revynora-3-*.log`.

## Lancement et limites

```sh
# Installation déjà configurée, migrations appliquées sur cette machine :
pnpm dev
```

Les serveurs ont été laissés démarrés en fin de recette ; réponses HTTP 200 vérifiées sur Web, connexion Admin et health/ready API.

Web `http://localhost:3000`, API `http://localhost:3001/api/v1/docs`, Admin `http://localhost:3002`. Pages : `/app/revisions`, `/app/planning`, `/app/progression`. Le même hôte doit être utilisé pendant la connexion. Expo reste un socle, lancé séparément par `pnpm dev:mobile`.

Le test distant OpenAI avec une vraie clé reste à effectuer ; son adaptateur est vérifié avec des réponses HTTP simulées. Stripe et SMTP restent ceux des phases précédentes, sans nouvelle intégration ni test externe dans cette phase. Le planning n’invente aucun droit actif : ceux-ci proviennent des périodes existantes contrôlées côté API. Les droits des tests sont des fixtures exclusives de revynora_test.

Les disponibilités sont ponctuelles, non récurrentes. L’assistant travaille sur les 30 prochains jours avec un contexte borné (100 cours, 200 tentatives soumises, 1000 cartes et 60 disponibilités), et au plus 20 séances par proposition. Le sélecteur Web reprend la première page de 20 cours de l’API existante. L’automatisation n’efface ni ne déplace les tâches existantes ; la réorganisation se fait par modification explicite. Une future extension pourra proposer la récurrence et une sélection paginée de cours plus large.

Les statistiques actuelles portent sur les événements existants Leitner et QCM. Le temps est déclaratif, les journées d’activité sont UTC, et une matière sans QCM garde un score inconnu. Les lectures statistiques chargent les faits du compte pour les agrégations : à optimiser en agrégats SQL si les historiques deviennent volumineux. Une revue manuelle avec lecteur d’écran reste utile avant diffusion ; axe n’est pas un audit WCAG exhaustif.

À développer seulement après autorisation d’une phase ultérieure : parcours Expo natifs, notifications push, authentification native sécurisée, tests device ; durcissement production déjà listé dans le cahier global. Aucun hébergement ni phase suivante commencé.
