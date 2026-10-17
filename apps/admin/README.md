# Administration Web

Application Next.js indépendante, port local **3002**. L’interface administrative Phase 2 est déplacée ici ; aucune nouvelle fonctionnalité métier n’est ajoutée. L’authentification et le contrôle ADMIN restent dans l’API centrale.

Depuis la racine du dépôt : `pnpm dev:admin` pour développer cette application seule, `pnpm build:admin` pour son build et celui de ses packages nécessaires. L’API doit être démarrée séparément (`pnpm dev:api`), ou utiliser `pnpm dev` pour Web + API + Admin.

Configuration dans `apps/admin/.env.local` (le `.env` racine reste un repli local) : `API_URL=http://127.0.0.1:3001` côté serveur, `NEXT_PUBLIC_WEB_ORIGIN=http://localhost:3000` pour le lien du site public. Fixer API_URL avant le build car Next compile les réécritures du proxy. Aucun secret dans une variable NEXT_PUBLIC.

La connexion est disponible sur `/connexion`. Les comptes existants et sessions HttpOnly de l’API sont réutilisés ; aucun compte par défaut. Sur un même hôte local, les cookies sont partagés entre ports : conserver localhost ou 127.0.0.1 dans tout le parcours. Les anciennes URL Web `/admin` continuent de vérifier la session puis redirigent ici.

Déploiement futur indépendant : contexte de build à la racine du monorepo, installation pnpm avec lockfile, `pnpm build:admin`, puis `pnpm --filter @revynora/admin start`. Configurer ADMIN_ORIGIN dans l’API. Aucun déploiement n’est effectué en Phase 2.5.
