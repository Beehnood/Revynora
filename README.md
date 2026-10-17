# Revynora · Monorepo modulaire — Phase 2.5

Phases 0, 1 et 2 conservées ; séparation structurelle Phase 2.5, d’après les PDF et les références UI/UX fournis. Projet **local uniquement** : aucun hébergement ni déploiement ; paiements simulés ou Stripe test uniquement. L’identité livre ouvert et les tokens violets sont conservés.

## Lancer l’application

Prérequis : Node 22 LTS (Node 24 accepté), pnpm 10.18.3, Docker Desktop démarré.

```sh
pnpm install --frozen-lockfile
cp .env.example .env # uniquement si .env n’existe pas déjà
# Ne remplacez pas un .env contenant votre configuration.
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Accueil : http://localhost:3000
- Créer un compte FREE : http://localhost:3000/inscription
- Connexion : http://localhost:3000/connexion
- Espace protégé : http://localhost:3000/app
- Design system et assets : http://localhost:3000/design-system
- Abonnement et paiements de test : http://localhost:3000/app/abonnement
- Révisions Leitner (Plus/Pro) : http://localhost:3000/app/revisions
- Planning (Pro) : http://localhost:3000/app/planning
- Notifications et consentement : http://localhost:3000/app/notifications
- Administration indépendante : http://localhost:3002 (ancienne URL `/admin` conservée comme pont)
- OpenAPI interactif : http://localhost:3001/api/v1/docs
- Contrat JSON : http://localhost:3001/api/v1/openapi.json
- Santé : http://localhost:3001/api/v1/health et `/api/v1/health/ready`

Les serveurs doivent rester lancés pour que ces URL locales répondent. Utiliser le même hôte (localhost ou 127.0.0.1) pendant la connexion : les cookies appartiennent à cet hôte. PostgreSQL utilise le port **5433**, le port 5432 étant déjà occupé sur la machine initiale. Redis utilise 6380. Leurs volumes nommés persistent. `docker compose stop` arrête sans effacer les données.

## Applications indépendantes

`pnpm dev` démarre Web, API et Admin. Le socle Expo est lancé séparément ; aucune fonctionnalité Phase 3 n’est développée.

| Application   | Développement     | Build filtré        | Adresse locale                    |
| ------------- | ----------------- | ------------------- | --------------------------------- |
| Étudiant Next | `pnpm dev:web`    | `pnpm build:web`    | http://localhost:3000             |
| API Nest      | `pnpm dev:api`    | `pnpm build:api`    | http://localhost:3001/api/v1/docs |
| Admin Next    | `pnpm dev:admin`  | `pnpm build:admin`  | http://localhost:3002             |
| Socle Expo    | `pnpm dev:mobile` | `pnpm build:mobile` | Metro sur 8081                    |

Les scripts filtrés construisent les packages nécessaires via Turbo. Pour utiliser une application seule, démarrer aussi l’API centrale ou configurer son URL distante. Les variables `API_URL`, `ADMIN_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN` et `EXPO_PUBLIC_API_URL` sont décrites dans [.env.example](.env.example) et les README des applications. Fixer API_URL avant un build Next. Ne jamais copier de secrets serveur dans une variable publique Mobile/Web.

La Phase 2.5 ne modifie ni Prisma ni ses migrations et ne réinitialise aucune base. Les commandes db:migrate du guide d’installation appliquent uniquement les migrations déjà présentes, à utiliser pour une première installation ou des migrations existantes préalablement vérifiées. Aucun déploiement n’est lancé.

[Audit et bilan de réorganisation](docs/phase2.5/AUDIT.md) · [ADR 007](docs/adr/007-four-independent-apps.md) · [Admin](apps/admin/README.md) · [Mobile](apps/mobile/README.md) · [Client API](packages/api-client/README.md)

## Parcours livré

Créer un compte (mot de passe de 12 caractères minimum), choisir domaine/sujet/niveau, préparer cinq questions, sélectionner puis enregistrer ses réponses, confirmer la soumission, lire le score et les justifications, retrouver le mini-cours et l’historique. Une tentative sauvegardée se reprend après rechargement ou reconnexion. Le score et les droits sont calculés côté API. Les solutions et le cours généré sont cachés avant soumission.

Le tableau de bord affiche les résultats réels du compte connecté : tests terminés, dernier score, moyenne sur les dix derniers tests et notions faibles du dernier test. Les cours personnels sont privés ; seules les ressources éditoriales explicitement ADMIN sont partagées. L’historique et les cours sont paginés.

## Fournisseur IA

Par défaut, `AI_PROVIDER=mock` : **aucun appel IA**, trois banques d’exercices débutants (cellules, fractions, présent simple), clairement étiquetées. Ce mode permet de tester le parcours sans clé ni frais. Un sujet non pris en charge est refusé, jamais remplacé silencieusement.

Pour activer des générations réelles, renseigner uniquement dans `.env` côté serveur :

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=votre_cle_personnelle
OPENAI_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=10
AI_TIMEOUT_MS=20000
AI_MAX_ATTEMPTS=2
```

