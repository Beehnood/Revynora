# Audit Phase 3 — Leitner, planning et progression

Référence : c99b400 ; branche feature/phase-3-leitner-planning ; restauration restore/phase-3-20261017. Aucun AGENTS.md applicable trouvé. Cahier global lu dans Downloads, ADR, workflow, design system et recettes précédentes consultés. La demande explicite remplace la Phase 3 Mobile de la roadmap globale : aucun écran natif ou nouveau métier Admin.

Disponible : quatre applications indépendantes, client API et UI partagés, sessions, diagnostics notés côté serveur, contrats Zod, périodes d'abonnement contrôlées côté API. Prisma contient User/Course/Quiz/QuizAttempt/Revision/LeitnerCard/StudyPlan/StudyPlanItem. Leitner CRUD par archivage, échéances, verrou de ligne, version et requestId ; tâches UTC/fuseau IANA, conflit, versions immuables et rappels Pro déjà fonctionnels. Préserver ces parcours.

Manques : intervalles demandés 1/3/7/14/30 (existants 1/2/4/8/16), confirmation archivage, matière des cartes dans l'UI, priorités, examens, disponibilités, modification de titre de programme, propositions IA validées puis confirmées, statistiques consolidées et dashboard réel. Le planning reste Pro et Leitner Plus/Pro ; progression accessible à tous.

Migration additive prévue : attributs de tâche/matière/priorité, temps déclaré des révisions (anciennes durées inconnues conservées nulles), créneaux de disponibilité. Les examens seront des StudyPlanItem de type EXAM pour conserver le modèle. Ne pas reconstruire les tables ni modifier les anciennes migrations. Deux migrations antérieures FREE/history et task_versions restent en attente sur la base normale ; tests sur revynora_test uniquement au départ. Le gel Prisma de Phase 2.5 sera remplacé par un contrôle de conservation des migrations historiques, qui autorise les évolutions additives de cette phase.

Ordre : T01 modèle ; T02 règles/API Leitner ; T03 UI Leitner ; T04 planning enrichi ; T05 calendrier ; T06 IA ; T07 progression ; T08 recette complète. Vérifier chaque ticket avant le suivant. Les limites des suites précédentes (couverture, E2E réels, Admin séparé) restent inchangées.
