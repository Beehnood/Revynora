# ADR 008 — Planning proposé puis confirmé et statistiques réelles

Statut : accepté, Phase 3 demandée le 17 octobre 2026 (Leitner/Planning/Progression ; remplace le périmètre Mobile de la roadmap initiale).

Les quatre applications restent indépendantes. Aucun écran natif ni nouvelle fonction Admin. Les domaines et cas d’usage dépendent de ports ; Nest assure l’assemblage des adaptateurs. Le nouveau module Progress suit les quatre couches. Le lecteur de contexte Planning est un contrat de lecture explicite entre modules : cours accessibles, tentatives soumises et évaluées par le calculateur Learning existant, cartes de l’étudiant, examens et disponibilités. Aucun corrigé de QCM non soumis ni identité/e-mail n’est transmis au modèle.

Les examens sont des StudyPlanItem kind=EXAM ; priorité entière 1..3 et cours facultatif. Les anciens statuts PLANNED/DONE/CANCELLED restent inchangés. Les disponibilités ponctuelles sont stockées UTC et remplacées transactionnellement sous verrou utilisateur. Les dates ambiguës/inexistantes DST restent refusées. Les tâches peuvent être déplacées manuellement ; une proposition intelligente ajoute des séances sans modifier celles déjà enregistrées.

Proposer ne persiste aucun planning : fournisseur derrière PlanningGenerator, réponse strictement validée par Zod et vérification des créneaux/matières/examens. La confirmation explicite renvoie le même programme lors d’un retry avec le même requestId et le même contenu normalisé. Une clé réutilisée avec un contenu différent est refusée. La transaction finale verrouille l’utilisateur et revérifie disponibilité, propriété, futur, examens et collisions. Les changements de disponibilité et les créations/modifications de tâches prennent ce même verrou. Aucun accès SQL ou outil n’est fourni au modèle.

AI_PROVIDER=mock emploie un ordonnanceur déterministe annoncé comme simulation, sans appel réseau. AI_PROVIDER=openai utilise l’adaptateur Responses, store=false, JSON Schema strict, timeout et retries bornés par la configuration existante. Les générations réelles réservent une unité dans le quota quotidien partagé AIUsage avant l’appel et enregistrent statut/tokens sans prompt. Les erreurs n’insèrent pas de tâches et ne déclenchent pas de substitution silencieuse. Aucun appel OpenAI réel pendant la recette ; coût distant laissé inconnu. La recette externe avec une clé de test reste à faire.

Les statistiques proviennent uniquement des tentatives soumises et révisions effectives du compte connecté. Les tâches prévues/terminées ne deviennent pas artificiellement des Revision. Les totaux sont historiques ; affichage des 100 derniers scores et 50 derniers événements ; activité par jour UTC sur 7/30 jours glissants. La progression par matière exprime la moyenne et le dernier score observés, pas une probabilité de maîtrise. Les durées nouvelles sont déclaratives et bornées ; les anciennes restent nulles. Les cartes archivées sont exclues des boîtes actives mais leurs révisions restent comptées.

Les intervalles Leitner passent par défaut à 1/3/7/14/30 conformément à la demande explicite. Les échéances existantes ne sont pas recalculées. Les nouvelles cartes restent immédiatement dues, pour conserver le premier apprentissage déjà opérationnel ; les délais s’appliquent après chaque réponse. La suppression fonctionnelle est un archivage confirmé, conservant l’historique.

Prisma reste centralisé à la racine. Le manifeste Phase 2.5 demeure historique : le contrôle d’intégrité conserve les empreintes des six anciennes migrations et du seed, autorise le nouveau schéma et les migrations additives. Aucune migration déjà exécutée ne doit être éditée. Les tests imposent revynora_test, jamais de reset/db push.

Recharts 3.10.1 accepte React 19 ; react-is 19.2.3 suit la version React du projet. Les graphiques sont accompagnés de tableaux accessibles, sans animation. Les composants et tokens existants sont réutilisés dans apps/web.

Sources techniques : [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [installation et compatibilité Recharts](https://github.com/recharts/recharts).
