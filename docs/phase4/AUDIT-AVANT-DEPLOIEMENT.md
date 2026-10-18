# Audit avant déploiement — 17 octobre 2026

**Décision : GO technique local pour préparer un pilote contrôlé ; NO-GO pour un déploiement immédiat ou une ouverture commerciale.** Aucun accès SSH, changement Oracle, opération Vercel/EAS, push, fusion ou modification de base existante n’a été effectué.

## Périmètre et provenance

Le dossier initial `Revynora-vercel-fix` est sur `fix/vercel-url`, commit `721afaf`, sans les fichiers phase 4. L’audit et les corrections portent sur le worktree existant voisin `Revynora`, branche `feature/phase-4-deployment-mobile`, commit initial `b64d857`, initialement propre. Le changement de worktree a été signalé et les écritures hors du dossier initial autorisées par le mécanisme de permissions. Aucun checkout/reset ni changement de branche.

Lecture des infrastructures de production, scripts de sauvegarde/restauration, documentation phase 4, schéma/huit migrations Prisma, configurations et code de démarrage/authentification Nest, Turbo, cinq workflows Actions, trois fichiers Vercel et configurations Next/Expo. Aucun AGENTS.md trouvé dans le dépôt.

Les caractéristiques Oracle sont **fournies par l’utilisateur, sans vérification distante dans cet audit** : Ubuntu 24.04 ARM64, 1 CPU, 5,8 Gio RAM, 36 Go libres, Nginx 1.24, PostgreSQL 16 et deux applications PM2 existantes ; 3000/3001 occupés, 3101 libre. La simulation apt Docker déjà validée n’est pas une installation.

## Problèmes corrigés

1. **Bloquant Docker : migration sans pnpm disponible hors réseau.** Le build prépare Corepack sous root, puis le stage `migration` passe à `USER node`. Son cache utilisateur est différent ; le premier `pnpm db:migrate` tente de télécharger pnpm. Sur le réseau Compose `private` interne, il échoue avec `EAI_AGAIN registry.npmjs.org` avant toute migration. Correction : `COREPACK_HOME=/opt/corepack` avant `corepack prepare`, partagé entre build et utilisateur node. Preuves : `docker run --rm --network none --entrypoint pnpm … --version` renvoie `10.18.3`, huit migrations appliquées sur une base neuve isolée puis zéro migration restante.
2. **Bloquant CI : Prettier refuse `apps/mobile/tests/secure-store.test.ts`.** Formatage seulement, aucune modification fonctionnelle.
3. **Lacune de non-régression CI : le backend construit uniquement le runtime.** Ajout du build du stage migration et de l’exécution de pnpm en utilisateur non-root sans réseau, pour détecter le défaut précédent.

Les types générés Next contenaient aussi des fichiers tels que `routes.d 3.ts`, provoquant `TS2300: Duplicate identifier LayoutProps`. Les deux anciens dossiers `.next` ont été conservés dans `/private/tmp/revynora-next-artifacts-*` puis régénérés ; aucune modification de configuration TypeScript pour masquer ce problème local. Les captures E2E régénérées ont été conservées dans `/private/tmp/revynora-e2e-screenshots`, et leurs versions Git initiales rétablies après constat de l’état initial propre.

## Résultats exécutés

