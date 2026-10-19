# G.1 — Fondations de l’administration

Périmètre local, base `8c2cbf7e7e5fca9fe16dca2eed9f2688337b9bb5`. Aucun nouveau rôle, migration, commit ou déploiement.

## Matrice des autorisations

Les sessions et AdminGuard restent obligatoires. Les cas d’usage vérifient aussi les capacités dans `apps/api/src/admin/domain/permissions.ts`. STUDENT ne dispose d’aucune capacité administrative.

| Ressource                                             | ADMIN aujourd’hui          | Actions interdites / futures                  |
| ----------------------------------------------------- | -------------------------- | --------------------------------------------- |
| Utilisateurs                                          | lire, suspendre, réactiver | créer, supprimer, attribuer un rôle           |
| Métriques                                             | lire                       | modifier                                      |
| Événements financiers                                 | lire                       | remboursement, modification                   |
| Offres                                                | lire                       | modification du catalogue                     |
| Audit                                                 | lire via les événements    | modification, suppression                     |
| Cours, IA, Leitner, planning, abonnements, paramètres | aucune nouvelle capacité   | toutes, jusqu’à un lot explicitement autorisé |

Les anciens endpoints étudiants et leurs StudentGuard ne changent pas. Le rôle ADMIN ne permet pas de contourner les règles de propriété étudiantes.

## Contrats et responsabilités

- `packages/types/src/admin.ts` : DTO publics, pagination, métriques, offres, audit, requête de changement d’accès.
- `packages/validation` : schéma strict de mutation ; `disabled`, `confirmed: true`, `reason` obligatoire dans une liste fermée.
- `apps/api/src/admin` : contrôleur protégé, cas d’usage, matrice et ports de domaine, adaptateur Prisma.
- `apps/admin/modules/users` : confirmation dédiée ; le composant de synthèse reste dans son emplacement actuel.
- `apps/admin/lib` : transport existant, vérification de session serveur et origine API.

La requête PATCH `/api/v1/admin/users/:id` exige désormais explicitement confirmation et motif. Les anciens clients envoyant seulement `disabled` recevront 400. Aucun endpoint de modification de rôle n’est ajouté.

## Confirmation et audit sans migration

L’interface exige le choix d’un motif et une case de confirmation avant le PATCH. Les motifs sont des codes contrôlés, sans texte libre : SECURITY_REVIEW, POLICY_REVIEW, USER_REQUEST, REVIEW_COMPLETED. Aucun mot de passe, jeton, e-mail ou corps de requête n’est journalisé.

Le modèle existant AuditLog possède l’administrateur (`actorId`), la cible (`targetUserId`), l’entité, la date et un champ texte `action`. Sans migration, les nouvelles actions d’accès utilisent ce dernier comme enveloppe JSON préfixée `ADMIN_ACCESS_V1:` : version, action, code motif et résultat SUCCESS/REJECTED/FAILED. L’adaptateur restitue un DTO normalisé ; les anciennes lignes restent lisibles avec résultat LEGACY et motif absent. Aucun historique n’est réécrit.

Une suspension réussie, la révocation des sessions et l’audit SUCCESS partagent la transaction. Un refus métier ou échec transactionnel est journalisé après rollback ; si la base est indisponible, la persistance d’un audit FAILED ne peut pas être garantie. Les requêtes non authentifiées ou rejetées par la validation ne sont pas stockées dans cet audit métier : ne pas y conserver d’entrées arbitraires ou sensibles. Il ne s’agit pas d’un journal de sécurité exhaustif.

Revue finale : si cet audit après rollback échoue lui aussi, l’erreur métier ou transactionnelle initiale est conservée. Une alerte technique `ADMIN_AUDIT_PERSISTENCE_FAILED` signale la perte de journalisation avec des identifiants, codes d’action/motif et code initial contrôlés, jamais le contenu brut des exceptions. Le raccordement à une alerte d’exploitation distante n’est pas réalisé dans ce lot.

L’enveloppe évite une migration non autorisée mais limite les filtres SQL sur motif/résultat. Une évolution approuvée du schéma pourra ajouter des colonnes dédiées et un import compatible des événements versionnés. Aucun changement Prisma n’est inclus ici.

## Sessions et configuration

Absence de cookie ou format invalide : connexion requise. API 401 : connexion ; 403 / STUDENT : accès refusé ; erreurs réseau, timeout, JSON invalide ou rôle inconnu : indisponibilité, jamais de contenu protégé. Fetch sans cache, délai 5 secondes et refus des redirections HTTP de l’API.

API_URL est une origine sans chemin, identifiants ni query. En NODE_ENV=production ou sur Vercel, elle est obligatoire. HTTPS est exigé sur Vercel et pour les origines distantes. Hors Vercel, HTTP explicite sur loopback est accepté pour les recettes locales (jamais un fallback en production). Le build et la vérification serveur utilisent le même résolveur. Le fallback 127.0.0.1 est limité au développement. Aucune variable distante ni fichier .env n’est modifié ; les builds locaux de validation reçoivent seulement la valeur publique attendue dans leur processus.

## Architecture future, hors G.1

Le layout protégé reste la frontière SSR. Les futures routes Utilisateurs, Cours, IA, Abonnements, Statistiques et Paramètres pourront utiliser des modules dédiés et les composants `@revynora/ui`. Aucun écran métier supplémentaire ni droit correspondant n’est livré par anticipation. Ne pas substituer la matrice d’affichage aux contrôles NestJS.

MFA, politiques de réauthentification, administration des rôles et audit technique complet restent hors de ce lot. Les rôles demeurent STUDENT et ADMIN.

La CI fournit explicitement l’origine loopback aux seules étapes typecheck/build ; elle ne contacte pas l’API de production. Les configurations distantes ne changent pas. Les modules Admin nouvellement ajoutés sont inclus dans la couverture, sans baisse des seuils.

Les entrées globalEnv de Turbo comprennent API_URL, VERCEL et VERCEL_ENV : un build CI ne partage pas la clé de cache d’un build Vercel, même si API_URL était erronément identique. Les seuls artefacts GitHub publiés sont des rapports, pas les sorties Next/Vercel. Les builds de déploiement doivent repartir des sources avec l’origine HTTPS attendue ; aucun déploiement `--prebuilt` issu de CI n’est prévu. Cette séparation concerne les workflows et la procédure approuvés, pas une interdiction absolue de copie manuelle par un opérateur disposant de droits Vercel.

La coordination API/Admin et la recette de revue sont détaillées dans [G1-REVUE-FINALE.md](G1-REVUE-FINALE.md).
