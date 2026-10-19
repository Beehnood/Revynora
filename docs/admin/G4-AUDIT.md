# G.4 — Audit préalable des cours

Base Git `f3039df3e7471c58198f6d01a53f81a80832e8e9`, dépôt initialement propre. Audit des sources uniquement, aucune inspection ou modification de production, aucun seed exécuté.

## Modèle existant

Course contient id, ownerId nullable, title, domain (texte, aucune table Matière), content (texte), source USER/AI/ADMIN et createdAt. Relations : propriétaire User, Quiz, cartes Leitner, révisions et tâches de planning. Les relations ne constituent pas des informations de catalogue et ne seront pas chargées. Aucun état publié/brouillon, archivage ou workflow éditorial n'existe.

La migration historique `20261016010000_learning` ajoute la contrainte SQL `Course_owner` : `(source = 'ADMIN' AND ownerId IS NULL) OR ownerId IS NOT NULL`. Les cours USER/AI sans propriétaire sont donc interdits en base ; les tests vérifient ce rejet sans retirer la contrainte. Des cours ADMIN avec propriétaire sont possibles dans le modèle mais ne font pas partie du catalogue. La lecture vérifie toujours les deux critères même avec cette défense SQL.

Le seed optionnel fournit un cours éditorial explicite avec source ADMIN et ownerId null. LearningService.courses rend déjà accessible ce même sous-ensemble à chaque étudiant. Les lecteurs Planning utilisent aussi cette règle. Cela démontre une ressource globale existante, sans prouver la présence de lignes en production ; une base sans catalogue doit simplement afficher un état vide.

## Endpoints existants

- GET /api/v1/courses : StudentGuard ; cours USER du compte, catalogue ADMIN sans propriétaire, et cours AI du compte avec tentative soumise. Pagination ; aucune recherche Admin.
- POST /api/v1/courses : StudentGuard ; schéma strict title/domain/content, propriétaire imposé par le serveur au compte et source USER. Aucun source/ownerId fourni par le client n'est accepté.
- Les diagnostics créent des cours AI appartenant à leur étudiant. Les quiz et tentatives ont leurs propres vérifications de propriété.
- Aucun endpoint Admin de lecture ou mutation de cours avant G.4. La matrice G.1 conserve courses: [], donc le rôle ADMIN n'autorise pas à consulter tous les cours.

## Périmètre légitime retenu

L'autorisation G.4 permet explicitement une consultation du catalogue, donc ajout d'une capacité nommée catalogCourses/read exclusivement. STUDENT ne reçoit aucune capacité Admin. courses: [] reste inchangé ; aucune permission implicite sur les contenus privés.

Liste et fiche filtrent toujours la conjonction source ADMIN ET ownerId null côté base. Toute ligne USER, AI, ADMIN avec propriétaire, ou sans propriétaire mais d'une autre source, est exclue de la liste et renvoie 404 par identifiant, au même titre qu'une ressource absente. Les paramètres ne permettent pas d'élargir ce filtre.

Champs : liste id/title/domain/source/createdAt ; fiche avec content en plus. Aucun propriétaire, e-mail, activité, réponse, quiz, carte, statistique ou relation utilisateur. Le contenu est affiché comme texte, pas HTML exécuté.

## Limites de lecture

Recherche littérale insensible à la casse sur titre/matière, 100 caractères maximum ; page 1..10000 et taille fixe de 20. Tri createdAt/id descendant déterministe. Pas de contenu dans la liste. Projections SQL LEFT bornées ; titres de 160, matière de 80 et contenu de 10000 unités UTF-16 au maximum dans la réponse. Une ressource excessive est refusée explicitement (422), jamais silencieusement tronquée. Le plafond de contenu reprend la borne du schéma de création existant ; ce plafond n'implique aucun droit d'édition. Les caractères multi-octets peuvent déclencher la borne UTF-16 plus tôt, conformément à la mesure JavaScript du schéma.

Agrégats/liste et fiche : requêtes paramétrées, délai SQL 5 s local à la transaction, transaction 12 s et attente 3 s. Index Course(ownerId, createdAt) disponible, mais recherche de sous-chaîne et comptage peuvent scanner le catalogue ; limites de sortie et timeouts ne constituent pas une preuve de performance à grande échelle. LEFT borne la quantité de texte transférée, pas nécessairement le coût de lecture/décompression d’une très grande valeur PostgreSQL. Aucune migration/index anticipé.

## Opérations interdites

Pas de création, publication, édition, suppression, modification de source/propriétaire, accès aux cours privés, consultation des diagnostics individuels ni manipulation des données pédagogiques. Ces opérations exigent un cadrage et une autorisation distincts. StudentGuard et tous les endpoints étudiants restent inchangés. G.5 n'est pas commencé.

## Dernière revue : Unicode et refus explicites

Les plafonds sont mesurés en unités UTF-16 JavaScript : titre 160, matière 80, contenu 10000. Un caractère supplémentaire (par exemple 😀 ou 𐐀) compte pour deux unités ; un accent combiné peut aussi compter pour plusieurs unités. Il ne s'agit pas d'un nombre de graphèmes visibles.

PostgreSQL LEFT compte les caractères Unicode, pas les unités UTF-16. La projection N+1 est néanmoins une sentinelle sûre : chaque caractère PostgreSQL occupe au moins une unité UTF-16. Si la source dépasse N+1 caractères, la projection dépasse nécessairement N unités et est refusée ; sinon elle est lue intégralement avant validation. Toute valeur acceptée est donc complète, sans découpage de paire de substitution ni troncature silencieuse.

Un titre ou une matière excessive dans les 20 lignes sélectionnées fait échouer toute cette page avec 422 CATALOG_LIMIT et le message « Ce cours dépasse les limites de consultation du catalogue. ». Aucun résultat partiel ni exclusion silencieuse n'est renvoyé. Cela peut bloquer la page concernée jusqu'à une décision éditoriale distincte ; réduire la recherche ou consulter une autre page peut éviter la ligne excessive. Un contenu excessif bloque uniquement sa fiche : la liste ne charge pas content. Le filtre de confidentialité reste appliqué avant projection et validation ; une fiche privée excessive reste 404.

Aucune correction applicative nécessaire. Tests ajoutés dans les deux fichiers G.4 existants : limites exactes et dépassement d'une unité pour ASCII, emoji, caractère supplémentaire et accent combiné, restitution intégrale, refus de page partielle, message 422 explicite et fiche privée masquée.
