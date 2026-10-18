# Plan de déploiement progressif — à valider avant toute intervention distante

Aucune commande de déploiement de ce document n’a été exécutée sur Oracle, Vercel ou EAS. Le dernier contexte fourni par l’utilisateur est : Ubuntu 24.04 ARM64, 1 CPU, 5,8 Gio de RAM, 36 Go disponibles, Nginx 1.24, PostgreSQL 16 et applications Gmilli/AAFPN existantes ; ports 3000/3001 occupés, 3101 libre. Ces informations ne remplacent pas une mesure de capacité disponible sous charge. Aucun accès distant n’a été effectué pendant le nouvel [audit avant déploiement](AUDIT-AVANT-DEPLOIEMENT.md), qui remplace les constats locaux antérieurs. L’[audit initial](AUDIT.md) conserve les limitations d’accès observées à sa date.

## Architecture préparée

- Web Next sur Vercel : `https://revynora.watercode.dev`, projet utilisateur `revynora`, racine `apps/web`.
- Admin Next indépendant sur Vercel : `https://admin.revynora.watercode.dev`, racine `apps/admin`, nom proposé `revynora-admin` à vérifier/créer après accord.
- API Nest : `https://api.revynora.watercode.dev/api/v1`, Nginx existant de la VM Ubuntu 24.04 → `127.0.0.1:3101` → conteneur API 3001 non-root.
- PostgreSQL et Redis dédiés au projet Compose `revynora-prod`, volumes préfixés automatiquement par ce nom, réseau interne sans port public. API sur un réseau d’egress distinct pour OpenAI/Stripe/SMTP si configurés.
- Mobile Expo : API centrale HTTPS, session bearer opaque dans SecureStore ; aucune connexion directe PostgreSQL ni duplication du métier. Les clients Next conservent leurs cookies HttpOnly par leur proxy `/api/v1`.

Ces adresses sont des **cibles prévues**, pas des endpoints de production validés. Le premier déploiement doit être une validation non commerciale : l’adaptateur de paiement existant ne prend en charge que la simulation/Stripe test. Les clés live ne sont pas ajoutées dans cette phase.

## 1. Débloquer puis compléter l’audit en lecture seule

L’utilisateur doit tester sa connexion SSH dans son propre terminal, sans transmettre de clé :

```sh
ssh gmilli-oracle
```

Après rétablissement de l’accès, exécuter uniquement l’audit convenu :

```sh
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes gmilli-oracle sh -s < infra/production/audit-readonly.sh
```

Le script n’utilise pas sudo, ne lit pas les `.env`, n’affiche pas `docker inspect` ou `nginx -T`, et n’écrit aucun fichier distant. Il rapporte CPU/RAM/disques/ports/services, conteneurs et noms des sites Nginx. Vérifier également les sauvegardes existantes et l’organisation des applications avec leur propriétaire avant tout changement.

Le budget maximal proposé pour Revynora est 768 Mio API, 1024 Mio PostgreSQL et 256 Mio Redis, avec limites CPU. Ce ne sont pas des réservations ni une preuve que la VM peut les accueillir. Préserver une marge pour le système et les autres projets ; adapter ou refuser le déploiement si la capacité est insuffisante. Confirmer que 3101 est libre, que les noms de site/conteneurs/volumes ne sont pas déjà utilisés, et relever l’architecture CPU. Le build local ne prouve pas la compatibilité de l’architecture distante ; construire sur la VM ou pour sa plateforme vérifiée.

**Point de validation utilisateur :** présenter cet inventaire et les chemins/ports retenus avant toute installation, copie de fichier, changement DNS, migration ou redémarrage.

Sur la VM partagée à un seul cœur, privilégier des images ARM64 préconstruites et testées hors de la VM. Les limites des services ne limitent pas le build ni le conteneur de migration ; les exécuter sans marge mesurée peut perturber les autres applications. Le cache Corepack partagé est requis pour que les migrations non-root fonctionnent sur le réseau privé sans téléchargement de pnpm.

## 2. Préparer la version et les secrets après validation

`main` est encore au commit Phase 2 ; la branche `feature/phase-4-deployment-mobile` contient les phases 2.5/3/4 préparées. Ne pas déployer main avant revue et fusion explicitement autorisée. Le remote réel est `github.com/Beehnood/Revynora.git` (vérifier cette orthographe dans Vercel).

Choisir `/opt/revynora` uniquement s’il est libre et validé ; ne pas réutiliser le dossier d’un autre projet. Conserver une version immuable par SHA et son image précédente. Copier `infra/production/env.example` vers le fichier privé `infra/production/.env.production`, permissions 0600 ; générer **deux** secrets hex différents avec `openssl rand -hex 32`. Aucun secret dans Git, arguments publics de CLI, captures ou chat. Les clés de fournisseurs se règlent exclusivement dans ce fichier/gestionnaire de secrets.

