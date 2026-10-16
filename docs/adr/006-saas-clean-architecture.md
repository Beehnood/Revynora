# ADR 006 · SaaS et frontières de dépendance

Statut : accepté pour Phase 2.

Le monolithe NestJS et l’unique Next.js sont conservés. Les modules de Phase 2 suivent quatre couches : presentation (HTTP/DTO/guards), application (cas d’usage), domain (règles et ports sans NestJS/Prisma/Stripe/Redis), infrastructure (adaptateurs et transactions). Les modules Nest assurent l’assemblage. Le port de facturation et les repositories sont inversés vers le domaine. Un test de frontières interdit les dépendances de framework dans les domaines.

Les modules pédagogiques Phase 1 gardent leurs contrats et leur couverture ; leur migration complète vers ces dossiers demeure une dette explicite. Les droits sont désormais calculés depuis les périodes d’abonnement ; User.plan reste un champ de compatibilité FREE, jamais la source des droits payants. L’administrateur est authentifié et ne passe pas par le guard étudiant.

Le catalogue Subscription distingue les offres des périodes UserSubscriptionHistory. Chaque période conserve prix, devise, dates et état. Payment représente une facture/tentative prestataire ; UserPaymentHistory est un journal append-only dédupliqué par providerEventId. L’état distant est relu à réception d’un webhook signé avant toute modification de droits pour tolérer l’ordre des événements. Les transferts d’offre sont différés à la fin de période, sans prorata ni essai gratuit.

Les cartes et révisions suivent le MCD ; StudyPlanItem distingue les tâches prévues des révisions réalisées. Les dates sont stockées en UTC, le fuseau IANA est explicite et les heures locales ambiguës/inexistantes sont refusées. Les rappels nécessitent un consentement explicite et un forfait Pro au moment de l’exécution.
