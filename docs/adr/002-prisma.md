# ADR 002 · PostgreSQL et Prisma

Statut : accepté.

PostgreSQL 17 en Compose, Prisma 6.19 et une migration SQL versionnée. La table FoundationCheck vérifie le socle de migration ; elle ne représente pas le modèle métier cible. Aucun des 16 objets métier n’est anticipé. Les paquets de types et validation n’importent pas Prisma.

La liveness est indépendante de PostgreSQL. La readiness exécute SELECT 1 et répond 503 sans détail technique en cas d’échec. Le client est fermé à l’arrêt. Le schéma complet, les sauvegardes et les connexions de production seront définis plus tard.

## Évolution Phase 1

La migration 20261016010000_learning ajoute les huit entités pédagogiques et Session, conformément au PDF Phase 1 ; le reste du modèle cible demeure différé. Les règles de génération et soumission sont décrites dans [ADR 005](005-ia-pedagogie.md).
