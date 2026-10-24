# G.1 — Recette locale

19 octobre 2026. Base Git `8c2cbf7e7e5fca9fe16dca2eed9f2688337b9bb5`. Travail non commité. [Conception, matrice et limites](G1-FONDATIONS.md).

Ce document conserve la recette initiale. Les corrections et résultats actualisés avant commit figurent dans la [revue finale](G1-REVUE-FINALE.md).

## Livré

- Matrice fermée ADMIN/STUDENT, contrôles dans les cas d’usage, AdminGuard et protections existantes préservés.
- DTO Admin partagés et requête PATCH stricte : confirmation vraie et motif dans une liste fermée ; aucun texte personnel libre.
- Confirmation dédiée avant suspension/réactivation, protection contre les doubles clics, rafraîchissement utilisateurs/audit après succès.
- Audit de réussite transactionnel avec révocation des sessions ; refus et échecs transactionnels journalisés séparément. Lecture compatible des événements historiques.
- Vérification SSR de session : cookie absent/invalide, expiration, refus, panne, timeout, réponse JSON malformée et rôle inconnu traités sans rendre le contenu protégé.
- API_URL obligatoire en production, HTTPS sur Vercel et pour les destinations distantes. Loopback HTTP explicitement configuré accepté hors Vercel pour les recettes locales. Aucun fallback implicite en production.
- Module utilisateurs amorcé, contrats typés et architecture des futures ressources documentée sans développer les lots suivants.
- CI de validation : API_URL loopback explicite uniquement aux étapes typecheck/build ; couverture des nouveaux modules incluse, seuils préservés.

## Contrôles réussis

Node 24.3.0, pnpm 10.18.3. Dépendances installées avec verrou figé dans une copie isolée, sans copie de .env ni lien vers les node_modules du dépôt principal. Les modifications validées sont ensuite synchronisées avec le dépôt.

| Contrôle                                     | Résultat                                                              |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Tests API unitaires + intégration PostgreSQL | 76 réussis : 40 unitaires, 36 intégrations                            |
| Tests Admin                                  | 19 réussis, dont sessions, layout protégé, confirmation et régression |
| Tests Web de régression                      | 43 réussis                                                            |
| ESLint API et Admin                          | réussi                                                                |
| TypeScript API et Admin                      | réussi                                                                |
| Builds Nest et Next Admin                    | réussis                                                               |
| Build des packages validation et api-client  | réussi                                                                |
| Frontières du monorepo et intégrité Prisma   | réussies                                                              |

138 tests distincts réussis. Les répétitions de tests ne sont pas additionnées. Les premières erreurs de typage et de lint ont été corrigées ; les premières erreurs des tests IA provenaient de DATABASE_URL absent dans la copie isolée et ont disparu avec une configuration de test locale explicite.

| Couverture            | Lignes  | Branches | Fonctions |
| --------------------- | ------- | -------- | --------- |
| API                   | 95,05 % | 87,06 %  | 98 %      |
| Admin, modules inclus | 98,24 % | 93,02 %  | 90 %      |

Les suites API utilisent exclusivement revynora_test sur loopback, avec utilisateurs et paiements de test. Aucun reset ni migration exécuté. Les modèles, migrations, seeds et le lockfile restent inchangés. Les contrôles de compilation ne font aucune requête vers l’API distante. Les avertissements Recharts en jsdom observés dans la régression Web ne font pas échouer les tests.

Commandes principales exécutées dans la copie locale :

```sh
pnpm install --frozen-lockfile --store-dir <store-temporaire>
pnpm exec turbo run build --filter=@revynora/validation --filter=@revynora/api-client --force
pnpm --filter @revynora/admin test:coverage
pnpm --filter @revynora/api exec vitest run --config vitest.integration.config.ts --coverage
pnpm --filter @revynora/web test
pnpm exec turbo lint --filter=@revynora/api --filter=@revynora/admin
API_URL=http://127.0.0.1:3001 pnpm exec turbo typecheck --filter=@revynora/api --filter=@revynora/admin
API_URL=https://api.revynora.watercode.dev pnpm exec turbo build --filter=@revynora/api --filter=@revynora/admin --force
pnpm check:boundaries
pnpm check:prisma-integrity
```

Les URL de base de test sont injectées dans les processus de test après vérification de la cible locale ; aucun secret n’est inclus dans ce document. Les logs et rapports sont conservés hors Git dans `/private/tmp/revynora-g1-i_c37ydm`.

## Limites et décision

GO local pour revue du lot G.1. Aucun commit, push, déploiement ou lot suivant lancé.

Le PATCH est volontairement incompatible avec les anciens clients qui n’envoient ni confirmation ni motif : une future livraison API/Admin doit être coordonnée. L’enveloppe versionnée dans AuditLog.action évite une migration, mais n’offre pas de filtre SQL dédié sur motif/résultat. Aucun ancien audit n’est réécrit. Une indisponibilité complète de la base empêche aussi la persistance des échecs.

Pas de recette navigateur E2E relancée, ni de revue manuelle lecteur d’écran ou de test distant. Les intégrations externes, MFA et nouvelles pages métier restent hors G.1. Aucune modification Oracle, Vercel, SSO, DNS ou de la production.