Depuis le dossier de la version revue, commandes proposées après accord :

```sh
node infra/production/validate-config.mjs infra/production/.env.production
docker compose --env-file infra/production/.env.production -f infra/production/compose.yaml config --quiet
docker compose --env-file infra/production/.env.production -f infra/production/compose.yaml build api migrate
```

Ne pas exécuter `docker compose config` sans `--quiet` dans des logs publics : il développe les secrets. Aucun `docker system prune`, `down -v`, `db push`, `migrate reset` ou suppression de volume n’est prévu.

## 3. Base et API, sans exposition publique initiale

```sh
docker compose --env-file infra/production/.env.production -f infra/production/compose.yaml up -d postgres redis
# Sur une base Revynora déjà existante : sauvegarde vérifiée avant toute migration.
# Sur une base neuve : vérifier à nouveau qu’il s’agit de celle du projet Revynora.
docker compose --env-file infra/production/.env.production -f infra/production/compose.yaml run --rm migrate
docker compose --env-file infra/production/.env.production -f infra/production/compose.yaml run --rm migrate pnpm db:catalog
docker compose --env-file infra/production/.env.production -f infra/production/compose.yaml up -d api
curl --fail http://127.0.0.1:3101/api/v1/health/ready
```

Le service migrate est un outil explicite, pas une commande de démarrage automatique. Les huit migrations existantes sont conservées et cette phase n’ajoute aucune migration. Ne jamais pointer DATABASE_URL vers une base d’un autre projet. db:catalog crée uniquement les trois offres manquantes, sans écraser les prix déjà configurés et sans créer de compte, période active ou paiement. Le seed de démonstration n’est pas exécuté. Les identifiants Stripe test restent à configurer selon la procédure existante avant leur utilisation.

L’API écoute 0.0.0.0 **dans le conteneur** ; Docker ne publie que sur loopback. Le mode Node production exige COOKIE_SECURE=true et des origines HTTPS explicites. Le proxy Nginx écrase X-Forwarded-For et l’API ne fait confiance qu’à ce saut. Les authentifications gardent leur limitation côté Nest, complétée par Nginx. Avec un proxy Vercel, des utilisateurs peuvent partager une IP d’egress : vérifier les limites en charge avant une ouverture large, sans faire confiance à des en-têtes publics non vérifiés.

## 4. DNS et TLS du seul nouveau site API

Dans la zone Namecheap `watercode.dev`, préparer uniquement :

| Type  | Hôte relatif     | Cible                                           |
| ----- | ---------------- | ----------------------------------------------- |
| A     | `api.revynora`   | IPv4 de la VM Oracle confirmée par l’audit      |
| CNAME | `revynora`       | Cible exacte fournie par le projet Vercel Web   |
| CNAME | `admin.revynora` | Cible exacte fournie par le projet Vercel Admin |

Ne pas modifier les enregistrements `@`, `www`, MX/TXT ou ceux des autres projets. Ne pas inventer une valeur générique CNAME si Vercel fournit une cible spécifique. Aucun DNS modifié pendant cette préparation.

Réutiliser le Nginx hôte existant ; ne pas installer un conteneur Nginx qui accaparerait les ports 80/443. Préparer des fichiers **nouveaux** uniquement : site `revynora-api`, snippet `revynora-proxy.conf`, zone `revynora-rate-limits.conf`. Si un nom existe déjà, arrêter et comparer avant toute écriture. Ne jamais remplacer nginx.conf ni désactiver un autre site.

1. Installer d’abord le site HTTP `revynora-api.http.conf` pour le seul challenge ACME, répertoire `/var/www/revynora-acme`.
2. Tester `sudo nginx -t`, puis recharger seulement après validation du test.
3. Obtenir un certificat nommé uniquement Revynora (adresse e-mail réelle à renseigner localement) :

```sh
sudo certbot certonly --webroot -w /var/www/revynora-acme --cert-name revynora-api -d api.revynora.watercode.dev
```

4. Installer la variante TLS `revynora-api.conf`, son snippet et ses zones, tester Nginx puis recharger. Aucun plugin `certbot --nginx` susceptible de réécrire les sites existants n’est utilisé.
5. Vérifier le renouvellement automatique existant et `certbot renew --dry-run` après revue des certificats concernés. Ne pas modifier globalement le pare-feu ou les règles Oracle ; contrôler les accès 80/443 existants et garder PostgreSQL/Redis/3101 privés.

