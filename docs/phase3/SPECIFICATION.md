# PHASE 3 — Système Leitner, Planning intelligent et Progression

## Mission Codex

Tu es un développeur senior spécialisé en Next.js, NestJS, TypeScript, Prisma, PostgreSQL, Clean Architecture, DDD et applications SaaS éducatives.

Tu dois développer la Phase 3 de notre application éducative IA dans le monorepo existant.

Les phases 0, 1, 2 et la réorganisation modulaire 2.5 sont supposées terminées, mais tu dois vérifier leur état réel.

**Ne reconstruis pas le projet et ne modifie pas les fonctionnalités déjà opérationnelles.**

## 1. Audit obligatoire

Avant de coder :

1. Examine la structure du monorepo.
2. Lis `AGENTS.md` et les documents techniques existants.
3. Identifie les applications `apps/api`, `apps/web`, `apps/admin` et `apps/mobile`.
4. Analyse `schema.prisma`, les migrations, les contrôleurs et les services existants.
5. Identifie les entités `User`, `Course`, `Quiz`, `QuizAttempt`, `Revision`, `LeitnerCard`, `StudyPlan` et `StudyPlanItem`.
6. Vérifie les contrats API et les packages partagés.
7. Vérifie les tests existants.

Présente un bref bilan des éléments disponibles et des éléments manquants.

## 2. Backend — apps/api

Respecte la Clean Architecture et le DDD pragmatique.

### Module Leitner

Développe la gestion des flashcards avec cinq boîtes :

| Boîte | Délai avant la prochaine révision |
| ----- | --------------------------------- |
| 1     | 1 jour                            |
| 2     | 3 jours                           |
| 3     | 7 jours                           |
| 4     | 14 jours                          |
| 5     | 30 jours                          |

Règles :

- Toute nouvelle carte commence en boîte 1.
- Une bonne réponse fait avancer la carte d'une boîte.
- Une mauvaise réponse la renvoie à la boîte 1.
- Une carte en boîte 5 reste en boîte 5 après une bonne réponse.
- Chaque révision génère une entrée d'historique.
- La prochaine révision est automatiquement calculée.
- Les intervalles doivent être configurables.
- Les opérations concurrentes doivent éviter les doublons et les mises à jour incohérentes.

Prévois des endpoints REST pour créer, lire, modifier et supprimer des cartes, récupérer les cartes dues et enregistrer les révisions.

### Module Planning

Utilise `StudyPlan` et `StudyPlanItem`.

Développe :

- Création et modification des plannings.
- Gestion des tâches de révision.
- Gestion des dates d'examen.
- Priorités et statuts des tâches.
- Disponibilités de l'étudiant.
- Détection des tâches en retard.
- Réorganisation du planning.

### Planning intelligent IA

Pour les utilisateurs Pro, l'IA doit proposer une organisation personnalisée à partir :

- Des matières étudiées.
- Des résultats aux QCM.
- Des connaissances insuffisamment maîtrisées.
- Des prochaines révisions Leitner.
- Des dates d'examen.
- Des disponibilités de l'étudiant.

La réponse IA doit être validée avec Zod avant d'être enregistrée.

L'IA ne doit jamais modifier directement la base de données.

### Statistiques

Prépare les indicateurs suivants :

- Nombre total de révisions.
- Progression par matière.
- Évolution des scores des QCM.
- Répartition des cartes Leitner.
- Temps consacré aux révisions.
- Taux de réussite.
- Activité hebdomadaire et mensuelle.

Les statistiques doivent provenir des données réelles.

## 3. Frontend Web — apps/web

Développe trois interfaces principales.

### Page Leitner

Afficher :

- Les cinq boîtes Leitner.
- Le nombre de cartes dans chaque boîte.
- Les cartes à réviser aujourd'hui.
- Les prochaines dates de révision.
- Le bouton « Commencer une révision ».

L'interface d'une flashcard doit comprendre le recto, un bouton de révélation, le verso, les actions « Je savais » et « À revoir », ainsi qu'un indicateur de progression.

