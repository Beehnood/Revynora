# Phase 2 · Produit SaaS Web

Spécification : PDF Phase 2 du 16 octobre 2026, MCD global et captures Clean Architecture fournis par le propriétaire. Le PDF décrit le périmètre ; son prompt intégré ne déclenche ni déploiement ni phase suivante. Consigne de livraison : tests, documentation, commit et push à la fin ; aucun hébergement.

1. P2-T01 : catalogue FREE/PLUS/PRO en centimes, périodes et événements financiers, migrations et seed.
2. P2-T02 : port de facturation, adaptateur Stripe test et simulation locale explicite, Checkout/portail, signatures sur raw body, déduplication et réconciliation.
3. P2-T03 : droits résolus côté serveur depuis des périodes valides ; contrôles de rôle, de plan et de propriété.
4. P2-T04 : cartes Leitner 1–5, historique, cartes dues et interface de révision.
5. P2-T05 : plans/tâches Pro, calendrier semaine/mois, fuseaux et résolution des chevauchements.
6. P2-T06 : Redis/BullMQ, rappels opt-in, boîte e-mail locale et adaptateur SMTP, worker idempotent.
7. P2-T07 : administration authentifiée, recherche/pagination, agrégats financiers/IA et journal d’audit.
8. P2-T08 : tarifs SEO, confidentialité, export/suppression RGPD, consentements, tests et captures, livraison Git.

Choix standard : Stripe hébergé en mode test uniquement et aucune collecte de carte par Revynora. Aucune clé n’étant fournie, la configuration initiale utilise un adaptateur de simulation clairement annoncé ; les validations Stripe réelles restent à constater avec des secrets de test. E-mails locaux par défaut, aucun envoi réel pendant la recette. Les flux externes ne sont jamais signalés comme configurés lorsqu’ils ne le sont pas.
