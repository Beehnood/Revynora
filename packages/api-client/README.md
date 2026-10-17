# Client API partagé

Transport REST basé sur fetch, indépendant de React, Next, Expo, Nest et Prisma. Conserve le marqueur CSRF, les erreurs `{code,message,details,status}`, le JSON et les options du transport existant. Aucune redirection ni persistance de jeton dans ce package.

```ts
import { createApiClient, RequestError } from "@revynora/api-client";
const api = createApiClient({ baseUrl: "/api/v1" });
// Exemple uniquement ; ne pas appeler pendant le rendu serveur sans contexte de session.
// const profile = await api<UserProfile>('/users/me');
```

Chaque application choisit son adresse, ses credentials et son callback `onUnauthorized`. Web/Admin utilisent leur proxy de même origine et les sessions centrales ; le socle Mobile prépare une URL absolue sans implémenter d’authentification. Un `fetcher` peut être injecté pour les tests ou un contexte serveur explicite.

`pnpm build:web`, `build:admin`, `dev:web`, `dev:admin` et `dev:mobile` exécutent les builds des packages dépendants via Turbo. Après modification d’un package compilé, relancer le script de développement pour reconstruire ses dépendances. Les applications ne s’importent pas entre elles.
