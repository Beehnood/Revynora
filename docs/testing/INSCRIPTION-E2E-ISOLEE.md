# Recette E2E d’inscription en environnement isolé

Recette du 29 octobre 2026. Aucun accès à la production, aucun déploiement.

## Périmètre et fichiers

Le travail Admin existant est préservé : branche
`feature/admin-web-integration`, HEAD
`215c36562ad358d86c202c67e3fa11bf9a086447`, index vide et 15 fichiers Admin
non commités identiques octet par octet à leur état avant cette tâche.

Cette tâche ajoute exclusivement quatre fichiers :

- `scripts/registration-e2e/collector.mjs` : contrôles indépendants et rapport filtré.
- `scripts/registration-e2e/collector.test.mjs` : tests du collecteur et du garde-fou.
- `scripts/registration-e2e/run.mjs` : services locaux, TLS, navigateur, fixtures et recette.
- `docs/testing/INSCRIPTION-E2E-ISOLEE.md` : cette documentation.

Aucun changement de source applicative, dépendance, lockfile, migration,
configuration Vercel ou test Admin. Aucun commit, push ou merge.
Total attendu après cette tâche : 19 fichiers non commités, dont les 15 préexistants.

## Collecte et protection des secrets

Le formulaire réel est rempli dans un contexte navigateur éphémère. Le mot de
passe est aléatoire, uniquement en mémoire. Aucune trace Playwright, capture,
vidéo, HAR, export `storageState`, journal de console ou profil persistant.
Les rapports ne contiennent ni identifiant utilisateur, adresse e-mail, mot de
passe, valeur de cookie, corps de réponse, URL de base de données ou en-têtes.
Ils exposent uniquement des noms de contrôles, `passed`/`failed`/`error`, dates,
nombre de migrations et étapes techniques. Les sorties brutes des processus
API/build sont écartées ; les catégories d’erreur sont filtrées.

Le transport du formulaire est intercepté avec `route.fetch({maxRetries: 0,
maxRedirects: 0})`. Une seule requête est transmise puis son corps est chargé en
mémoire avant `route.fulfill({response})`. Le navigateur reçoit la réponse réelle
et poursuit son parcours normal ; aucune réponse de succès n’est fabriquée.
Cela évite de dépendre d’un corps récupéré via le navigateur après sa navigation.

Onze contrôles sont exécutés séparément : statut 201, Content-Type JSON,
corps JSON sans champs secrets, HttpOnly, Secure sur HTTPS, SameSite=Lax,
Path=/, session appartenant à la fixture via `/users/me`, STUDENT, FREE et
accès à l’espace étudiant. Chaque erreur est isolée ; un échec du corps n’empêche
pas les autres vérifications. Rôle et formule proviennent de l’API authentifiée,
sans dépendre du corps d’inscription.

Un cas supplémentaire force une exception de lecture du corps, après la même
inscription, puis vérifie les dix contrôles indépendants. Il ne rejoue pas
l’inscription. Cette simulation valide la résilience du collecteur ; elle ne
prétend pas reconstituer la cause exacte de l’incident de production précédent,
dont le message technique n’a pas été conservé.

## Environnement réellement utilisé

Sources copiées dans `/private/tmp/revynora-registration-e2e-validation` :
archive du HEAD avec superposition des modifications locales. Aucun fichier
d’environnement confidentiel copié. Les dépendances figées de
`/private/tmp/revynora-g9-frozen-validation` sont réutilisées par liens symboliques,
sans changement de versions ni réinstallation du dépôt principal.

- PostgreSQL existant : conteneur de recette `revynora-g9-validation-20261026`,
  loopback port 55439, base `revynora_test` uniquement.
- NestJS local : `http://127.0.0.1:3462`.
- Next.js local construit : `http://127.0.0.1:3461`.
- Proxy TLS local : `https://127.0.0.1:3460` vers Next.js pour **tous** les chemins,
  y compris `/api/v1` ; la réécriture Next.js est donc réellement exercée.
