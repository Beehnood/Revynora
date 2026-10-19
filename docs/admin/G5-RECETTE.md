# G.5 — Supervision agrégée, recette locale

Base `fbc65c204c67121576ace1cd402c02d863c69844`, branche `feature/admin-dashboard`. Audit préalable et exclusions : [G5-AUDIT.md](G5-AUDIT.md). Aucun commit, migration, seed, accès production ni modification distante. Aucun développement G.6.

## KPI retenus

| KPI                    | Sélection, unité et limites                                                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requêtes et erreurs IA | Agrégats G.3 réutilisés : lignes AIUsage créées dans la période, fournisseur/statut séparés. ERROR désigne une requête enregistrée en erreur, pas chaque tentative HTTP. Aucun prompt ni errorCode libre.                                                                                                   |
| Tokens IA              | Sommes exactes entrée/sortie en chaînes décimales. Zéro enregistré ne prouve pas zéro consommation fournisseur. Simulation séparée par provider mock.                                                                                                                                                       |
| Estimations IA         | Somme USD connue et nombre de requêtes estimées / nombre enregistré par fournisseur/statut. Null reste indisponible, jamais une facture ou un coût complet certifié.                                                                                                                                        |
| Révisions Leitner      | Nombre de Revision créées dans la période. Événements conservés, pas étudiants actifs, réponses ou réussite d'apprentissage.                                                                                                                                                                                |
| Plans créés            | Nombre de StudyPlan créés dans la période, toutes origines. Pas uniquement les générations IA.                                                                                                                                                                                                              |
| Éléments créés         | Nombre de StudyPlanItem créés dans la période par statut actuel PLANNED/DONE/CANCELLED. Pas de durée étudiée, ni statut historique à la fin de période.                                                                                                                                                     |
| Rappels                | Nombre de ReminderDelivery par statut actuel dont dueAt est dans la période et dont l'élément existe encore. Plusieurs versions d'un élément peuvent compter. SENT peut résulter d'une simulation locale ; aucun taux de livraison réelle. Autres statuts regroupés en OTHER sans exposer leur texte libre. |

Filtre commun soumis explicitement dans la vue générale, 1 à 366 jours UTC, début inclus et fin exclue. Paramètres supplémentaires refusés. Les lignes absentes signifient aucune activité enregistrée pour le groupe ; plans/révisions renvoient explicitement zéro. Les suppressions peuvent faire diminuer les comptes. Les snapshots IA et supervision proviennent de deux transactions distinctes ; aucune cohérence atomique entre ces sections n'est revendiquée.

## Implémentation et sécurité

Une section accessible de tableau est ajoutée au Dashboard existant, avec chargement, vide, erreur et reprise indépendants. Navigation G.1–G.4 conservée. La section IA G.3 est réutilisée, sans dupliquer ses agrégations.

Nouveau endpoint GET `/api/v1/admin/supervision`, AdminGuard, capacité nommée `supervision/read` exclusivement. Les permissions `ai`, `leitner`, `planning` restent vides. Aucun identifiant ou filtre utilisateur, carte, réponse, contenu, titre de plan, horaire individuel, adresse ou objet de message dans le contrat. Aucun endpoint étudiant appelé. Aucune mutation ou route de détail ajoutée.

SQL paramétré, agrégation en base, groupes fixes (au plus 9 avec les enums actuels). TimeZone UTC, statement_timeout 5 s, transaction RepeatableRead 12 s, attente 3 s. Les limites de période/sortie et délais ne bornent pas les lignes scannées : index et risques documentés dans l'audit. Les petits effectifs restent visibles aux administrateurs ; aucune garantie d'anonymisation statistique n'est revendiquée.

## Résultats

Node 24.3.0, pnpm 10.18.3. Copie isolée G.4 réutilisée et synchronisée avec les sources G.5, sans fichier .env copié ; journaux G.5 indépendants.

| Contrôle                                           | Résultat                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Tests Admin avec couverture                        | 36 réussis, 12 fichiers                                               |
| Tests unitaires API                                | 56 réussis, 15 fichiers                                               |
| Intégrations PostgreSQL/HTTP                       | 37 réussies : SaaS 21, pédagogie 11, planning phase 3 : 5             |
| Playwright Chromium                                | 11 réussis, régressions G.2/G.3/G.4 et supervision G.5 aux 3 largeurs |
| ESLint et TypeScript Admin/API                     | Réussis                                                               |
| ESLint scénario navigateur modifié, TypeScript Web | Réussis                                                               |
| Builds Admin/API HTTPS forcés                      | Réussis                                                               |
| Frontières du monorepo                             | Réussies                                                              |
| Build Admin loopback de recette                    | Réussi, non livrable                                                  |

Total : **140 tests distincts réussis**. Couverture Admin : lignes/statements 99,16 %, branches 93,75 %, fonctions 90,24 %. Aucun seuil abaissé ou fichier exclu.

Les intégrations vérifient ADMIN/anonyme/STUDENT, début inclus/fin exclue, période vide et invalide, refus de filtre utilisateur, agrégats exacts, statut libre normalisé, rappel orphelin exclu, absence de champs privés dans la réponse et routes de détail/mutation absentes. Les unitaires vérifient permissions privées inchangées, transaction bornée, date/comptage invalide et propagation d'un timeout plutôt qu'un zéro inventé.

Playwright enrichit les trois scénarios statistiques G.3 : plan privé de fixture jamais affiché, compte de plans correct, période vide, erreur 503 supervision et reprise. Contrôles axe A/AA, absence de débordement global et alternative textuelle à 320/768/1280 px. Capture mobile inspectée. Les 8 autres scénarios préservent les parcours et protections G.2/G.4 ; G.1 est couvert par les intégrations et permissions. Aucun audit manuel au lecteur d'écran ou appareil physique revendiqué.

Les premiers essais PostgreSQL et navigateur ont été bloqués par le sandbox (réseau/écoute locale), puis relancés avec autorisation d'accès local et réussis. URL contrôlée en mémoire : loopback et nom revynora_test uniquement. Aucun reset, migration ou seed. Fixtures supprimées uniquement par identifiants propres ; rappels explicitement nettoyés, worker désactivé pour la recette navigateur. Adaptateurs distants simulés dans les tests. Serveurs 3411/3412 dédiés, arrêtés en fin de recette.

Journaux et preuves : dossier désigné par `/private/tmp/revynora-g5-location`. Les captures sont dans la copie de recette (chemin enregistré dans la preuve). Le build loopback est réservé aux tests ; le build HTTPS a été validé séparément. Aucun build déployé.

## Décision

**GO pour revue locale G.5**, avec les limites de mesure et de charge ci-dessus. Les informations de livraison effective, de facturation IA ou de temps réellement étudié restent indisponibles. Aucune permission privée étendue, aucune modification Web hors scénario de tests Admin. Les autres branches, worktrees légaux et Vercel restent intacts. Toute suite requiert une nouvelle autorisation.
