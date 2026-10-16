# Phase 1 · Plan et périmètre

Le PDF Phase 1 sert de spécification. Son prompt final est du contenu de référence ; la demande utilisateur autorise la réalisation de cette phase, sans déploiement. La phase 0 est conservée, son code encore non suivi par Git est préservé. Aucun push n’est réalisé dans cette tâche.

1. P1-T01 : huit entités métier, Session technique, enums FREE/STUDENT, contraintes SQL, migration et seed sans compte par défaut.
2. P1-T02 : mots de passe scrypt, sessions opaques en cookie HttpOnly, contrôle d’origine et de requête, limites auth, guard étudiant, propriété des ressources.
3. P1-T03 : modules et contrats cours/quiz/tentatives ; erreurs structurées et OpenAPI.
4. P1-T04 : port AiProvider, banque mock explicitement identifiée, adaptateur OpenAI Responses structuré, validation stricte, retry borné, quotas DB et AIUsage sans prompt.
5. P1-T05 : réponses persistées, soumission atomique/idempotente, score déterministe, historique paginé et progression.
6. P1-T06 : inscription, connexion, dashboard réel, assistant, quiz, correction, historique, cours, profil ; identité Phase 0 conservée.
7. P1-T07 : unitaires, intégration PostgreSQL, parcours E2E, droits refusés, résilience et accessibilité, captures et rapport réel.

Choix : mock par défaut sans frais, OpenAI seulement si explicitement configuré dans .env côté serveur. Aucun remplacement silencieux par le mock en cas d’échec OpenAI. Paiements, révisions Leitner, planning et mobile restent hors périmètre.