Redémarrer `pnpm dev`. La clé n’est jamais exposée au navigateur. Aucun appel OpenAI réel n’a été exécuté pendant la réalisation. L’adaptateur Responses et ses erreurs sont testés avec des réponses HTTP simulées. La génération structurée est validée par Zod ; sa conformité structurelle ne garantit pas l’exactitude factuelle du contenu. L’interface indique cette limite.

Le quota est renouvelé à 00:00 UTC. Une demande, même échouée, consomme une unité ; ses retries bornés partagent cette unité. Les coûts restent `null` tant que `AI_INPUT_USD_PER_MILLION` et `AI_OUTPUT_USD_PER_MILLION` ne sont pas définis. Les traces AIUsage ne stockent ni prompt ni données d’authentification.

## Tests et couverture

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test                 # unitaires : aucun serveur nécessaire
pnpm test:integration     # prépare revynora_test, tests API/DB
pnpm test:coverage        # couverture Web + API avec intégration
pnpm build
pnpm --filter @revynora/web exec playwright install chromium
pnpm test:e2e
```

`pnpm test:prepare` crée si nécessaire **revynora_test** et y applique les migrations sans modifier la base applicative. Le rôle local doit pouvoir créer une base. Un `TEST_DATABASE_URL` personnalisé doit pointer vers ce nom dédié. Les tests d’intégration utilisent un serveur HTTP éphémère et nettoient uniquement leurs utilisateurs. Playwright démarre l’API compilée sur 3001 avec cette base et Next sur 3000 ; arrêter `pnpm dev` avant cette recette. Un serveur existant n’est pas réutilisé afin de ne pas tester ou modifier une session réelle par erreur.

La commande équivalente demandée par le PDF est `pnpm --filter @revynora/web exec playwright test`, après `pnpm test:prepare` et `pnpm build` ; le nom réel du workspace est `@revynora/web`. Les traces sont conservées en cas d’échec. La recette couvre 320, 375, 768 et 1280 px, navigation clavier et contrôles axe A/AA. Les captures sont enregistrées dans `docs/phase1` et `docs/phase2` à 375 et 1280 px. Les comptes Playwright préfixés `e2e-phase1-` ou `e2e-phase2-` sont nettoyés uniquement dans revynora_test.

Rapports : `apps/web/coverage/index.html`, `apps/api/coverage/integration/index.html`, `apps/web/playwright-report/index.html`. La portée et les résultats exacts sont décrits dans [la recette Phase 2](docs/phase2/RECETTE.md). [La recette Phase 1](docs/phase1/RECETTE.md) est conservée comme historique. Le [rapport Phase 0](docs/RECETTE.md) reste un historique de cette phase et ne décrit pas les fonctionnalités actuelles.

## Architecture et sécurité

Monorepo pnpm/Turborepo : `apps/web` (Next App Router, Tailwind, composants shadcn), `apps/api` (Nest modulaire Auth/Learning/AI/Health), `packages/types`, `packages/validation`, `packages/config`, `prisma`, `infra/docker`, `docs` et `.github/workflows`. TypeScript strict. Le workspace mobile contient uniquement le socle Expo et son écran d’attente ; les parcours natifs appartiennent à la Phase 3.

Sessions opaques en cookie HttpOnly/SameSite=Lax, hash du jeton en DB, mots de passe scrypt salés et versionnés. Validation Zod stricte, guards de session, rôle et droits calculés depuis les périodes actives, contrôle de propriété, erreurs `{code,message,details?,requestId}`, limitation des tentatives d’authentification et quotas IA transactionnels. Les mutations requièrent `X-Revynora-Client: web` et une origine autorisée ; le Web appelle le proxy même origine `/api/v1`. La soumission et la sauvegarde sont sérialisées en DB : double soumission identique, modification tardive refusée.

`.env` est ignoré ; `.env.example` contient seulement des valeurs de développement. `COOKIE_SECURE=false` est réservé au HTTP local. L’administration exige un compte ADMIN ; les étudiants reçoivent un refus côté API. Vérification d’e-mail et récupération de mot de passe ne sont pas disponibles dans ce MVP local. Les pages privées sont désindexées et contrôlées par session ; une panne affiche un état d’erreur plutôt que des données fictives.

Décisions : [authentification](docs/adr/004-auth-sessions.md), [IA et pédagogie](docs/adr/005-ia-pedagogie.md), [plan des tickets](docs/phase1/PLAN.md), [design system](docs/ui/design-system.md). Le pipeline GitHub Actions exécute les vérifications avec PostgreSQL et Redis et publie les rapports de tests en artefacts ; son exécution distante reste à constater après envoi du code.

Hors périmètre : paiements réels, essai gratuit, prorata, fiscalité automatisée, application Expo et chat illimité. À la demande de l’utilisateur, chaque fin de phase comprend désormais un commit et un push des livrables vérifiés, selon [le workflow de livraison](docs/WORKFLOW.md). Cela ne constitue pas un déploiement.

## Phase 2 : facturation, rappels et administration

Les tarifs sont fixes : Free 0 €, Plus 2,50 €/mois (Leitner), Pro 5 €/mois (Leitner + planning/rappels). Par défaut `BILLING_PROVIDER=mock` : le checkout annonce une **simulation**, permet acceptation/refus et traverse le même traitement de webhook signé que l’adaptateur Stripe. Aucun débit réel. Les droits ne proviennent jamais de `User.plan` ni du retour du navigateur. Une annulation à échéance garde les droits jusqu’à la fin de période ; un changement Plus/Pro est différé, sans prorata. Les simulations ne renouvellent pas automatiquement les périodes.

Pour Stripe test, renseigner uniquement dans `.env` : `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, `STRIPE_PRICE_PLUS=price_…`, `STRIPE_PRICE_PRO=price_…`. Les prix doivent être récurrents mensuels, EUR, 250/500 centimes. Relayer les événements avec Stripe CLI :