| Vérification                                                             | Résultat final                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec turbo lint typecheck test --force --concurrency=2 --continue` | 20 tâches réussies, 0 cache, 22,036 s                                                                                                                    |
| Tests unitaires                                                          | API 37/37 ; Web 43/43 ; Admin 10/10 ; Mobile 24/24 ; client API 3/3 : **117/117**                                                                        |
| `pnpm exec turbo build --force --concurrency=1` après régénération Next  | 6 tâches réussies, 0 cache, 1 min 4,768 s ; API, Web, Admin, export Expo Android/iOS et deux packages partagés                                           |
| Couverture via `pnpm test:coverage --force --concurrency=1`              | 7 tâches réussies, 0 cache, 35,27 s ; **153/153 tests** incluant les intégrations API                                                                    |
| API dans le stage migration Linux ARM64                                  | 13 fichiers et **73/73 tests**, 19,84 s ; PostgreSQL/Redis réels neufs                                                                                   |
| Playwright avec Chromium correspondant à 1.56.1                          | **17/17**, 54,1 s ; parcours étudiant, abonnements simulés, planning, Admin, accessibilité et largeurs 320–1280 px                                       |
| Contrôles HTTP sur le runtime Docker production                          | **11/11** : readiness, session obligatoire, CORS autorisée/refusée, CSRF, cookies, session native, rôle Admin et révocation                              |
| Docker runtime ARM64                                                     | Build réussi, `dist/main.js` présent, modules Prisma Client/généré/validation résolus, utilisateur `node`, conteneur healthy                             |
| Migrations                                                               | 8/8 sur PostgreSQL neuf ; seconde exécution sans migration en attente                                                                                    |
| Initialisation catalogue                                                 | Réussie, offres existantes préservées, aucun paiement/compte/période payante créé                                                                        |
| Sauvegarde/restauration locale                                           | `pg_dump --format=custom`, restauration `--exit-on-error --no-owner` vers une nouvelle base `revynora_restore_audit` ; 8 migrations terminées retrouvées |
| Nginx 1.24 ARM64                                                         | `nginx -t` réussi avec site TLS, snippet proxy, limites et certificat local éphémère ; aucun port publié                                                 |
| Compose et secrets de test                                               | `config --quiet` et `validate-config.mjs` réussis avec secrets aléatoires temporaires distincts                                                          |
| Prisma / architecture                                                    | Schéma valide ; `check:boundaries`, `check:prisma-integrity` réussis ; huit migrations historiques conservées                                            |
| Expo versions                                                            | `EXPO_OFFLINE=1 … expo install --check` : dépendances à jour, avec avertissement explicite de fiabilité limitée hors ligne                               |

Les builds globaux et contrôles locaux utilisent Node 24.3.0/pnpm 10.18.3 ; l’image API utilise Node 22.18.0 Linux ARM64. Les builds de simulation Vercel sont aussi exécutés sous Node 22.23.2, avec `VERCEL=1`, `API_URL=https://api.revynora.watercode.dev`, `ADMIN_ORIGIN=https://admin.revynora.watercode.dev` et `NEXT_PUBLIC_WEB_ORIGIN=https://revynora.watercode.dev`, sans appel à la CLI Vercel. Résultat : **4 tâches réussies sur 4, zéro cache, 43,69 s**. Les deux manifests Next ont ensuite été contrôlés pour confirmer la destination HTTPS des rewrites API.

Échecs intermédiaires distingués du résultat final : timeout 5 s du hachage de mot de passe sous forte concurrence, types Next dupliqués, Prettier, défaut Corepack réel, première intégration Docker sans `REDIS_URL` explicite et Chromium 1194 absent. Les corrections ou ajustements d’environnement ont été suivis d’une réexécution. L’intégration sans Redis avait 72/73 tests réussis ; la reprise avec Redis a 73/73. La commande Expo `--offline` n’est pas supportée ; vérification reprise avec `EXPO_OFFLINE=1`.

Le contrôle Prettier ciblé sur les quatre fichiers formatables modifiés réussit. Le contrôle global final `pnpm format:check` et les dernières inspections Git sont restés bloqués lors des accès au dossier Documents : des répertoires de couverture dupliqués et plusieurs fichiers portent les attributs macOS `compressed,dataless`. Les contrôles globaux concernés n’ont donc pas de résultat final réussi revendiqué. Les vérifications d’audit bloquées ont été interrompues sans supprimer ces fichiers ni intervenir sur le système de synchronisation. La syntaxe shell globale n’a pas pu être entièrement revérifiée pour la même raison. L’état Git initial et les inspections intermédiaires sont consignés ; il faut refaire le contrôle global de formatage et l’inspection Git lorsque les fichiers sont disponibles localement.

## Compatibilité et budget Oracle

Node Bookworm/OpenSSL, PostgreSQL 17.6 Alpine et Redis 7.4.6 Alpine ont réellement fonctionné sur le moteur Docker local `aarch64`. Prisma Client est généré dans le build Linux ARM64 et son moteur est chargé par les requêtes réelles. Les paquets runtime déployés suffisent au démarrage ; le CLI Prisma et les sources/migrations restent dans le stage d’outillage distinct. L’usage d’un PostgreSQL 17 dédié en conteneur ne requiert aucune modification du PostgreSQL 16 hôte.

Les limites préparées représentent **2048 Mio**, soit 2 Gio : API 768, PostgreSQL 1024, Redis 256. Sur 5,8 Gio totaux, il reste théoriquement 3,8 Gio avant consommation de l’OS, Nginx, PostgreSQL hôte et Gmilli/AAFPN. Ce calcul ne prouve pas la mémoire disponible. Mesure locale ponctuelle : API 63,34 Mio, PostgreSQL 55,89 Mio, Redis 8,73 Mio ; ce n’est ni un pic ni une extrapolation de charge Oracle.

