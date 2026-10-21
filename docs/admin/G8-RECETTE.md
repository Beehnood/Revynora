# G.8 — Recette locale du compte polyvalent

## Référence et isolation

Branche `feature/admin-dashboard`, base `af7aae16f08062366158d5ce1e05e425851e22fe`, dépôt propre initialement. Sources et preuves dans `/private/tmp/revynora-g8-5s_efzh8`, indiqué aussi par `/private/tmp/revynora-g8-location`. Copie de validation sans .env ; dépendances déjà installées réutilisées puis cache Prisma isolé. Aucun ajout de dépendance.

PostgreSQL éphémère dédié, image locale postgres:17.6-alpine, base `revynora_test`, port loopback distinct de 5433, stockage temporaire. URL contrôlée avant les commandes. Aucun accès de migration à la base applicative. Redis de recette utilise une base logique et des noms de queues de test. Fournisseurs IA/facturation simulés, mail local ; aucun appel Stripe distant ni envoi SMTP réel.

## Résultats exécutés

| Contrôle                               | Résultat final               |
| -------------------------------------- | ---------------------------- |
| Tests unitaires API                    | 64 réussis, 18 fichiers      |
| Tests Admin avec couverture            | 43 réussis, 14 fichiers      |
| Tests unitaires Web                    | 44 réussis, 5 fichiers       |
| Intégrations PostgreSQL/HTTP           | 49 réussies, 5 fichiers      |
| Playwright G.2–G.6                     | 14 scénarios réussis         |
| Playwright G.7                         | 5 scénarios réussis          |
| Playwright G.8                         | 4 scénarios réussis          |
| ESLint et TypeScript API/Admin/Web     | Réussis                      |
| Builds API/Admin/Web HTTPS forcés      | Réussis                      |
| Builds Admin/Web loopback pour recette | Réussis, réservés aux tests  |
| Frontières du monorepo                 | Réussies                     |
| Prisma generate et validate            | Réussis dans la copie isolée |
| Migration sur PostgreSQL G.8 isolé     | Réussie                      |
| Comparaison schéma PostgreSQL / Prisma | Aucune différence détectée   |

Total : **223 tests distincts réussis**. Couverture Admin : lignes/statements 98,19 %, branches 92,35 %, fonctions 87,93 %. Aucun seuil abaissé ni exclusion ajoutée. Les nouvelles fonctions de droits sont couvertes par les unitaires et intégrations ; aucune couverture globale API de 80 % n’est revendiquée ici.

## Périmètre des assertions

- ADMIN avec/sans attribution, début inclus, attribution future, fin exclue, révocation et compte suspendu ; droits étudiants Free/Pro et règles Plus existantes.
- Attribution explicite par UUID, bénéficiaire étudiant refusé, doublon concurrent sérialisé, paramètres supplémentaires refusés, lecture Admin paginée, journal atomique, révocation idempotente et bénéficiaire suspendu révocable.
- Aucun paiement ni période commerciale payante créés pour l’accès interne ; rôle ADMIN et offre commerciale Free conservés.
- Isolation dans les deux sens : quiz, tentatives, cartes et cours ; refus de modification du planning étudiant par l’ADMIN et de rattachement d’une carte à un cours privé étranger.
- Quota IA maintenu en concurrence ; création personnelle de cours source USER ; révision Leitner ; disponibilité, proposition et confirmation de planning IA avec l’accès interne.
- Consentement explicite, rappel enregistré en mode local avec attribution active, puis annulation d’un rappel après révocation. Le worker réévalue les droits ; les intégrations existantes couvrent aussi l’outbox et BullMQ.
- Sessions expirées, suspension, refus de connexion mobile ADMIN et refus pédagogique ADMIN par bearer ; authentification mobile étudiante, facturation et webhooks existants réexécutés.
- Navigation Admin ↔ pédagogie à 375/768/1440 px, même User.id, rôle ADMIN et offre Free ; page d’accès interne, aucune commande d’achat et refus pédagogique après révocation tout en conservant l’Admin.

## Navigateur et captures

Chromium, trois lots séparés avec redémarrage des serveurs de recette pour conserver les limites de connexion existantes. Config : `apps/web/playwright.polyvalent.config.ts`. Commandes Playwright : même config avec, successivement, les fichiers G.2/G.3/G.4/G.6, puis `ux-g7.spec.ts`, puis `polyvalent-g8.spec.ts`.

G.7 couvre 320/375/768/1280/1440 px, cinq pages et les contrôles Axe existants. G.8 ajoute trois contrôles Axe A/AA/2.1 AA sur l’accès interne, sans violation détectée, ainsi que l’absence de débordement global aux trois largeurs. Captures des espaces Admin et pédagogique dans `browser-results/browser-g8`, captures de régression dans les dossiers voisins. Les captures utilisent exclusivement des comptes de test isolés, pas le compte du propriétaire réel.

## Échecs rencontrés et corrigés

- Première préparation : packages partagés non construits et anciens liens de cache de dépendances ; préparation corrigée et validations relancées. Une relance unitaire sans DATABASE_URL de test a également échoué à la validation d’environnement ; l’environnement explicite est rétabli, puis les 64 tests passent.
- ESLint : JSX construit dans un try/catch ; rendu déplacé hors du bloc, sans modification des règles.
- Nouvelle fixture de disponibilité : champ localEnd incompatible avec le contrat existant ; corrigé en durationMinutes, puis les 49 intégrations passent.
- Première recette navigateur : test G.8 ne dépliait pas le menu étudiant à 768 px ; détection de visibilité du bouton corrigée.
- Une soumission Admin avant hydratation utilisait le comportement HTML GET et plaçait les champs de fixture dans l’URL. Formulaires Admin/Web passés en POST de repli, soumission désactivée avant hydratation, test de méthode ajouté. Les parcours relancés passent. Aucun identifiant réel n’a été utilisé dans cette recette.

Aucun échec restant dans les contrôles finaux annoncés.

## Non exécuté et limites

Pas de lecteur d’écran manuel, Safari, appareil physique ou recette entre domaines réels distincts. Aucun SSO ni nouvelle portée de cookie : reconnexion explicite conservée si nécessaire. Le mobile n’est pas reconstruit, son code n’est pas modifié ; ses intégrations API sont exécutées. Pas de test de charge production ni de fournisseur réel. Pas de modification des agrégats pour exclure les comptes internes.

Les nouvelles attributions sont administrées par API protégée ; aucun écran graphique de gestion des attributions n’est ajouté. Les preuves d’attribution ont des relations restrictives : une procédure distincte sera nécessaire pour supprimer définitivement un compte administratif concerné.

## Migration et livraison

Migration préparée : `20261021000000_internal_learning_grants`. Appliquée uniquement au PostgreSQL éphémère de recette ; base applicative inchangée. Aucun reset, db push ou seed applicatif. Aucun propriétaire réel n’a reçu de droit interne. Une autorisation distincte est nécessaire avant migration applicative et attribution réelle. La nouvelle API ne doit pas être lancée sur une base non migrée.

Prettier, git diff --check, contrôle de périmètre et recherche de signatures de secrets réalisés au contrôle final. Empreintes des sources et diff conservés hors Git. Les fichiers livrés correspondent à la copie vérifiée. Aucun commit, push, déploiement ou travail G.9.

**GO pour revue locale G.8**, avec migration applicative et activation réelle en attente d’autorisation.
