# Intégration locale G.1–G.8 avec main — 22 octobre 2026

## Git et périmètre

Branche `feature/platform-integration`, départ G.8 `496150034a12ca14710bfced6776c65c6b1e8e48`, dépôt initial propre. Fetch origin effectué. Merge normal de `origin/main` (`8db3ab34a5fbfc74328602c30034963e3f2830ca`) : `2eb8183785f2fcb97caa5298d497121f931f0dfa`, parents G.8 puis origin/main. Seul conflit : turbo.json ; suppression d'une seconde définition identique de dev, conservation des dépendances ^build, sorties Next/dist/Expo, couverture sans cache et variables CI existantes. Aucun autre conflit.

Le commit de merge est le seul commit créé. main, feature/admin-dashboard et sa référence distante restent inchangés. Les corrections ci-dessous restent non indexées et non commitées. Aucun push de cette branche, aucune PR ni fusion vers main.

## Corrections CI proposées

- Quality et Backend : DATABASE_URL et TEST_DATABASE_URL explicites vers le service PostgreSQL éphémère, hôte 127.0.0.1, base revynora_test ; G8_ISOLATED_TEST_DB=true. Aucun accès à une base applicative ou de production. Les services Redis existants restent conservés.
- Turbo : transmission explicite de G8_ISOLATED_TEST_DB dans globalPassThroughEnv et test:coverage.passThroughEnv ; tâches et variables existantes conservées.
- Admin : service PostgreSQL dédié, préparation des migrations de test, génération Prisma, build API/Web/Admin pour les ports de recette 3410–3412. Le build Admin initial reste conservé. Filtres de déclenchement élargis aux dépendances API, Web, Prisma et au script navigateur.
- scripts/admin-ci-browser.cjs : vérification de l'URL loopback revynora_test et du marqueur d'isolation, compte ADMIN synthétique par UUID, mot de passe aléatoire uniquement en mémoire, hachage applicatif existant, suppression par son UUID dans finally. Aucun compte réel, attribution interne ou abonnement créé par ce script. Les tests G.8 conservent leurs propres fixtures temporaires.
- Trois invocations Playwright distinctes : G.2/G.3/G.4/G.6, G.7, G.8. Redémarrage des serveurs entre lots, limites de connexion inchangées. Captures conservées dans des sous-dossiers séparés et publiables comme artefacts CI.
- Workflows Web et Mobile inchangés. Suite navigateur étudiante Quality conservée ; seuils et règles métier inchangés. Aucun ajout de dépendance au dépôt.

## Recette réellement exécutée

Copie sans .env : `/private/tmp/revynora-integration-thx17esb/source`. Journaux et captures dans le dossier parent, indiqué aussi par `/private/tmp/revynora-integration-location`. Dépendances verrouillées déjà présentes réutilisées ; liens des workspaces corrigés dans la copie temporaire. Chromium correspondant à Playwright installé pour la recette. Node local 24.3.0, pnpm 10.18.3 ; Mobile validé dans Docker Linux Node 22.18.0, sans réseau. Les cinq fichiers CI/script correspondent par SHA-256 à la copie testée (`ci-manifest.json`).

PostgreSQL neuf postgres:17.6-alpine en tmpfs sur 127.0.0.1:55439/revynora_test ; Redis neuf sur 127.0.0.1:56389. Fournisseurs mock et worker désactivé hors tests dédiés. Aucune migration de la base applicative ; aucune attribution au propriétaire. En fin de recette : zéro User, zéro InternalLearningGrant et neuf migrations terminées dans la base de test ; les deux conteneurs éphémères ont ensuite été supprimés. Les services applicatifs préexistants sont conservés. Les refus du script navigateur sans marqueur G.8 ou avec URL distante ont également été exécutés et confirmés avant toute connexion.

