# Socle Mobile — Phase 2.5

Workspace Expo SDK **57.0.30**, React **19.2.3**, React Native **0.86.3**. SDK 57 conserve la version React du Web sans mettre à niveau les applications existantes. Outils propres à Expo : TypeScript 6.0.3, types React 19.2.4 et typescript-eslint 8.71.2 ; Web/API/Admin restent sur TypeScript 5.9.3.

Seuls l’enregistrement Expo, un écran d’attente accessible et la configuration du client API partagé sont présents. Aucun login natif, diagnostic, Leitner, planning, notification push, stockage de jeton ou paiement natif : **la Phase 3 n’est pas commencée**. Le client configuré n’effectue aucune requête au démarrage.

Depuis la racine :

```sh
pnpm dev:mobile
pnpm build:mobile
pnpm --filter @revynora/mobile exec expo install --check
```

Le développement ouvre Metro sur **8081**. Un simulateur/device avec un runtime compatible reste nécessaire pour une exécution native. L’export `pnpm build:mobile` compile les bundles Hermes Android/iOS dans `apps/mobile/dist` ; ce n’est ni un APK/AAB ni un IPA signé. Aucun compte Expo/EAS ni identifiant de store n’est requis pour cet export.

`apps/mobile/.env.local` peut définir `EXPO_PUBLIC_API_URL=http://ADRESSE_LAN_DU_SERVEUR:3001/api/v1`. Sur un téléphone physique, localhost désigne le téléphone, pas le serveur. Cette URL est publique : aucune clé API/Stripe ni secret de session dans EXPO_PUBLIC. Les règles d’authentification et les autorisations natives seront définies en Phase 3.

Metro utilise la configuration officielle `expo/metro-config`, qui gère les workspaces pnpm ; aucun chemin absolu propre à cette machine.

Références : [compatibilité SDK](https://docs.expo.dev/versions/latest/), [monorepos Expo](https://docs.expo.dev/guides/monorepos/).
