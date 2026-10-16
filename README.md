# Revynora · Phase 0

Fondation locale du copilote éducatif, réalisée à partir de `PHASE_0_FONDATION_UI_UX_CODEX.pdf` (16 octobre 2026) et des trois collages UI/UX fournis. Aucun hébergement ni déploiement n’est configuré.

Le dépôt initial était vide. Le document est traité comme cahier des charges de la phase 0 ; son bloc « prompt prêt à coller » n’est pas une autorisation d’étendre le travail. Les maquettes guident l’identité, tandis que le PDF limite les écrans à des prototypes sans données réelles.

## Démarrer

Prérequis : Node 22 LTS (Node 24 accepté), pnpm 10.18.3, Docker Desktop démarré. Installer pnpm si nécessaire avec Corepack : `corepack enable` puis `corepack prepare pnpm@10.18.3 --activate`.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate
pnpm dev
```

- Site : http://localhost:3000
- Démo étudiant : http://localhost:3000/app
- Prototype admin : http://localhost:3000/admin
- Galerie et téléchargements SVG : http://localhost:3000/design-system
- Liveness : http://localhost:3001/api/v1/health
- Readiness PostgreSQL : http://localhost:3001/api/v1/health/ready

PostgreSQL écoute sur `127.0.0.1:5433` pour éviter un conflit constaté avec le port 5432. Les identifiants de Compose sont exclusivement locaux. Le volume `revynora_postgres_data` persiste. `docker compose stop` arrête le service sans effacer les données. La migration est réexécutable par `pnpm db:migrate` ; `pnpm db:check` vérifie la connexion séparément.

## Vérifier

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm --filter @revynora/web exec playwright install chromium
pnpm test:e2e
```

Les tests Playwright démarrent le build Web via `next start` s’il n’y a aucun serveur local existant. Exécuter `pnpm build` avant. Sur Linux CI, installer Chromium avec `--with-deps`. Les rapports sont dans `apps/web/coverage/index.html`, `apps/api/coverage/index.html` et `apps/web/playwright-report/index.html`. Le détail réel de la recette et les limites figurent dans [docs/RECETTE.md](docs/RECETTE.md).

## Organisation

```text
apps/web          Next App Router, Tailwind 4, composants inspirés de shadcn/ui
apps/api          NestJS REST /api/v1, health et readiness
apps/mobile       Conventions uniquement, pas d’application opérationnelle
packages/types    Contrats sans dépendance Prisma
packages/validation Schémas Zod partagés
packages/config   Configuration TypeScript stricte
prisma            Une table technique et sa migration initiale
infra/docker      Documentation de Compose
scripts           Vérification HTTP et génération du sprite SVG
```

`pnpm build` compile d’abord les validations partagées puis Web/API. Le démarrage API compilé s’effectue avec `node apps/api/dist/main.js`. `.env` est lu à la racine par l’API et Prisma ; les variables d’environnement explicites ont priorité. La validation échoue au démarrage si l’URL DB, le port ou l’origine CORS sont invalides. Aucun secret n’est envoyé au Web.

## Périmètre

Landing SSR, navigation responsive et clavier, gabarits étudiant/admin, design system, formulaire local validé sans envoi, logo livre ouvert et sprite de 22 icônes. Les prix sont prévisionnels, les boutons d’achat désactivés et les statistiques remplacées par des états vides. Le symbole et ses déclinaisons se trouvent dans `apps/web/public/brand`.

Pas d’IA, d’authentification, de Stripe, de système Leitner opérationnel, de calendrier fonctionnel, de cours persistés ni d’Expo en phase 0. L’administration est désindexée mais n’est pas protégée par une authentification : elle n’expose aucune donnée réelle. Les en-têtes Web de fondation incluent CSP, refus d’iframe et politique de permissions. La CSP autorise les scripts inline requis par Next ; son durcissement par nonce fera partie de l’architecture d’authentification.

Le pipeline GitHub Actions est fourni ; son exécution distante nécessite un dépôt GitHub. Aucun dépôt distant ni publication n’a été créé. Les décisions et points futurs sont documentés dans `docs/adr` et `docs/ui`.
