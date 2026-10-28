# G.9 — Gestion commerciale versionnée

## Périmètre

Développement local depuis main 2a3bf2c7fdd0c473477bdddf62fba83bed59bca0, branche feature/admin-commercial-management. Aucun commit, push, déploiement, migration applicative, opération fournisseur distante ou attribution réelle n'est nécessaire à la recette.

## Séparation des responsabilités

- Subscription conserve l'identité FREE/PLUS/PRO, la révision et le pointeur vers la version vendue.
- CommercialOfferVersion est une proposition complète. Son contenu est immuable dès sa création ; seule la transition DRAFT vers PUBLISHED est possible. Une correction exige un nouveau brouillon.
- Les versions publiées ne sont jamais écrasées ou supprimées. La disponibilité commerciale concerne les nouvelles souscriptions, pas les contrats existants.
- CommercialProviderPrice conserve un prix Stripe test vérifié, son compte fournisseur et sa version. Associations immuables, aucune association live.
- CheckoutIntent conserve montant, devise, intervalle, fonctionnalités, version et prix fournisseur acceptés. Un changement ultérieur de catalogue n'altère pas le checkout.
- UserSubscriptionHistory conserve le tarif et les capacités contractuelles. Les nouveaux événements reprennent des preuves fournisseur, le checkout ou un contrat antérieur ; jamais le prix catalogue actuel pour inventer un ancien paiement.
- Les anciennes périodes restent LEGACY_UNVERIFIED : leurs montants ne sont pas réécrits et aucune version actuelle ne leur est attribuée artificiellement. Les capacités historiques sont conservées par la règle de compatibilité fixe.
- Les attributions internes G.8 restent indépendantes : aucun paiement, abonnement ou permission commerciale n'est créé par une attribution pédagogique.

## Publication et sécurité

La page /offres exige côté API une session ADMIN active et une ligne CommercialPermission explicite. Aucun compte ne reçoit cette capacité par défaut. Aucun endpoint public ou administrateur ne permet de s'auto-attribuer cette capacité. Son provisionnement sur un compte réel exige une autorisation distincte, une provenance documentée et une vérification d'identité. Aucun provisionnement réel n'est effectué en G.9.

Parcours : consultation des offres et versions → brouillon avec motif → comparaison des conditions → éventuelle vérification d'un prix Stripe test déjà créé → case de confirmation explicite → publication.

La révision attendue est vérifiée dans une transaction avec verrou de l'offre. Une publication concurrente ou un brouillon obsolète produit 409. La mutation du catalogue et CommercialAudit sont atomiques. Les protections de session, d'origine et de validation stricte des corps sont conservées.

Le registre de capacités contient uniquement leitner, planning, reminders. Planning dépend de Leitner ; reminders dépend de planning. Le consentement aux rappels et les contrôles de livraison restent obligatoires. Free reste gratuit, sans récurrence et toujours disponible ; les fonctionnalités choisies pour sa nouvelle version sont capturées lors des nouvelles inscriptions, sans rétroactivité sur les anciens comptes. Le socle cours/tests/historique reste inchangé.

Désactiver une offre Plus/Pro interdit les nouvelles souscriptions et les changements vers cette offre. Les contrats déjà actifs ne sont pas résiliés. Les changements de tarif/fonctionnalités concernent les nouveaux contrats, pas les renouvellements des versions historiques. Aucun outil de modification individuelle des conditions d'un utilisateur n'est ajouté.

## Fournisseurs

Mock consomme le tarif accepté, sans montants de paiement codés en dur. Il conserve la distinction simulation/paiement réel. Le changement de formule Mock enregistre la proposition suivante ; il ne constitue pas une horloge ou un simulateur automatique de renouvellement fournisseur.

Stripe reste limité au test. La vérification utilise uniquement la lecture du Price et du compte Stripe. Aucun Product/Price n'est créé ni modifié. Le prix doit être actif, récurrent mensuel, EUR, unitaire, de montant exact, sans transformation de quantité ni montant libre. Une version vendue avec Stripe doit posséder une association vérifiée.

Un identifiant de prix ne peut appartenir qu'à une version par compte/environnement. Pour changer les fonctionnalités tout en gardant le même montant, préparer un autre prix Stripe test hors de Revynora, puis l'associer au nouveau brouillon. Ce choix évite une reconnaissance ambiguë des contrats historiques.

Les anciens contrats sont rapprochés avec leur version/référence persistée, ou avec les anciennes références d'environnement et un montant antérieurement enregistré. Les cas non démontrables sont refusés explicitement et nécessitent une réconciliation distincte ; aucun tarif courant n'est substitué. Les anciens identifiants d'environnement ne doivent pas être remplacés avant inventaire des contrats historiques.

Une vérification fournisseur ne garantit pas que la configuration distante ne changera jamais ensuite : le checkout recontrôle le prix. Les webhooks sont signés, dédupliqués et relisent l'état fournisseur. Les montants de facture observés restent distincts du prix nominal du contrat et ne prouvent pas à eux seuls un encaissement réel.

La configuration des versements reste exclusivement dans l'interface sécurisée du fournisseur. Aucune donnée bancaire ni opération de versement n'est ajoutée à Revynora.

## Migrations

- 20261025000000_commercial_versions : tables, colonnes additives, instantané du catalogue existant, protections d'immuabilité et d'audit append-only.
- 20261025001000_contract_provider_price : référence de prix fournisseur des périodes.
- 20261026000000_commercial_catalog_guard : cohérence de la projection du catalogue publié et protection contre les écritures historiques non versionnées.

Aucune ancienne migration n'est modifiée. Le seed historique reste identique et son empreinte est toujours contrôlée. La commande db:seed utilise un nouveau script limité aux tests isolés, qui préserve les prix existants ; l'initialisation commerciale ne crée qu'un instantané pour les offres qui n'en possèdent pas. Aucun utilisateur ou permission n'est créé par cette initialisation.

Avant toute application réelle : inventaire des données et prix fournisseur, sauvegarde vérifiée, répétition sur copie représentative, revue des contraintes et autorisation distincte. Une base vide ne suffit pas à prouver la compatibilité des données réelles.

## API

- GET /admin/commercial/offers
- GET /admin/commercial/history?page=1
- POST /admin/commercial/offers/:id/drafts : expectedRevision, nom, montant, devise, intervalle, disponibilité, registre de fonctionnalités, motif.
- POST /admin/commercial/versions/:id/verify-price : identifiant d'un prix test existant. Lectures fournisseur uniquement.
- POST /admin/commercial/versions/:id/publish : expectedRevision et confirmVersionId.

Toutes ces routes vérifient la capacité commerciale. Les routes publiques de paiement ne prennent pas de montant, version ou identité d'utilisateur arbitraire fournis par le client.
