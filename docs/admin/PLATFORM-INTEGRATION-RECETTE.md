# Intégration locale G.1–G.8 avec main — 22 octobre 2026

Les sections initiales décrivent la recette du 22 octobre, avant publication de la branche et ouverture de la PR. Le complément du 23 octobre ci-dessous décrit le correctif local de la PR #5.

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

## Complément du 23 octobre — corrections locales de la PR #5

Référence initiale vérifiée : feature/platform-integration, HEAD 51a4677daf2fdaf607eff70aa94c8d295ff85e3e, dépôt propre ; PR #5 ouverte sur main 8db3ab34a5fbfc74328602c30034963e3f2830ca. Les derniers runs distants de cette référence sont Backend/Web/Admin réussis, Quality/Mobile échoués. Aucun changement de main, feature/admin-dashboard ou de sa référence distante.

### Expo : cause, périmètre et sécurité

Le contrôle Expo en ligne compare les versions aux recommandations officielles : SDK 57 attend ~57.0.31, alors que le projet épingle 57.0.30. Correction : expo épinglé exactement à 57.0.31 et lockfile régénéré avec pnpm 10.18.3. React 19.2.3, React Native 0.86.3, TypeScript Mobile 6.0.3 et TypeScript des autres workspaces 5.9.3 restent inchangés, conformément aux métadonnées SDK 57. Aucun passage à SDK 58.

Chaîne vérifiée dans les métadonnées npm : expo@57.0.31 dépend de @expo/config-plugins@~57.0.11, qui dépend de xcode@^4.0.0. L'ajout de xcode@4.0.0 a fait l'objet d'une autorisation utilisateur explicite et limitée à cette majeure transitive. Aucun autre changement majeur détecté.

Versions de paquets ajoutées au lockfile : expo@57.0.31, @expo/cli@57.0.32, @expo/config-plugins@57.0.11, @expo/router-server@57.0.14, expo-modules-core@57.0.24, expo-modules-jsi@57.1.3 et xcode@4.0.0. Les anciennes versions correspondantes sont retirées lorsqu'elles ne sont plus nécessaires ; @expo/config-plugins@57.0.10 et xcode@3.0.1 restent requis par d'autres chemins existants. Les nombreuses références de snapshots changent uniquement leur contexte de peer Expo. Aucun autre importer que apps/mobile ne change. Une métadonnée de dépréciation ESLint est rafraîchie par le registre, sans changement de sa version.

Deux installations pnpm install --frozen-lockfile ont réussi dans les laboratoires. Aucun avis connu retourné par l'API npm advisories/bulk pour ces sept nouvelles versions à la date de la recette ; ce contrôle ne constitue pas une garantie d'absence de vulnérabilité du monorepo entier. Le warning de peer préexistant de test-renderer/react-reconciler demandant React ^19.3.0 reste documenté ; aucune mise à jour React non autorisée n'est effectuée. Les tests Mobile passent avec les versions conservées.

