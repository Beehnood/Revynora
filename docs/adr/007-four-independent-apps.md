# ADR 007 — Quatre applications, API centrale et packages communs

17 octobre 2026, Phase 2.5. Décision : séparer les responsabilités sans changer les règles métier ou la persistance.

- Web étudiant, API Nest, Admin Next et socle Expo sont des workspaces indépendants. Les scripts Turbo filtrés construisent leurs dépendances sans construire les autres applications.
- L’Admin Phase 2 est déplacé dans apps/admin. Le Web ne contient plus son composant métier, seulement un pont d’URL protégé vers ADMIN_ORIGIN. La connexion Admin réutilise les endpoints existants.
- packages/api-client contient le transport fetch portable. Les redirections de session appartiennent aux applications ; aucune règle de score, de rôle ou de paiement ne migre vers le client.
- packages/ui contient les primitives DOM/Next déjà présentes et leur CSS ; Mobile garde des composants natifs. Éviter des imports d’applications entre elles et la duplication du dashboard Admin.
- L’API accepte seulement WEB_ORIGIN et ADMIN_ORIGIN explicitement configurées et leurs alias locaux. Les guards, services et repositories restent identiques au checkpoint.
- Les fichiers Prisma, les migrations et le seed restent au même emplacement et inchangés. Aucun reset, db push, nouvelle migration ni migration de la base applicative pendant cette étape.
- Expo SDK 57 est épinglé pour conserver React 19.2.3. Ses outils TS 6 sont isolés des workspaces existants TS 5.9. Les bundles Android/iOS sont vérifiés, pas les binaires signés ou les parcours mobiles futurs.

Le tag restore/phase-2-5-20261017 et le commit a165be0 préservent l’état initial, y compris les modifications non commitées de l’audit précédent. Ne pas utiliser reset --hard : pour examiner cet état, créer un autre worktree ou une branche à partir de ce tag. La branche principale n’est pas fusionnée automatiquement.
