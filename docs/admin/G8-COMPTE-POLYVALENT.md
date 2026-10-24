# G.8 — Compte administrateur polyvalent

## Référence

Branche `feature/admin-dashboard`, HEAD initial `af7aae16f08062366158d5ce1e05e425851e22fe`, dépôt propre avant développement. Architecture : [ADR 010](../adr/010-separated-learning-access.md), complément aux ADR 006 et 007.

## Architecture livrée

- Droits commerciaux : résolveur et facturation existants inchangés.
- Droits pédagogiques : domaine learning-access, provenance explicite INTERNAL/COMMERCIAL/NONE et niveau effectif. ADMIN sans attribution : refus. STUDENT : règles Free/Plus/Pro conservées.
- Attribution interne Pro persistée : bénéficiaire UUID, date d’effet, expiration facultative, provenance, justification, auteur et date de création, révocation avec auteur/date/motif.
- Guard pédagogique dédié et contrôle des droits dans les cas d’usage Plus/Pro et le worker. Sessions, suspension, propriétaires, quotas IA et consentement conservés.
- Interface : rôle ADMIN visible, badge et page d’accès interne distincts de l’offre commerciale. Aucun bouton d’achat ou de portail commercial pour l’ADMIN. Le profil ne propose pas la suppression étudiante d’un compte administratif.

## API de gestion sécurisée

Toutes les routes Admin exigent AdminGuard, puis la permission explicite `internalLearningGrants`. Les mutations conservent le contrôle CSRF et appliquent le limiteur d’authentification existant.