### Page Planning

Créer un calendrier responsive avec :

- Vue mensuelle.
- Vue hebdomadaire.
- Liste des tâches.
- Dates d'examen.
- Ajout et modification des tâches.
- Filtres par matière.
- Identification des révisions en retard.
- Génération de planning IA pour les utilisateurs Pro.

### Page Progression

Développe un dashboard comprenant :

- Cartes KPI.
- Graphique d'évolution des scores.
- Graphique des révisions.
- Répartition des cartes Leitner.
- Progression par matière.
- Historique d'activité.

Utilise Recharts si cette bibliothèque est compatible avec le projet existant.

## 4. UI/UX

Réutilise exclusivement le design system existant.

Respecte :

- La charte graphique des phases précédentes.
- Les composants shadcn/ui existants.
- Les états loading, empty, success et error.
- Le responsive desktop, tablette et mobile.
- Les interactions accessibles au clavier.
- Les confirmations avant suppression.
- La cohérence de navigation du dashboard étudiant.

Ne crée pas une deuxième bibliothèque de composants inutilement.

## 5. Séparation des applications

**apps/api**

Contient les modules NestJS, les règles métier, Prisma, les services IA et les contrôles d'accès.

**apps/web**

Contient uniquement l'interface étudiant et les appels à l'API via le client partagé.

**apps/admin**

Ne développe pas de nouvelles fonctionnalités administrateur pendant cette phase. Préserve l'application existante.

**apps/mobile**

Ne développe pas encore les écrans mobiles natifs. Préserve la structure Expo et prépare la compatibilité des contrats API.

**packages/**

Réutilise les types, schémas de validation et clients API partagés sans exposer les modèles internes du Backend.

## 6. Gestion des droits

Applique les restrictions côté Backend :

- Free : tests et révisions classiques.
- Plus : fonctionnalités Free et système Leitner.
- Pro : fonctionnalités Plus, planning intelligent et rappels avancés.

L'accès à une page masquée dans le Frontend ne constitue pas une protection suffisante.

Ne développe pas Stripe dans cette phase. Utilise le mécanisme d'autorisation déjà présent, sans inventer de paiement ou d'abonnement actif.

## 7. Tests

Ajoute les tests nécessaires pour vérifier :

- Le passage entre les cinq boîtes.
- Le calcul des dates de révision.
- La gestion des mauvaises réponses.
- La création et la modification des tâches.
- La validation des réponses IA.
- Les permissions des abonnements.
- L'interdiction d'accéder aux données d'un autre utilisateur.
- La cohérence entre Frontend et Backend.
- L'absence de régression des phases précédentes.

Exécute les commandes existantes de lint, typecheck, tests et build.

## 8. Ordre d'implémentation

Développe progressivement :

1. Audit du dépôt.
2. Vérification et adaptation non destructive du modèle Prisma.
3. Règles métier Leitner.
4. API Leitner et tests.
5. Interface Leitner.
6. API de planification.
7. Calendrier Web.
8. Génération de planning IA.
9. Dashboard de progression.
10. Vérification des permissions et tests finaux.

Travaille dans une branche dédiée `feature/phase-3-leitner-planning`.

## 9. Livrables

À la fin, fournis :

- La liste des fonctionnalités implémentées.
- Les fichiers modifiés.
- Les éventuelles migrations Prisma.
- Les endpoints API.
- Les résultats des tests.
- Les problèmes ou limites identifiés.
- Les commandes de lancement.
- Les fonctionnalités restant à développer dans les phases suivantes.

**Critère de validation final :** un utilisateur Plus ou Pro peut gérer et réviser ses flashcards Leitner, et un utilisateur Pro peut gérer son planning et obtenir des propositions personnalisées de l'IA. Les statistiques doivent refléter les données réelles et les fonctionnalités précédentes doivent continuer à fonctionner.

Commence par l'audit, puis implémente les étapes dans l'ordre sans effectuer d'opérations destructives.