- Certificat auto-signé éphémère avec SAN IP 127.0.0.1 ; connexion TLS vérifiée
  par les détails de sécurité Playwright. Le navigateur accepte explicitement ce
  certificat de test. La clé TLS est privée, hors dépôt ; elle n’est pas une session.
- API : `COOKIE_SECURE=true`, origines HTTPS locales, `AI_PROVIDER=mock`,
  `BILLING_PROVIDER=mock`, `MAIL_PROVIDER=local`, `WORKER_ENABLED=false`.
- Mode Admin intégré désactivé dans cette recette.

Le garde-fou refuse toute URL autre qu’une base PostgreSQL `revynora_test` sur
127.0.0.1, et exige `REGISTRATION_E2E_ISOLATED=true` avant toute opération.
Une configuration distante ou mal formée est refusée sans afficher son contenu.
Le navigateur bloque les destinations externes et les mutations inattendues.
Les appels API négatifs sont limités aux URL locales constantes de la recette.

Les douze migrations préexistantes sont vérifiées : noms, sommes SHA-256,
achèvement et absence de rollback dans `_prisma_migrations`. Aucune migration
n’est appliquée par le runner et aucun seed n’est exécuté.

## Résultats réels

| Contrôle                                                            | Résultat                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tests unitaires du collecteur et du garde-fou                       | **6 réussis**, aucun ignoré                                                                    |
| Couverture ciblée `collector.mjs`                                   | **100 % lignes, 97,56 % branches, 100 % fonctions**                                            |
| Première recette navigateur                                         | Réussie, du 12:05:35 au 12:06:00 UTC                                                           |
| Recette finale avec droits API supplémentaires                      | Réussie, du 12:08:54 au 12:08:59 UTC                                                           |
| HTTP 201, Content-Type et corps JSON                                | Réussis                                                                                        |
| HttpOnly, Secure, SameSite=Lax et Path=/                            | Réussis sur une vraie connexion TLS locale                                                     |
| Session `/api/v1/users/me`, STUDENT et FREE                         | Réussis                                                                                        |
| Espace étudiant                                                     | Tableau de bord et navigation visibles après inscription                                       |
| Droits `/api/v1/learning/access`                                    | Autorisé, commercialPlan/effectivePlan FREE, source COMMERCIAL, sans attribution interne       |
| Lecture Admin avec le compte étudiant                               | **403**, refus attendu                                                                         |
| Échec forcé du corps                                                | `jsonBody=error` attendu ; **10 autres contrôles réussis**                                     |
| Doublon du compte de recette                                        | **409**, aucun second compte créé                                                              |
| Objet vide, consentement refusé et rôle ADMIN ajouté                | **400** dans chacun des trois cas                                                              |
| Session expirée de la seule fixture                                 | `/users/me` **401**, `/app` redirigé vers `/connexion`                                         |
| Vérifications en base isolée                                        | Un seul compte actif STUDENT/FREE, période gratuite ACTIVE à 0 €, message WELCOME local QUEUED |
| Séparation des droits et absence d’opération financière             | Aucun paiement, checkout, permission commerciale ou attribution G.8 créé pour la fixture       |
| Migrations                                                          | **12** cohérentes, aucune appliquée par cette recette                                          |
| Builds API et Web                                                   | Réussis ; deuxième exécution pouvant réutiliser le cache lié à la même configuration           |
| Syntaxe Node, frontières du monorepo et intégrité Prisma historique | Réussies                                                                                       |
| Prettier et `git diff --check`                                      | Réussis                                                                                        |

Les tests unitaires vérifient aussi qu’un contexte HTTP ne peut pas servir de
preuve Secure/HTTPS, que l’absence du cookie est détectée et qu’un échec de lecture
du profil ne masque pas les autres contrôles.