```sh
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
```

Reporter le secret affiché par Stripe CLI dans `.env`, puis redémarrer l’API. Le portail est configuré pour les factures, moyens de paiement et résiliation à échéance. Le changement d’offre utilise une subscription schedule. Les clés/événements live sont refusés. **Aucun appel à un compte Stripe n’a été exécuté pendant la recette** : l’adaptateur SDK est testé avec des réponses simulées et des signatures réelles. La recette distante reste à effectuer avec votre compte de test.

`WORKER_ENABLED=true` par défaut démarre BullMQ avec `REDIS_URL=redis://127.0.0.1:6380`. L’outbox PostgreSQL est rebalayée toutes les 15 secondes ; une panne Redis conserve les rappels à traiter. Les tâches reportées/annulées invalident leur ancien rappel. Le worker revérifie consentement, offre Pro, version, état et date avant livraison. Un job tardif après le début de séance est abandonné. Les dates ambiguës ou inexistantes lors des changements d’heure sont refusées.

`MAIL_PROVIDER=local` garde les messages dans `/app/notifications`, sans envoi externe. `QUEUED` signifie en attente du worker ; `SENT` en mode local signifie enregistré dans cette boîte. Pour un SMTP de test, configurer `MAIL_PROVIDER=smtp`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` et, si nécessaire, `SMTP_USER`/`SMTP_PASSWORD`. Un envoi échoué est réessayé au maximum cinq fois. SMTP ne garantit pas une livraison exactement une fois après une coupure entre acceptation distante et validation locale ; le Message-ID reste stable. Aucun envoi SMTP réel n’a été exécuté.

Aucun compte administrateur ni mot de passe connu n’est fourni. Créer son compte, puis attribuer le rôle explicitement :

```sh
pnpm admin:promote votre-compte@exemple.fr --confirm
```

La commande révoque les sessions existantes et journalise l’attribution. Se reconnecter ensuite. Les informations légales publiques, durées de conservation et validations Stripe/SMTP distantes restent à compléter avant une ouverture publique. Cela ne bloque pas la recette locale demandée.