## 5. Vercel, deux applications indépendantes

Les configurations `apps/web/vercel.json` et `apps/admin/vercel.json` utilisent Next.js, `pnpm install --frozen-lockfile` à la racine, puis `pnpm build:web` ou `pnpm build:admin`. Autoriser l’accès aux fichiers hors du Root Directory pour les packages partagés. Le résultat est `.next` dans chaque application.

Variables par projet, réglées avant build :

| Variable               | Web                                    | Admin              |
| ---------------------- | -------------------------------------- | ------------------ |
| API_URL                | `https://api.revynora.watercode.dev`   | idem               |
| ADMIN_ORIGIN           | `https://admin.revynora.watercode.dev` | idem si nécessaire |
| NEXT_PUBLIC_WEB_ORIGIN | `https://revynora.watercode.dev`       | idem               |
| Node.js                | 22                                     | 22                 |

Ni DATABASE_URL ni clé OpenAI/Stripe/SMTP n’a sa place dans Vercel ou une variable publique de ces clients. Le navigateur appelle `/api/v1` sur sa propre origine ; le proxy envoie vers l’API HTTPS. Les cookies sans Domain restent attachés au bon frontend ; chaque application possède sa connexion, les routes SSR transmettent la session à l’API. L’Admin exige toujours un rôle ADMIN et n’est pas protégé uniquement par une URL cachée.

Les déploiements Git automatiques sont désactivés dans les configurations de préparation (`git.deploymentEnabled=false`, également à la racine de secours). Aucun push de cette branche ne doit être utilisé pour publier. Après validation explicite, connecter les CLI localement, vérifier les projets et leur Root Directory, puis un déploiement manuel pourra être demandé :

```sh
# Authentification interactive locale, jamais de token dans la conversation :
pnpm dlx vercel@64.5.0 login
# Après accord et liaison aux projets corrects :
# depuis apps/web, puis apps/admin, séparément :
pnpm dlx vercel@64.5.0 link
pnpm dlx vercel@64.5.0 deploy --prod
```

Ces commandes distantes ne sont pas exécutées. Vérifier les erreurs API et redirections, création/connexion/déconnexion, cookies Secure/HttpOnly, expiration, refus étudiant sur Admin et reprise après réseau coupé. Les previews ne sont pas ajoutées à une CORS wildcard : utiliser un environnement de validation séparé avec ses origines explicites et sa propre base.

## 6. Sauvegarde, restauration, supervision et retour arrière

`backup.sh` cible uniquement le PostgreSQL du Compose Revynora. Définir `REVYNORA_BACKUP_DIR` vers un stockage approuvé et protégé/chiffré, existant, puis lancer une sauvegarde ; pg_dump custom, permissions 0600, vérification de l’archive et checksum. Le timer systemd proposé lance une sauvegarde quotidienne. Prévoir copie chiffrée hors VM et politique de conservation validée ; aucune suppression automatique n’est codée.

```sh
# Dans infra/production, après installation autorisée et création du dossier privé :
REVYNORA_BACKUP_DIR=/var/backups/revynora sh backup.sh
sh restore-check.sh /var/backups/revynora/REVYNORA_ARCHIVE.dump revynora_restore_VALIDATION
```

restore-check crée une **nouvelle** base dont le nom commence par revynora*restore*, refuse d’écraser une base existante et ne restaure jamais dans revynora. Il conserve cette base de validation pour revue. Une bascule de restauration sur la base active demande un plan et une autorisation séparés.

Les journaux Docker tournent à 10 Mio × 3 par service. Vérifier que la rotation Nginx existante couvre les nouveaux fichiers revynora-api.\*.log ; ne pas dupliquer un stanza déjà couvert. Les timers fournis contrôlent `/health/ready` chaque minute et signalent les échecs dans systemd/journal ; aucun service d’alerte externe n’est inventé. Vérifier espace disque, âge/checksum des sauvegardes, mémoire/OOM, états PostgreSQL/Redis, erreurs API et expiration TLS.

Rollback applicatif : conserver l’image et le SHA précédents, revenir uniquement au tag API précédent et aux versions Next précédentes après revue. Cette phase ne change pas le schéma ; ne pas exécuter de migration inverse ou restaurer les données sans nouvelle validation. Aucune commande ne touche aux autres projets Docker/Nginx de la VM.

Références officielles consultées : [Turborepo/Vercel](https://vercel.com/docs/monorepos/turborepo), [désactivation Git](https://vercel.com/docs/project-configuration/git-configuration). Les configurations n’équivalent pas à une recette distante de production.