Erreur intermédiaire : une assertion unitaire attendait 12 contrôles au lieu
des 11 réellement définis ; le décompte a été corrigé, sans modifier ni supprimer
de contrôle. Aucun échec applicatif pendant les deux recettes E2E. Le cas
`jsonBody=error` est une panne injectée attendue, jamais comptée comme une lecture
réussie. Aucun contrôle final échoué, interrompu ou ignoré.

Chaque exécution crée sa propre fixture aléatoire dans la base isolée, la vérifie,
expire uniquement ses sessions, puis supprime cette seule fixture et ses relations
en cascade. Les autres utilisateurs et conteneurs sont préservés. Aucun fichier
de preuve n’est supprimé. Seuls les groupes de processus démarrés par le runner
sont arrêtés.

## Reproduction

Prérequis : Node compatible avec le dépôt, pnpm 10.18.3, OpenSSL, Chromium
Playwright 1.56.1 et dépendances conformes à `pnpm-lock.yaml`. Utiliser une copie
isolée des sources incluant les quatre fichiers de cette tâche ; ne pas changer
la branche ni réinstaller les dépendances du dépôt de travail pour cette recette.
Dans une nouvelle copie, installer les dépendances avec
`pnpm install --frozen-lockfile` et générer le client Prisma avec `pnpm db:generate`.
Si PostgreSQL est neuf, préparer ses migrations exclusivement dans la base de
test après vérification de l’URL ; le runner refuse une base non préparée.

Depuis la racine de cette copie, fournir `TEST_DATABASE_URL` via l’environnement
privé, sans la placer dans les arguments, les journaux ou un fichier de recette.
Elle doit pointer vers `postgresql://…@127.0.0.1:PORT/revynora_test`.
Ne pas exporter `DATABASE_URL` d’une base applicative.

```sh
node --test scripts/registration-e2e/collector.test.mjs

node --experimental-test-coverage --test \
  --test-coverage-include='scripts/registration-e2e/collector.mjs' \
  scripts/registration-e2e/collector.test.mjs

REGISTRATION_E2E_ISOLATED=true node scripts/registration-e2e/run.mjs
```

Les ports 3460, 3461 et 3462 doivent être libres. Le runner ne réutilise pas de
serveur existant. Il construit API et Web, démarre les services locaux, crée un
certificat TLS d’un jour, exécute le parcours et les refus, nettoie sa fixture et
écrit un `report.json` filtré dans un dossier temporaire. Son code de sortie vaut
0 seulement si tous les contrôles attendus réussissent. Ne pas activer DEBUG,
PWDEBUG, capture réseau, traces, vidéo ou journalisation des corps/en-têtes.

Preuves de cette exécution, hors Git :

- `/private/tmp/revynora-registration-isolated-attempt1.log`
- `/private/tmp/revynora-registration-isolated-final.log`
- Rapports `report.json` dans les dossiers temporaires indiqués par ces deux logs.

## Limites et décision

La couverture indiquée est celle du **collecteur**, pas de l’ensemble des
applications ni du runner d’orchestration. Les grandes suites Web/Admin/API et
les tests de paiement ne sont pas relancés dans cette tâche ; leurs seuils et
leurs fichiers restent inchangés. Les builds et le parcours local réel ont été
exécutés, mais aucun résultat de CI distante n’est revendiqué.

La recette prouve les attributs du cookie sur TLS local avec certificat de test,
pas la chaîne de confiance d’un certificat public ni la configuration Vercel.
Elle ne valide ni SMTP réel ni envoi du message de bienvenue : le message local
est seulement en file, worker désactivé. Aucun test de production ni nouvel
utilisateur de production, aucune opération Stripe.

**GO technique pour la recette isolée.** Aucun résultat ne rend complet le test
de production antérieur. Les quatre nouveaux fichiers restent non commités,
en attente de validation, avec le travail Admin préexistant intact.