| Contrôle                                                                                | Résultat réel                                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier du dépôt copié, puis contrôle final des fichiers livrés                        | Réussi                                                                                                                                                                             |
| Frontières et tests du vérificateur                                                     | Réussis ; 5 tests                                                                                                                                                                  |
| Intégrité historique Prisma, generate et validate                                       | Réussis                                                                                                                                                                            |
| Neuf migrations sur PostgreSQL neuf, puis seconde application sans migration en attente | Réussies                                                                                                                                                                           |
| ESLint API/Web/Admin/packages                                                           | Réussi                                                                                                                                                                             |
| TypeScript API/Web/Admin/packages                                                       | Réussi                                                                                                                                                                             |
| Unitaires séquentiels API/Admin/Web/client API                                          | 64 / 43 / 44 / 3 réussis                                                                                                                                                           |
| API : unitaires et intégrations HTTP/PostgreSQL                                         | 117 réussis, 24 fichiers ; comprend les 64 unitaires, ne pas les additionner à nouveau                                                                                             |
| Couverture API/Admin/Web/client API                                                     | Seuils existants passés ; aucun seuil abaissé                                                                                                                                      |
| Playwright Admin G.2–G.6                                                                | 14 réussis                                                                                                                                                                         |
| Playwright G.7                                                                          | 5 réussis : 320/375/768/1280/1440 px, Axe et clavier inclus                                                                                                                        |
| Playwright G.8                                                                          | 4 réussis : 375/768/1440 px et révocation, Axe inclus                                                                                                                              |
| Builds API/Web/Admin                                                                    | Réussis ; builds loopback de recette non livrables                                                                                                                                 |
| Mobile dans Docker Linux Node 22                                                        | ESLint, TypeScript, 24 tests avec couverture, export Android/iOS réussis                                                                                                           |
| Expo install --check                                                                    | Retour 0 hors ligne ; l'outil avertit que cette validation hors ligne est moins fiable                                                                                             |
| Docker API target runtime                                                               | Réussi, image locale uniquement                                                                                                                                                    |
| Docker target migration                                                                 | Échec de l'extraction finale par manque d'espace disque Docker ; construction interne terminée et pnpm --version non-root/sans réseau réussi, mais build global non déclaré réussi |
| YAML des cinq workflows, clés uniques                                                   | Valide, parsing dans l'image Linux                                                                                                                                                 |

Couverture statements/lignes : API 95,83 %, Admin 98,32 %, Web 97,09 %. Le périmètre de couverture API préexistant n'inclut pas toutes les sources learning-access ; ses tests unitaires/intégrations sont exécutés, sans revendication de couverture globale de ce module. Mobile : 24 tests, couverture lignes 74,47 %, seuils existants inchangés.

## Incidents et contrôles non exécutés

Premier build lancé avant la fin de generate : client Prisma périmé, échec TypeScript ; relance après génération réussie. Liens initiaux des dépendances de copie non isolés correctement, corrigés avant les validations finales. Premiers tests navigateur bloqués par Chromium absent ; installation du navigateur verrouillé, puis les 23 scénarios passent. Un lancement parallèle des unitaires a dépassé les 5 s du test scrypt ; relance séquentielle complète réussie, sans modifier le test ou son délai.

Les commandes Mobile macOS sont restées bloquées sur les dépendances locales ; elles ont été arrêtées et remplacées par la validation Linux ci-dessus. La commande globale de couverture n'a pas terminé sur macOS à cause de Mobile ; ses suites API/Admin/Web/client ont terminé et passé leurs seuils, et Mobile a été validé séparément dans Linux. Aucun succès global macOS n'est revendiqué.

Suite navigateur étudiante par défaut non relancée localement : ses ports 3000–3002 appartiennent aux serveurs de développement préexistants, qui n'ont pas été arrêtés. Elle reste dans Quality et devra passer sur GitHub. Aucun test Safari, appareil physique, signature native, fournisseur réel ou charge production. Les workflows GitHub modifiés n'ont pas été exécutés sur GitHub, puisque cette branche n'est pas publiée.

## Les cinq migrations supplémentaires par rapport à origin/main

1. free_history : insertion/upsert de l'offre Free et reprise des périodes Free initiales, sans paiement ; vérifier volumétrie et catalogue sur copie représentative avant application réelle.
2. task_versions : table/index/FK, snapshot des tâches existantes et trigger interdisant UPDATE ; reprise potentiellement coûteuse et impact sur les procédures de maintenance.
3. phase3_learning_plans : colonnes, disponibilités, index, FK et contraintes ; valider les données existantes avant ajout des contraintes, prévoir les verrous ALTER TABLE/CREATE INDEX.
4. planning_idempotency : colonnes nullable et index unique ; aucun changement de paiement, surveiller le coût de construction d'index.
5. internal_learning_grants : table, index, contraintes et trois FK restrictives ; aucune attribution automatique. La suppression d'un administrateur ayant des preuves d'attribution nécessite une procédure dédiée.

Aucun DROP TABLE, TRUNCATE ou reset dans ces cinq migrations. Certaines migrations écrivent des reprises de données ; absence de suppression ne signifie pas absence de risque. L'application réelle nécessite une autorisation distincte, sauvegarde vérifiée, répétition sur copie représentative et plan de restauration coordonné avec la version API. Les anciennes migrations ne sont pas modifiées.

## Décision avant PR

GO pour revue des corrections locales, pas pour fusion ni déploiement. Avant PR : validation des fichiers non commitées, espace Docker disponible et nouvelle vérification du build migration, puis autorisation de commit/publication de la branche et exécution des cinq workflows GitHub, dont la suite navigateur étudiante Quality. Migration applicative et activation du propriétaire restent hors autorisation. Aucun développement G.9.