Les quotas CPU (1 + 1 + 0,5) sont des plafonds individuels, pas des réservations ; les services se partageront le seul cœur avec les applications existantes. Ils ne garantissent pas de marge aux autres processus. Le stage migration et les builds ne sont pas couverts par les limites mémoire/CPU du service API. La simulation locale ne reproduit pas le cœur unique ou la pression mémoire Oracle. Une mesure de charge et de mémoire disponible demeure nécessaire.

Tailles locales indicatives : image API finale 170 114 928 octets (environ 170 Mo) et image de migration 819 574 356 octets (environ 820 Mo), hors couches/intermédiaires, store Docker, PostgreSQL/WAL et sauvegardes. Le build installe les dix workspaces, y compris Expo ; le déploiement pnpm legacy produit aussi des avertissements de résolution/peers. **Privilégier des images ARM64 préconstruites et testées hors de la VM partagée**, transférées lors d’un déploiement ultérieurement autorisé. Les 36 Go libres sont compatibles avec un démarrage modeste, pas une politique illimitée de builds/sauvegardes. Aucun prune ou nettoyage de volumes effectué.

## Sécurité : acquis et risques

- API publiée sur loopback seulement, port hôte prévu 3101 ; PostgreSQL/Redis sans port publié dans le Compose de production. Projet/volumes dédiés. Secrets PostgreSQL/Redis distincts et authentification Redis vérifiée : `NOAUTH` sans mot de passe.
- API non-root, capabilities retirées, `no-new-privileges`, logs avec rotation. Le build exclut `.env*`, clés et dossiers sensibles du contexte. Les secrets de test sont privés dans `/private/tmp/revynora-audit.env`, mode 0600, jamais affichés.
- CORS exact Web/Admin, credentials explicites, protection CSRF par en-tête non simple et origine. Cookies Secure/HttpOnly/SameSite=Lax sans Domain. Proxy Next sur la même origine pour préserver cookies et SSR. Les tests locaux ne remplacent pas la recette réelle du proxy Vercel.
- Nginx écrase `X-Forwarded-For` et l’API fait confiance à un saut. Les utilisateurs Web peuvent partager l’IP d’egress Vercel et donc les limites d’authentification. Vérifier en charge ; ne pas accepter arbitrairement un en-tête IP entrant.
- CSP présente, mais `script-src` autorise encore `unsafe-inline` et `unsafe-eval` : protection XSS affaiblie, durcissement par nonce à planifier. Documentation OpenAPI publique. Readiness vérifie PostgreSQL, pas Redis ni le traitement des rappels.
- Le compte PostgreSQL applicatif est celui créé par l’image, donc superutilisateur de la base dédiée ; séparer les rôles applicatif/migration est une amélioration de moindre privilège. Aucun compte PostgreSQL existant modifié.
- Redis est limité à 128 Mo logiques et 256 Mio de conteneur : surveiller AOF/réécriture/OOM. Sauvegarde fournie pour PostgreSQL, pas pour Redis ; l’outbox PostgreSQL permet certaines reprises mais n’équivaut pas à une recette de perte Redis.
- Paiement `mock`, IA `mock` et mail `local` sont les valeurs préparées : **pilote de validation uniquement**. Les confirmations de paiement simulées ne prouvent aucun paiement. Pas de lancement commercial ainsi configuré. SMTP réel et secrets OpenAI/Stripe ne sont pas validés ; MFA Admin absent.

`pnpm audit --prod --json` retourne **41 avis : 20 high, 19 moderate, 2 low, 0 critical**, sur 823 dépendances déclarées production du monorepo. Il ne s’agit pas de 41 failles exploitables démontrées dans l’API. Les chemins API incluent notamment Multer 2.0.2, Nodemailer 7.0.10, Nest Core 11.1.8, path-to-regexp 8.3.0, ainsi que des dépendances de l’outillage Prisma. Aucun endpoint Multer/SSE n’est déclaré dans les contrôleurs examinés ; les champs email sont validés/bornés et le mail est local dans le candidat. Cela réduit certains chemins d’exposition sans constituer une preuve d’innocuité. Les avis doivent être triés, les chemins atteignables corrigés et les mises à jour retestées avant ouverture publique ; pas de mise à jour majeure globale ni d’override transitif non validé pendant cet audit. Résultat détaillé conservé dans `/private/tmp/revynora-dependency-audit.json`.

Risques d’exploitation restants : certificats/DNS/pare-feu Oracle non testés, renouvellement et configuration Nginx globale non validés sur l’hôte, impact réseau/iptables de l’installation Docker à revoir, sauvegardes chiffrées hors VM/rétention/alertes absentes de la recette, permissions systemd à installer et tester. La liste d’archive seule dans `backup.sh` ne remplace pas une restauration régulièrement exécutée. Le test de restauration ici est local et n’a pas installé les timers.

