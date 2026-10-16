# Phase 2 · Recette locale du produit SaaS Web

Date : 16 octobre 2026. Périmètre : PDF Phase 2, MCD global, captures d’architecture et références Revynora fournis par le propriétaire. Aucun déploiement ni hébergement. Le prompt intégré au PDF est traité comme une spécification ; il n’autorise aucune autre phase.

## Livraison par ticket

| Ticket | Code principal                                                                                                  | Comportement et preuves                                                                                                                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-T01 | `prisma/schema.prisma`, migrations `20261016020000_saas` et `20261016021000_checkout_resume`, `prisma/seed.cjs` | Catalogue 0/250/500 centimes ; périodes datées avec prix figé ; références prestataire uniques ; événements financiers append-only protégés par trigger SQL. Contraintes de dates, montants et boîtes en DB.                                                                                                            |
| P2-T02 | `apps/api/src/billing/` ; `apps/web/components/saas/billing-view.tsx`                                           | Checkout et portail Stripe test ; reprise d’intention, retour en attente de confirmation, refus ; signature sur raw body ; sérialisation et relecture prestataire ; replays dédupliqués ; échéance et changement différé sans prorata ; paiements paginés et reçus autorisés. Simulation locale explicitement indiquée. |
| P2-T03 | `billing/application/billing.use-cases.ts`, `auth/`                                                             | Droits résolus depuis les périodes actives, jamais depuis le navigateur ou `User.plan`. Free interdit sur Leitner et planning ; Plus sur planning ; compte suspendu révoqué ; rôle ADMIN contrôlé côté API.                                                                                                             |
| P2-T04 | `apps/api/src/leitner/`, `leitner-view.tsx`                                                                     | Création/modification/archivage, collection paginée, cartes dues, boîtes 1–5, historique et statistiques ; session face/verso, raccourcis et fin de séance ; version optimiste et requête de révision idempotente.                                                                                                      |
| P2-T05 | `apps/api/src/planning/`, `planning-view.tsx`                                                                   | Plans et tâches Pro, calendrier semaine/mois civil, création/modification/annulation ; UTC + IANA ; rejet des heures DST ambiguës/inexistantes ; collisions refusées ou décalées ; verrou utilisateur et version.                                                                                                       |
| P2-T06 | `apps/api/src/notifications/`, `compose.yaml`                                                                   | Redis/BullMQ, outbox PostgreSQL durable, reprise par balayage, IDs de jobs stables, contrôle de consentement/Pro/version/date à la livraison ; e-mails locaux par défaut ; adaptateur SMTP, tentatives bornées et Message-ID stable.                                                                                    |
| P2-T07 | `apps/api/src/admin/`, `apps/web/app/admin/`, `admin-view.tsx`, `scripts/admin-promote.cjs`                     | Espace authentifié, sidebar responsive, recherche et pagination, catalogue, agrégats de paiements séparés par fournisseur/statut, coûts IA non inventés, filtre période et audit ; suspension/réactivation avec révocation des sessions. Aucun compte administrateur par défaut.                                        |
| P2-T08 | `apps/api/src/privacy/`, pages publiques, `auth-form.tsx`, tests et CI                                          | Tarifs et métadonnées, conditions/confidentialité locales, acceptation des conditions à l’inscription, consentement distinct pour les rappels, export privé sans secrets ni solutions prématurées, suppression avec mot de passe et anonymisation des faits financiers ; parcours E2E et axe.                           |

## Vérifications

Tous les contrôles ci-dessous ont réussi. Total : **100 tests distincts** (36 Web + 27 unitaires API + 23 intégrations API + 14 E2E). Les audits axe des parcours contrôlés ne remontent aucune violation A/AA.

Couverture des lignes : **97,10 % Web**, **94,67 % API** (branches : 89,18 % / 84,88 %). Les seuils existants sont conservés ; tous les nouveaux modules sont inclus. Les chiffres de couverture finaux sont dans [coverage-summary.json](coverage-summary.json). Rapports détaillés locaux : `apps/web/coverage/index.html`, `apps/api/coverage/integration/index.html`, `apps/web/playwright-report/index.html`.

