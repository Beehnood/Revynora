# G.1 — Revue finale avant commit

19 octobre 2026. Base inchangée `8c2cbf7e7e5fca9fe16dca2eed9f2688337b9bb5`. Aucun commit, push, déploiement, promotion, migration ou appel à la production.

## Erreur originale et audit après rollback

Défaut confirmé et corrigé : l’échec du second audit pouvait remplacer l’erreur métier initiale. L’écriture est désormais protégée ; son échec émet l’alerte structurée ADMIN_AUDIT_PERSISTENCE_FAILED et l’erreur initiale est relancée. Ni l’exception brute ni son message, les données de requête, les mots de passe et les jetons ne sont envoyés au logger. Les identifiants d’acteur/cible et codes contrôlés permettent le diagnostic.

Quatre tests unitaires vérifient l’identité de l’erreur relancée, le refus de modification de soi-même, l’absence de diagnostic sensible dans les logs et le fonctionnement normal de l’audit après rollback. Un test PostgreSQL provoque une violation de clé étrangère d’audit, sans changer le schéma : la suspension et la suppression de session sont effectivement annulées. Le compte de test reste connecté, aucun faux audit SUCCESS n’est conservé, et l’alerte technique est émise.

La persistance d’un audit en base reste impossible si celle-ci est indisponible. Le logger local signale l’incident ; le routage vers une supervision distante reste une tâche d’exploitation distincte.

## Coordination du PATCH

| API      | Admin  | Résultat des changements d’accès                                                                                                        |
| -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Ancienne | Ancien | ancien contrat, sans garanties G.1                                                                                                      |
| G.1      | Ancien | 400 : confirmation et motif manquants ; aucune mutation ni révocation                                                                   |
| Ancienne | G.1    | l’ancienne validation stricte refuse les champs supplémentaires ; l’UI conserve l’erreur et ne réessaie jamais avec un payload amoindri |
| G.1      | G.1    | contrat confirmé et motif contrôlé ; mutation et audit atomiques                                                                        |

L’ancien contrat est constaté dans la source Git de la base : aucune requête n’est envoyée à une ancienne API en production. Le refus ancien Admin/nouvelle API est testé sur HTTP/PostgreSQL local ; le refus de l’ancienne API est simulé au niveau client pour vérifier l’absence de downgrade/réessai. Les lectures existantes restent disponibles. Aucune compatibilité transparente des mutations n’est revendiquée.

Ordre futur recommandé : fenêtre de maintenance des actions sensibles, API G.1 puis Admin G.1, vérification coordonnée avant réouverture. Si nécessaire, rollback Admin avant rollback API. Aucune de ces opérations n’est exécutée ici. Il ne faut pas rendre les champs facultatifs pour masquer une livraison désynchronisée.

La confirmation UI bloque un double clic tant que la requête est en cours. Le verrouillage des administrateurs est pris dans un ordre déterministe. Deux administrateurs peuvent soumettre des commandes distinctes de suspension : les deux réussites sont auditées avec leurs auteurs/motifs, l’état final reste suspendu et les sessions sont révoquées. Une réactivation ultérieure ne restaure pas les anciennes sessions. Cela ne constitue pas une garantie exactly-once ni un versionnement optimiste ; aucun identifiant de commande unique ou nouveau modèle n’est introduit.

## Séparation CI / déploiement

- Les workflows existants ne lancent aucun déploiement Vercel et n’importent aucun artefact de build pour une livraison.
- Uploads GitHub limités aux couvertures, rapports Playwright et résultats de tests ; ni .next ni .vercel/output ne sont publiés comme artefact de livraison.
- API_URL figure dans le hash Turbo. VERCEL et VERCEL_ENV y sont ajoutés pour empêcher une collision CI/Vercel à origine identique.
- Un dry-run réel de Turbo confirme trois hashes Admin différents : CI loopback, Vercel loopback, Vercel HTTPS.
- Un build Admin avec VERCEL=1 et API_URL loopback est refusé avant compilation ; c’est un test négatif réussi.
- Les builds Admin, Web et Nest réussissent sous Node 24.3.0 avec VERCEL=1, VERCEL_ENV=production et l’origine publique HTTPS attendue, sans cache restauré.
- Les deux routes-manifest.json Next contiennent `/api/v1/:path*` vers `https://api.revynora.watercode.dev/api/v1/:path*`, sans destination localhost, 127.0.0.1 ou ::1.

Une interdiction universelle de copier ou transformer manuellement des fichiers puis d’utiliser `--prebuilt` ne peut pas être garantie par ces seuls workflows. La voie approuvée repart du commit et reconstruit sur Vercel, sans réutilisation des sorties CI. Aucune politique de compte ni configuration distante n’est modifiée pour prétendre une garantie plus large.

## Résultats de la revue

| Contrôle                                                                         | Résultat                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------ |
| API : unitaires et intégration, couverture incluse                               | 82 tests : 44 unitaires, 38 intégrations   |
| Admin : confirmation, compatibilité, double clic, sessions, layout et régression | 21 tests                                   |
| ESLint API/Admin et TypeScript                                                   | réussis                                    |
| Build de livraison HTTPS Admin/Web/API                                           | réussi sous Node 24.3.0                    |
| Garde négatif Vercel/loopback                                                    | refus attendu confirmé                     |
| Trois hashes de cache distincts                                                  | confirmé                                   |
| Manifests Admin et Web                                                           | HTTPS attendu, aucune destination loopback |

108 tests distincts exécutés pendant cette revue, dont 5 tests de non-régression du contrôle des frontières. Les 43 tests Web réussis à la recette initiale ne sont pas recomptés comme relancés ; le build Web et son contrôle TypeScript sont bien réexécutés.

Couverture : API 95,06 % lignes / 87,24 % branches / 98 % fonctions ; Admin 98,25 % lignes / 93,79 % branches / 90 % fonctions. Seuils inchangés, aucun nouveau fichier exclu.

Les intégrations imposent revynora_test sur loopback, avec données synthétiques créées par les tests. Les nouveaux audits de fixtures sont nettoyés par identifiants propres. Aucun dump de production n’est importé, aucune migration ni reset n’est exécuté. L’origine HTTPS publique est seulement une configuration de compilation, pas une source de données de test ; aucune requête distante de test n’est lancée.

Le contrôle des frontières confondait `../admin` dans le backend avec l’application `apps/admin`. Il résout désormais les chemins relativement au fichier importeur et vérifie l’application réellement ciblée. Les tests de l’outil autorisent ce module interne mais refusent les véritables imports inter-applications, les imports d’application depuis un package et les dépendances Nest du client portable. Ils sont aussi exécutés par la CI Quality. Il ne s’agit pas d’une exception ajoutée pour contourner le contrôle.

Le périmètre reste G.1 : rôles, guards et schéma Prisma inchangés ; aucune page de gestion du lot G.2 ajoutée. GO local pour création du commit après autorisation. Les recettes navigateur/lecteur d’écran et toute livraison distante restent séparées.

Preuves locales : `/private/tmp/revynora-g1-i_c37ydm/review-*.log`, `release-proof.json`, `release-cache-proof.json` et `lot-g1-final.patch`.