Sources : [matrice SDK Expo](https://docs.expo.dev/versions/latest/), [métadonnées officielles SDK](https://exp.host/--/api/v2/versions), [Expo 57.0.31](https://registry.npmjs.org/expo/57.0.31), [config-plugins 57.0.11](https://registry.npmjs.org/@expo%2fconfig-plugins/57.0.11).

### Timeout : diagnostic et correction

Test identifié : apps/mobile/tests/screens.test.tsx, « native login validates input and never exposes password by default », délai Jest existant de 5 s. session.authenticate est mocké avec une promesse immédiatement résolue : ce test n'effectue ni requête HTTP ni scrypt. L'API effectue du scrypt dans une autre suite, qui partage la capacité CPU du runner lorsqu'elle s'exécute en parallèle.

Quality lance plusieurs suites de couverture via Turbo simultanément. --runInBand sérialise les tests de Jest mais pas les processus Vitest des autres workspaces. Dans un laboratoire Linux Node 22 limité à 2 vCPU, l'exécution parallèle de référence reproduit exactement l'échec : 23 tests Mobile réussis et le même test en timeout. Les compteurs CPU observés montrent 464 périodes de limitation sur 541. Ces mesures concernent le laboratoire contrôlé ; aucune mesure CPU directe du runner GitHub n'est revendiquée.

Sur les mêmes versions de référence, pnpm test:coverage --concurrency=1 passe toutes les suites. La seule modification du workflow Quality est cette option de planification, avec un commentaire explicatif. Les timeouts, assertions, mocks, guards, paramètres scrypt et seuils de couverture ne changent pas ; aucun test n'est retiré ou ignoré. Deux relances Mobile complètes avec cache Jest froid sur le candidat passent 24/24 chacune : durée du test de connexion 4210 ms puis 2833 ms, sous le délai conservé de 5000 ms.

### Scénario étudiant ancien révélé par la recette complète

La première exécution effective de la suite étudiante révèle 16 succès et un échec : un scénario attend Catalogue des offres alors que G.7 le place dans un panneau details replié. L'état de la page confirme que l'authentification et le dashboard fonctionnent. Le test apps/web/tests/e2e/saas.spec.ts ouvre désormais « Offres, événements financiers et journal d’audit » avant de vérifier le titre. L'assertion de visibilité, les contrôles de permissions, paiement et Axe sont conservés. Aucune modification du composant applicatif.

### Validations du candidat

Recette dans des conteneurs dédiés sans .env, avec PostgreSQL neuf en tmpfs et Redis éphémère ; URL loopback revynora_test et G8_ISOLATED_TEST_DB=true explicitement transmis. Aucun port publié sur l'hôte, aucune base applicative utilisée. Les quatre conteneurs dédiés ont été supprimés après sauvegarde des preuves. Les trois comptes synthétiques laissés par des relances API interrompues ont disparu avec la base éphémère ; aucun compte des scénarios navigateur G.7/G.8 ne subsistait. Aucun service de développement préexistant n’a été arrêté. Les dépendances ne sont pas réinstallées dans le dépôt principal. Résultats et commandes exactes : /private/tmp/revynora-pr5-ci-6kglg5kj, également désigné par /private/tmp/revynora-pr5-ci-location.

| Contrôle                                          | Résultat                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Installation figée du candidat                    | Réussie dans les deux laboratoires                                                               |
| expo install --check en ligne                     | Réussi, sans désactiver le contrôle de compatibilité                                             |
| ESLint et TypeScript des workspaces               | Réussis ; scénario Web corrigé revérifié séparément                                              |
| Prisma validate, frontières, intégrité historique | Réussis ; 5 tests du vérificateur de frontières réussis                                          |
| Couverture complète séquentielle                  | 231 tests réussis : API 117, Admin 43, Web 44, Mobile 24, client API 3 ; seuils conservés        |
| Intégrations PostgreSQL G.8                       | Incluses dans les 117 API réussis ; neuf migrations appliquées uniquement au PostgreSQL éphémère |
| Builds API/Web/Admin                              | Réussis ; variantes loopback réservées à la recette                                              |
| Exports Android/iOS Expo 57.0.31                  | Réussis, sortie /tmp/mobile-export dans le laboratoire                                           |
| Playwright étudiant avec Axe                      | 17 réussis après correction de navigation, aucun test ignoré                                     |
| Playwright Admin G.2–G.8 avec Axe                 | 23 réussis : 14 G.2–G.6, 5 G.7, 4 G.8 ; aucune violation Axe détectée aux largeurs prévues       |

### Incidents locaux et limites

Le disque interne Docker est saturé. Le premier laboratoire a produit une erreur Redis RDB ENOSPC puis un timeout HTTP API lors d'une autre relance. Redis de test a été recréé en tmpfs ; un second environnement avec caches et sorties en mémoire a permis la couverture complète verte, sans modifier le code API. APT a initialement échoué faute d'espace ; sa préparation a réussi avec ses caches en mémoire et vérification des signatures conservée. Chromium sur tmpfs noexec a d'abord empêché le démarrage des 17 tests, puis son cache a été copié dans un répertoire exécutable du conteneur. Le premier build combiné a rencontré EBUSY en supprimant le point de montage dist ; les exports ont ensuite réussi avec le même exporteur vers un sous-dossier temporaire, et les builds serveur séparés ont réussi. Aucun de ces échecs n'est déclaré comme un succès.

Le build Docker de migration du candidat n'est pas relancé faute d'espace interne ; celui de la référence distante 51a4677 a réussi dans Backend validation sur GitHub. Aucun nettoyage Docker global n'a été effectué. Les compilations natives signées, appareils physiques, Safari et fournisseurs réels ne sont pas testés. Les exports JS/Hermes Android/iOS ne constituent pas des binaires natifs signés.

Fichiers du correctif : .github/workflows/ci.yml, apps/mobile/package.json, pnpm-lock.yaml, apps/web/tests/e2e/saas.spec.ts et ce bilan. Aucun fichier de production, modèle Prisma, migration, permission ou fonctionnalité métier modifié. La publication du correctif reste soumise à revue ; aucun push ni merge. Les cinq workflows devront être verts sur le nouveau SHA après autorisation de push. Les contrôles obligatoires et approbations de main restent à cadrer séparément ; aucune protection distante n'est modifiée ici.