- `pnpm test` : 63 tests unitaires Web/API réussis.
- `pnpm format:check` : contrôle du formatage.
- `pnpm lint` : ESLint Web/API.
- `pnpm typecheck` : TypeScript strict et routes Next.
- `pnpm test:coverage` : 36 tests Web et 50 tests API, dont 23 tests HTTP/PostgreSQL ; les 27 tests unitaires API sont inclus dans ces 50, ne pas les compter deux fois.
- `pnpm build` : compilation Nest et build Next local, sans publication.
- `pnpm test:e2e` : 14 tests Chromium. Régressions Phase 1 à 320/375/768/1280 px ; nouveaux parcours SaaS à 375/1280 px, contrôle de débordement et axe WCAG A/AA. Chromium local fourni via `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/revynora-browsers` pendant cette recette ; installation standard documentée dans README pour une autre machine.

Les tests utilisent exclusivement `revynora_test`, des utilisateurs dédiés et une queue Redis de test. Ils ne suppriment pas la base ni les données applicatives. Les événements financiers anonymisés sont conservés, y compris après suppression des comptes de test. Les captures historiques Phase 1 sont préservées ; les nouvelles captures de régression sont préfixées `regression-` dans ce dossier.

Vitest remplace la commande Jest `--runInBand` du PDF ; les intégrations tournent sans parallélisme de fichiers. Le workspace réel s’appelle `@revynora/web`, pas `web`.

## Scénarios de fiabilité couverts

Paiement en attente sans droits, refus sans droits, activation par événement signé, signature invalide et payload modifié, refus du mode live, reprise d’un événement identique, relecture après événement ancien, transition Plus vers Pro avec conservation du prix passé, expiration, accès direct interdit, contrôle de propriété, double révision concurrente, modification périmée, collisions de planning et DST, opt-in désactivé par défaut, retrait du consentement, livraison réelle BullMQ vers boîte locale, SMTP indisponible sans faux succès (cinq tentatives), recherche/admin/suspension, export et suppression, protection append-only en SQL.

## Captures

- [Abonnement mobile](abonnement-375.png) · [desktop](abonnement-1280.png)
- [Leitner mobile](leitner-375.png) · [desktop](leitner-1280.png)
- [Planning mobile](planning-375.png) · [desktop](planning-1280.png)
- [Administration](admin-1280.png)

## Limites constatées et recette externe restante

Aucun secret Stripe/SMTP n’a été fourni. Aucun appel à un compte Stripe, prélèvement réel ou envoi SMTP externe n’a été effectué. Les appels du SDK Stripe sont simulés dans les tests ; les signatures sont générées/vérifiées par le vrai SDK. La transition accélérée de période est une fixture de test, jamais une route publique permettant d’attribuer des droits.

Pour une recette Stripe distante : créer les deux prix EUR mensuels de test, configurer les quatre variables serveur, relayer avec Stripe CLI, vérifier Checkout accepté/refusé, invoice.paid, subscription.updated/deleted, replays et subscription schedule à l’échéance. Seul ce passage peut confirmer la configuration du compte Stripe. Les simulations locales ne renouvellent pas automatiquement les périodes. Les essais gratuits, prorata et fiscalité automatisée restent exclus.

Le worker local est activé par défaut ; Redis doit tourner. `MAIL_PROVIDER=local` n’envoie aucun e-mail : SENT signifie placé dans la boîte locale. Les délais BullMQ ne sont pas une garantie de livraison à la milliseconde ; un rappel trop tardif est annulé. Avec SMTP, une coupure après acceptation distante mais avant commit local peut produire un doublon malgré le Message-ID stable. Aucun engagement « exactement une fois » pour SMTP.

Les pages légales décrivent le fonctionnement de cette version locale ; identité/contact de l’opérateur et durées de conservation restent à renseigner avant ouverture publique. Les modules Phase 1 conservent leur organisation historique ; les nouveaux modules suivent les quatre couches, avec un test de frontières. Vérification d’e-mail, récupération de mot de passe et application native sont hors de cette livraison.

## Références techniques

Décision : [ADR 006](../adr/006-saas-clean-architecture.md). Références consultées : [événements d’abonnement Stripe](https://docs.stripe.com/billing/subscriptions/webhooks), [webhooks Stripe](https://docs.stripe.com/webhooks), [jobs différés BullMQ](https://docs.bullmq.io/guide/jobs/delayed), [identifiants de jobs BullMQ](https://docs.bullmq.io/guide/jobs/job-ids). Les dépendances et leurs types installés servent de référence d’implémentation.
