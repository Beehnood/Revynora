# Gemini — adaptation backend et première recette PDF

## État de cette mission

Adaptation locale uniquement, depuis main c119b6c, branche feature/gemini-provider.
Aucun appel d'inférence réel, aucune lecture/utilisation de la clé exposée,
aucune nouvelle clé créée, aucun push ou déploiement. Les modifications locales
préexistantes du checkout principal, notamment .env.example, sont préservées.
La révocation de la clé exposée n'est pas effectuée par ce code : elle relève du
compte Google du propriétaire et doit être confirmée avant toute recette réelle.

## Adaptateur

AI_PROVIDER accepte mock, openai et gemini. OpenAI et sa validation restent en
place ; aucun fallback automatique entre fournisseurs. Gemini utilise fetch
sur l'hôte fixe generativelanguage.googleapis.com, méthode REST generateContent,
avec x-goog-api-key dans les en-têtes uniquement, jamais dans l'URL ou les logs.
Aucun SDK ou changement de dépendances requis.

Les redirections HTTP sont refusées pour ne pas transférer la clé à un autre hôte.
Le backend réutilise le schéma Zod des quiz et le schéma d'analyse PDF existant,
ainsi que validateAnalysis : chaque citation doit apparaître sur la page source
annoncée, après normalisation des espaces. Les documents sont des données non
fiables séparées des instructions système. Aucun outil, recherche Google,
fichier distant, function calling ou cache explicite n'est activé.

Sortie JSON bornée à 5 000 tokens pour les diagnostics, 7 000 pour les PDF ;
réponse reçue limitée à 150 000 caractères, timeout AI*TIMEOUT_MS existant.
Les réponses refusées, tronquées, incomplètes, mal formées ou sans citation exacte
échouent explicitement. Aucun faux contenu n'est fabriqué en cas d'erreur.
Les erreurs n'incluent ni corps fournisseur ni clé. Les compteurs de tokens
Gemini incluent les thoughts dans la sortie et alimentent le journal existant
pour les diagnostics. Aucune gratuité facturée à zéro n'est présumée par le code.
Les prix génériques AI*\*\_USD_PER_MILLION, si renseignés, doivent correspondre au
fournisseur choisi ; sinon l'estimation reste null.

Le transport ne réessaie pas. Les diagnostics conservent le mécanisme existant
AI_MAX_ATTEMPTS ; le parcours PDF conserve une seule requête par action explicite,
son quota FREE atomique et ses limites de reprise. Aucune migration ou modification
des abonnements, prix, contrats, permissions ou protections G.8/G.9.

## Modèle et éligibilité — vérifiés le 6 novembre 2026

Défaut : gemini-3.8-flash. La documentation Google actuelle propose le niveau
gratuit pour ses entrées/sorties et des sorties structurées JSON. Utiliser le nom court explicite du modèle préparé, pas un alias non vérifié.

**Le modèle ne prouve pas le niveau du projet.** Le propriétaire doit confirmer
le projet associé à la nouvelle clé, son accès au modèle et son niveau Free Tier
dans AI Studio. Ne pas activer de facturation pour contourner une erreur de
niveau gratuit. Sur le niveau gratuit, Google indique que les données peuvent
servir à améliorer ses produits : utiliser uniquement un cours synthétique ou
public autorisé, jamais un document personnel pour cette recette.

Sources officielles :