## Choix Docker Compose ou PM2

**Conserver Docker Compose**, déjà préparé et désormais vérifié sur ARM64 : runtime non-root reproductible, dépendances OpenSSL/Prisma embarquées, PostgreSQL/Redis isolés, volumes et réseau dédiés, ressources/logs bornés, pas de modification du PostgreSQL hôte ni des processus PM2 existants. Réutiliser le Nginx hôte pour le seul nouveau site et le port loopback 3101.

PM2 économiserait une partie de l’outillage Docker, mais exigerait une nouvelle procédure Node/pnpm/Prisma/migrations, l’isolation Redis et un choix PostgreSQL ; il ne résout ni la contrainte CPU ni les exigences de sauvegarde/sécurité. Aucun bénéfice mesuré ne justifie ce changement d’architecture à ce stade. Si la capacité disponible mesurée est insuffisante, refuser le déploiement ou augmenter la capacité plutôt que déplacer Revynora dans les bases/services des autres applications.

Références : [contraintes Docker](https://docs.docker.com/engine/containers/resource_constraints/), [services Compose](https://docs.docker.com/reference/compose-file/services/), [Prisma dans Docker](https://www.prisma.io/docs/guides/deployment/docker), [plateformes Prisma 6](https://docs.prisma.io/docs/orm/v6/reference/system-requirements).

## Checklist GO / NO-GO

- [x] Branche et commit ciblés identifiés ; état initial préservé ; aucune fusion/push.
- [x] Builds locaux sans cache, lint, TypeScript, tests unitaires/intégration/E2E réussis.
- [x] API ARM64, Prisma, migrations neuves/idempotentes, catalogue et restauration locale validés.
- [x] Cookies/CORS/CSRF/permissions contrôlés localement ; Nginx 1.24 syntaxiquement valide.
- [ ] Relever sur Oracle, après autorisation séparée, mémoire disponible, charge CPU/disque, swap, services et disponibilité actuelle de 3101 ; confirmer l’absence de collisions projet/volumes/sites.
- [ ] Valider la marge pour Gmilli/AAFPN et PostgreSQL hôte, sous charge et pendant une migration ; images ARM64 préconstruites de préférence.
- [ ] Trier les avis de sécurité, corriger les chemins exposés et revalider avant ouverture publique.
- [ ] Créer les secrets réels en privé, permissions 0600, configuration vérifiée et images taguées par SHA ; aucune clé dans Vercel ou variable publique mobile.
- [ ] Installer Docker uniquement après approbation distante séparée ; revoir les règles réseau sans modifier les applications existantes.
- [ ] Déployer uniquement dans un nouvel espace dédié ; vérifier la cible de migration, sauvegarder si cette base Revynora contient déjà des données.
- [ ] Configurer uniquement les domaines/sites Revynora, TLS, renouvellement, DNS, projets Vercel et variables HTTPS ; tester cookies/SSR/Admin à travers Vercel.
- [ ] Tester sauvegarde/restauration réelle et copie hors VM, rétention et alertes ; prévoir rollback des images sans migration inverse implicite.
- [ ] Pour ouverture commerciale : remplacer les simulations par des intégrations validées, sécuriser l’Admin et valider les exigences de données/rétention.
- [ ] Pour mobile distribué : EAS/signature et tests Android/iPhone réels. L’export Expo réussi ne produit ni APK ni IPA.

## Fichiers modifiés

- `infra/production/Dockerfile.api` : cache Corepack partagé.
- `.github/workflows/backend.yml` : build migration et contrôle pnpm sans réseau.
- `apps/mobile/tests/secure-store.test.ts` : formatage.
- `docs/phase4/DEPLOIEMENT.md` : contexte Oracle fourni et renvoi à cet audit, garde-fou de capacité/build.
- `docs/phase4/AUDIT-AVANT-DEPLOIEMENT.md` : présent rapport.

Les journaux détaillés locaux sont sous `/private/tmp/revynora-*.log` ; ils ne sont pas ajoutés au dépôt. Les ressources Docker d’audit sont nommées `revynora-audit-*`, indépendantes de tout projet existant. Les cinq conteneurs locaux créés pour cet audit ont été arrêtés après les sondes finales. Les volumes du projet Compose sont conservés ; une sauvegarde privée des bases E2E éphémères a été écrite avant leur arrêt. Aucun volume supprimé.
