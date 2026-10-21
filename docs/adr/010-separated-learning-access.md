# ADR 010 — Droits commerciaux, pédagogiques et administratifs séparés

21 octobre 2026. G.8, décision implémentée localement, en attente de revue.

## Contexte

ADR 006 réservait les routes pédagogiques aux étudiants ; ADR 007 conserve quatre applications et une API centrale. Le propriétaire doit apprendre avec sa même identité ADMIN, sans faux abonnement ni accès aux contenus des autres utilisateurs.

## Décision

`resolveEntitlement` et `GetEntitlements` restent exclusivement commerciaux, alimentés par les périodes existantes. `User.plan` demeure un champ de compatibilité. Le nouveau domaine learning-access combine le résultat commercial avec une attribution `InternalLearningGrant` individuelle, persistée, équivalente Pro, datée, éventuellement expirante et révocable.

Un STUDENT conserve les règles commerciales Free/Plus/Pro. Une attribution interne est ignorée pour un STUDENT. Un ADMIN doit posséder une attribution interne active pour accéder à la pédagogie, même si une période commerciale existe. Aucune attribution n’est dérivée automatiquement du rôle. `COMMERCIAL` désigne la politique commerciale, y compris Free, et ne constitue pas une preuve d’achat.

`LearningAccessGuard` authentifie via le service existant et vérifie le droit pédagogique. Il remplace le guard étudiant uniquement sur pédagogie, progression, Leitner, planning et notifications. `StudentGuard` reste inchangé pour facturation et confidentialité. `AdminGuard` reste inchangé. La nouvelle permission administrative nommée `internalLearningGrants` autorise seulement lecture, attribution et révocation ; les permissions privées ai/leitner/planning restent refusées.

Les cas d’usage pédagogiques et le worker emploient le même résolveur effectif, sans cache des droits. Les propriétaires des ressources restent les `User.id` authentifiés. Aucun rôle, quota, calcul de score ou règle commerciale ne change. Les règles du domaine n’importent aucun framework ; les transactions et Prisma sont dans l’infrastructure, les contrôleurs et guards dans la présentation.

## Attribution et traçabilité

API Admin explicite par UUID, corps strict et borné. Un administrateur actif peut attribuer un droit à un administrateur actif explicitement désigné, y compris lui-même. Aucune attribution automatique, aucun bénéficiaire préconfiguré. La révocation demeure possible si le bénéficiaire est suspendu. Acteurs et bénéficiaire sont revérifiés et verrouillés dans la transaction. Le journal d’audit est écrit atomiquement avec le changement. Une révocation répétée est idempotente et ne remplace pas le motif initial.

Une attribution non révoquée et non expirée, même future, bloque une seconde attribution jusqu’à révocation. Les lectures sont paginées par 20 ; transactions limitées à 12 s, attente 3 s et statement_timeout 5 s. Les relations restrictives empêchent une suppression accidentelle des preuves d’attribution. Une procédure de rétention/suppression des comptes administratifs nécessitera un cadrage séparé.

## Navigation et sessions

Les applications restent indépendantes. Les liens changent d’espace, jamais d’identité ni de rôle. Le cookie HttpOnly conserve ses paramètres existants, sans élargissement Domain et sans jeton dans les URL. Sur hôtes distincts, une reconnexion explicite peut être nécessaire ; aucun SSO nouveau n’est introduit. L’authentification mobile demeure réservée aux étudiants. Le guard pédagogique refuse aussi les requêtes ADMIN avec bearer ou marqueur mobile. Une reconnexion sur un hôte distinct crée une session distincte ; la déconnexion conserve la portée de la session courante.

## Conséquences

Une migration est nécessaire avant de lancer cette version contre une base existante. Elle est préparée, sans application à la base applicative autorisée ici. L’attribution propriétaire réelle reste une opération distincte ciblée après autorisation de migration. Aucun changement Payment/UserSubscriptionHistory, aucune transaction Stripe et aucun achat Pro synthétique.

Une révocation bloque les appels suivants et est réévaluée par le worker ; elle ne supprime pas les données personnelles ni n’annule rétroactivement une opération déjà terminée. Les activités internes entrent dans les agrégats existants : aucune exclusion statistique automatique.