- [Tarification Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash).
- [Sorties structurées](https://ai.google.dev/gemini-api/docs/structured-output).
- [Contrat REST generateContent](https://ai.google.dev/api/generate-content).
- [API Interactions et maintien de generateContent](https://ai.google.dev/gemini-api/docs/interactions).
- [Gestion des clés compromises](https://ai.google.dev/gemini-api/docs/api-key).

## Clé exposée — action préalable du propriétaire

1. Ouvrir [AI Studio → API Keys](https://aistudio.google.com/api-keys) et sélectionner
   le projet de développement concerné. Identifier l'ancienne clé par son nom/ID,
   sans copier sa valeur dans un message ou une capture.
2. Désactiver/supprimer la clé exposée dans
   [Google Cloud → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
   Ne jamais la réutiliser pour un test de refus. Vérifier la révocation dans la
   console ; vérifier aussi les éventuelles restrictions de la nouvelle clé sur
   la seule API Generative Language requise par le backend.
3. Utiliser uniquement la nouvelle clé déjà créée, dans apps/api/.env.local
   (ignoré par Git et Docker, chargé uniquement par l’API). Ne jamais la mettre dans .env.example, un commit,
   une variable `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*`, Vercel ou le chat. Ne pas importer
   aveuglément le .env du checkout principal dans ce worktree.
4. Confirmer explicitement à l'agent : ancienne clé révoquée, nouvelle clé privée
   configurée et projet Free Tier vérifié. Sans cette confirmation, aucun appel
   réel n'est autorisé. Aucun quota fournisseur n'est consommé pour vérifier cela.

## Configuration préparée — ne pas lancer d'analyse avant confirmation

Depuis la racine du checkout Gemini, préparer deux fichiers s'ils n'existent
pas déjà :

```bash
test ! -e .env && cp .env.example .env
test ! -e apps/api/.env.local && cp apps/api/.env.example apps/api/.env.local
```

Le fichier partagé .env ne doit contenir aucune vraie clé Gemini. Y définir les
seules connexions et options de test :

```dotenv
DATABASE_URL=postgresql://gemini_test:local_gemini_only@127.0.0.1:55457/revynora_test
TEST_DATABASE_URL=postgresql://gemini_test:local_gemini_only@127.0.0.1:55457/revynora_test
AI_TIMEOUT_MS=60000
AI_MAX_ATTEMPTS=1
WORKER_ENABLED=false
BILLING_PROVIDER=mock
MAIL_PROVIDER=local
WEB_ORIGIN=http://localhost:3000
API_URL=http://127.0.0.1:3001
COOKIE_SECURE=false
```

Dans **apps/api/.env.local seulement**, compléter la nouvelle clé dans l'éditeur,
sans argument shell, cat du fichier, capture ou transmission dans le chat :

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

La ligne GEMINI_API_KEY ci-dessus est volontairement vide. Garder AI_PROVIDER=mock
dans le fichier API tant que la rotation et le niveau gratuit ne sont pas confirmés.
L'API charge d'abord son .env.local privé, puis les valeurs partagées de .env,
sans écraser les variables de processus déjà injectées. Redémarrer l’API après
modification des fichiers privés ; une variable déjà initialisée reste prioritaire.
Next.js ne lit pas ce
fichier API. Ne configurer aucune clé réelle pour les tests automatiques : les
tests Gemini remplacent fetch et utilisent seulement des clés synthétiques.

Turbo transmet GEMINI_API_KEY/GEMINI_MODEL seulement à la tâche dev de l'API ;
aucun ajout aux variables publiques ou au passthrough global Web. La configuration
Production n'est pas modifiée. Le runtime Oracle, si livré ultérieurement, recevra
ces variables côté API uniquement, après autorisation distincte.

## Première analyse réelle — procédure après confirmation seulement

1. Démarrer un PostgreSQL **local dédié**, sans port public ni connexion Oracle.
   Exemple avec l'image 17.6 déjà disponible et des identifiants de test :

   ```bash
   docker run -d --pull=never --name revynora-gemini-test \
     --label revynora.purpose=gemini-rehearsal \
     --publish 127.0.0.1:55457:5432 --memory 512m --cpus 1 \
     --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=268435456 \
     --env POSTGRES_USER=gemini_test --env POSTGRES_PASSWORD=local_gemini_only \
     --env POSTGRES_DB=revynora_test \
     postgres:17.6-alpine postgres -c shared_buffers=32MB
   docker exec revynora-gemini-test pg_isready -U gemini_test -d revynora_test
   ```

   Le stockage est temporaire en mémoire et disparaît à l'arrêt. Ne pas réutiliser
   un nom/port occupé, ne pas supprimer les volumes d'un autre projet et ne pas
   effectuer de prune si Docker manque de place.

2. Vérifier la connexion privée : hôte 127.0.0.1, port 55457, base revynora_test,
   conteneur libellé gemini-rehearsal. Puis `pnpm db:generate` et
   `pnpm test:prepare` : ce dernier applique les migrations et le catalogue
   seulement sur la base de test désignée. Aucune URL Production ne doit être
   présente. Cela ne constitue pas une commande de livraison Oracle.
3. Démarrer `pnpm dev:api` et `pnpm dev:web`, avec worker false et fournisseurs
   de facturation/mail Mock/local. Aucun ADMIN créé ou promu. Dans le navigateur
   local, créer un étudiant de test non sensible uniquement dans cette base.
4. Préparer un PDF texte synthétique de deux pages, avec deux chapitres courts
   (par exemple cellule/membrane puis photosynthèse), définitions et objectifs
   connus, sans JavaScript, pièce jointe, lien actif ou information personnelle.
5. Dans /app/cours, importer ce PDF. L'import seul n'appelle pas Gemini. Contrôler
   le nom, les deux pages et la disponibilité IA ; puis cliquer **une fois** sur
   « Lancer l'analyse IA ». Ne pas lancer de diagnostic thématique en parallèle.
6. Vérifier chapitres, notions, objectifs, résumé et citations exactes sur chacune
   des pages ; vérifier consultation privée et compteur FREE à 1/3. Recharger le
   résultat terminé ne doit pas produire un nouvel appel. Vérifier l'isolation
   avec un second étudiant de test local si nécessaire, sans autre analyse.
7. Supprimer le document : texte/résultat effacés, quota réussi restant à 1/3.
   Les erreurs 401/403/429/refus/JSON invalide sont déjà testées avec HTTP simulé :
   ne pas provoquer d'autres appels réels et ne jamais utiliser la clé compromise.
8. En cas d'échec, arrêter sans cliquer Réessayer. Conserver seulement un bilan
   agrégé, aucun texte intégral, clé, mot de passe ou cookie dans les logs/rapports.
   Vérifier les compteurs agrégés du projet AI Studio ; le résultat PDF ne fournit
   pas encore de compteur de tokens par document. N'inventer ni coût nul mesuré
   ni preuve de Free Tier à partir du seul nom du modèle.

## Validations locales du commit

33 tests ciblés réussis : sélection des trois fournisseurs, schémas, citations PDF,
extraction réelle, erreurs/refus, taille de réponse, absence de clés dans URL/logs,
tokens et journal de quota existant. TypeScript API/Web, ESLint, builds et
vérification du passthrough Turbo : réussis. Aucun changement du lockfile ou du
schéma Prisma, aucune migration exécutée, aucune recette réelle Gemini encore
exécutée. Les appels HTTP sont tous simulés dans les tests de fournisseur ;
l’extraction PDF est réelle sur des octets synthétiques non sensibles.