| Route                                                | Objet                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/v1/learning/access`                        | Droits du compte connecté uniquement, SessionGuard                         |
| `GET /api/v1/admin/users/:id/learning-grants?page=1` | Attributions du bénéficiaire explicite, 20 maximum par page, page 1..10000 |
| `POST /api/v1/admin/users/:id/learning-grants`       | Attribution explicite à un ADMIN actif                                     |
| `PATCH /api/v1/admin/learning-grants/:id/revoke`     | Révocation contrôlée et auditée                                            |

Création : `startsAt` ISO UTC obligatoire, `expiresAt` facultatif strictement postérieur au début et encore futur, `provenance` 3..100 caractères, `justification` 10..500 caractères. Niveau Pro fixé côté serveur. Tout champ supplémentaire est refusé. Révocation : `reason` 10..500 caractères. Ne pas mettre de secret ou contenu pédagogique dans ces textes administratifs.

Aucun email ou identifiant personnel codé en dur. Aucun propriétaire réel n’a reçu d’attribution pendant G.8. Les tests emploient seulement des UUID et comptes éphémères dans PostgreSQL isolé. Le rôle ADMIN peut administrer ces attributions ; ce mécanisme ne définit pas un nouveau rôle « super administrateur ».

## Navigation

Admin → Mon espace pédagogique : origine Web explicitement configurée via `WEB_ORIGIN`, ou configuration existante `NEXT_PUBLIC_WEB_ORIGIN`. Si elle manque, aucun lien de destination arbitraire n’est inventé. Web → Administration utilise le pont protégé existant et `ADMIN_ORIGIN`. Les mêmes `User.id` et sessions sont conservés sur un même hôte. Entre domaines distincts, reconnexion explicite possible ; aucun token URL ni cookie Domain élargi.

## Migration

Fichiers : `prisma/schema.prisma` et `prisma/migrations/20261021000000_internal_learning_grants/migration.sql`.

Nouvelle table seulement, relations User et index bénéficiaire/révocation/date. Contraintes SQL : niveau PRO, dates cohérentes, justification/provenance bornées et révocation complète. Payment et UserSubscriptionHistory restent inchangés. Aucune migration, aucun reset, db push ou seed sur la base applicative. La migration est appliquée uniquement au conteneur PostgreSQL G.8 éphémère.

Avant utilisation réelle : faire approuver l’application de la migration à la base cible, régénérer le client Prisma et déployer les éléments compatibles ensemble selon une autorisation distincte. Ne pas lancer la nouvelle API sur la base applicative non migrée : les lectures pédagogiques requièrent la nouvelle table.

## Confidentialité et limites

Les cours personnels de l’ADMIN restent source USER et propriétaire lui-même. Quiz, tentatives, cartes, planning, disponibilités et notifications conservent leurs filtres propriétaire. Les permissions Admin ne donnent aucun forage pédagogique individuel. Le droit interne n’est jamais une facture ni un abonnement commercial.

Révocation réévaluée à chaque nouvelle requête et avant les envois ; aucune garantie d’interruption rétroactive d’une opération déjà en cours. Les preuves sont conservées avec relations restrictives : suppression définitive administrative hors périmètre. Les activités internes restent incluses dans les statistiques globales existantes. Mobile, règles commerciales, SSO entre domaines et G.9 hors périmètre.

Résultats exécutés et limites : [G8-RECETTE.md](G8-RECETTE.md).

## Fichiers du lot

Liste exacte des 51 fichiers créés ou modifiés :

```text
apps/admin/app/(protected)/layout.tsx
apps/admin/components/admin-shell.tsx
apps/admin/components/login-form.tsx
apps/admin/tests/login.test.tsx
apps/api/src/admin/admin.module.ts
apps/api/src/admin/domain/permissions.ts
apps/api/src/admin/presentation/learning-grants.controller.ts
apps/api/src/auth/auth.module.ts
apps/api/src/auth/learning-access.controller.ts
apps/api/src/auth/learning-access.guard.spec.ts
apps/api/src/auth/learning-access.guard.ts
apps/api/src/learning-access/access.integration.ts
apps/api/src/learning-access/application/learning-access.ts
apps/api/src/learning-access/application/manage-grants.ts
apps/api/src/learning-access/domain/access.spec.ts
apps/api/src/learning-access/domain/access.ts
apps/api/src/learning-access/infrastructure/access.repository.ts
apps/api/src/learning-access/infrastructure/manage-grants.ts
apps/api/src/learning-access/learning-access.module.ts
apps/api/src/learning/learning.controller.ts
apps/api/src/leitner/application/leitner.use-cases.ts
apps/api/src/leitner/leitner.module.ts
apps/api/src/leitner/presentation/leitner.controller.ts
apps/api/src/notifications/application/notifications.use-cases.ts
apps/api/src/notifications/infrastructure/reminder.worker.ts
apps/api/src/notifications/notifications.module.ts
apps/api/src/notifications/presentation/notifications.controller.ts
apps/api/src/planning/application/intelligent-planning.use-cases.ts
apps/api/src/planning/application/planning.use-cases.ts
apps/api/src/planning/planning.module.ts
apps/api/src/planning/planning.spec.ts
apps/api/src/planning/presentation/intelligent-planning.controller.ts
apps/api/src/planning/presentation/planning.controller.ts
apps/api/src/progress/presentation/progress.controller.ts
apps/web/app/app/abonnement/page.tsx
apps/web/app/app/layout.tsx
apps/web/components/learning/auth-form.tsx
apps/web/components/learning/profile-view.tsx
apps/web/components/learning/student-shell.tsx
apps/web/components/saas/billing-view.tsx
apps/web/components/saas/internal-learning-access.tsx
apps/web/playwright.polyvalent.config.ts
apps/web/tests/admin-e2e/polyvalent-g8.spec.ts
apps/web/tests/admin-e2e/ux-g7.spec.ts
apps/web/tests/saas.test.tsx
docs/admin/G8-COMPTE-POLYVALENT.md
docs/admin/G8-RECETTE.md
docs/adr/010-separated-learning-access.md
packages/types/src/index.ts
prisma/migrations/20261021000000_internal_learning_grants/migration.sql
prisma/schema.prisma
```
