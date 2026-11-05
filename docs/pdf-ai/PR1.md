# PR 1 — Import PDF et analyse pédagogique

Branche : `feature/pdf-ai-analysis`, issue de main `9cc98c3`.
Périmètre : import, extraction réelle, analyse IA structurée, citations paginées,
consultation privée, suppression et quota. Aucun quiz, score ou niveau de maîtrise
n'est inventé. Les diagnostics documentaires, modes avec quiz et personnalisation
restent PR 2 et PR 3 ; le diagnostic thématique existant reste disponible.

## Réutilisation et décisions

- NestJS, DatabaseService/Prisma et transactions PostgreSQL existants.
- LearningAccessGuard et GetLearningAccess pour les droits commerciaux et internes.
  Un ADMIN sans attribution G.8 reste interdit ; aucune permission créée.
- Fournisseur OpenAI déjà présent, même configuration et conventions Responses.
  Le service dédié au document n'utilise pas la banque de quiz Mock.
- Composants UI, hook useResource, client HTTP, espace /app/cours et export privé.
- Aucun parseur/import PDF ni analyse documentaire paginée n'existait dans ces modules.
- PDF.js 6.5.438 (Apache-2.0), dépendance gratuite et épinglée. Node >=22.13 requis ;
  Node 22.18 de l'image existante et Node 22 de CI conviennent. Pas de stockage
  objet ni nouveau service payant. Le fournisseur IA existant reste facturé selon
  le contrat de l'exploitant ; aucun appel payant effectué pendant cette mission.

## Contrat API

Toutes les routes sont protégées par LearningAccessGuard, session, absence de
suspension et CSRF existant. Aucun changement des protections ou du cache no-store.

| Route                              | Fonction                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| GET /api/v1/documents/config       | disponibilité réelle, quota et limites                      |
| POST /api/v1/documents             | multipart, champ unique file ; retourne le document extrait |
| GET /api/v1/documents?page=1       | dix documents privés par page                               |
| GET /api/v1/documents/:id          | état et analyse, sans restituer le texte intégral           |
| POST /api/v1/documents/:id/analyze | analyse réelle, une tentative explicite                     |
| DELETE /api/v1/documents/:id       | effacement du texte et du résultat                          |

Les propriétaires sont imposés depuis la session et toutes les recherches sont
filtrées par userId. Une ressource tierce retourne 404. Les fichiers identiques
(SHA-256 par utilisateur) sont dédupliqués, y compris lors d'importations concurrentes.
Pas d'URL externe, de fichier servi publiquement ni de chemin issu du nom fourni.

## Limites et PDF non pris en charge

- 3 Mio, 25 pages, 60 000 caractères extraits, 50 documents actifs par utilisateur.
  Cette taille garde de la marge sous la limite de requête du frontend hébergé.
- Avant allocation multipart : deux imports simultanés par processus, un par utilisateur,
  durée totale de requête bornée à trente secondes. Une requête supplémentaire
  reçoit 429 avant buffering.
- Extraction dans un worker Node séparé : dix secondes, heap V8 128 Mio,
  deux extractions simultanées par processus API. Aucun rendu ou OCR.
- Refus : format/MIME/extension incohérents, fichiers protégés, JavaScript,
  pièces jointes, annotations actives ou liens, trop complexes, trop longs,
  sans texte exploitable. Les scans doivent être OCRisés par l'utilisateur.
- PDF.js reçoit des octets locaux seulement, eval désactivé, sans chargement de
  ressources via URL, rendu, polices distantes ou exécution d'actions PDF.
- Les limites V8 ne remplacent pas une isolation OS ni un antivirus. Avant
  livraison, vérifier PDF.js et ses avis de sécurité, les limites mémoire/PIDs/CPU
  du conteneur et l'extraction dans l'image Linux arm64 réellement livrée.
- stdout/stderr du parseur sont absorbés. Les erreurs API sont génériques ; ni
  texte PDF, réponse fournisseur, clé ou URL de connexion n'est journalisé.

## Analyse réelle et références

`AI_PROVIDER=openai`, `OPENAI_API_KEY` et `OPENAI_MODEL` existants sont utilisés
uniquement côté API. `AI_TIMEOUT_MS` borne la requête (y compris la lecture de la
réponse), sortie <=7 000 tokens, corps reçu <=150 000 caractères. Aucun outil,
URL utilisateur ou action distante dans le prompt. Le contenu du PDF est une
entrée JSON non fiable, distincte des instructions ; ses injonctions sont ignorées.

Résultat validé avec Zod : titre, chapitres, objectifs, notions, synthèses et
références. Chaque citation doit apparaître sur la page annoncée, après
normalisation des espaces. Une citation inventée ou une réponse refusée/incomplète
échoue sans exposer le diagnostic fournisseur. Cette vérification ne prouve pas
l'exactitude de toute synthèse : l'interface demande de contrôler les sources.
React affiche du texte échappé, sans HTML ou Markdown fournisseur exécutable.

Mock ou IA non configurée : import/consultation possibles, analyse indisponible
explicitement. Aucun résultat simulé produit par le chemin documentaire.
`store:false` est envoyé ; la politique de rétention du compte fournisseur doit
être vérifiée par l'exploitant, ce paramètre ne promet pas une rétention nulle.
Documentation : [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
et [PDF.js](https://mozilla.github.io/pdf.js/api/draft/api.js.html).

## Quota, concurrence et reprises

FREE : trois nouvelles analyses par semaine, du lundi 00:00 UTC au lundi suivant.
Les comptes Plus/Pro n'ont pas de plafond hebdomadaire fixe. Politique raisonnable
commune : vingt tentatives par jour UTC, trois par document, une analyse active
par utilisateur. Les résultats déjà créés restent consultables sans consommer.
Aucun prix ou contrat commercial n'est modifié.

La réservation verrouille la ligne User, contrôle les réservations et écrit l'état
PROCESSING + journal de tentative dans la même transaction. L'appel IA a lieu
après libération du verrou. Un résultat déjà terminé est renvoyé sans autre appel.
Le PDF ayant échoué est conservé, sa réservation hebdomadaire est libérée ; les
reprises gardent le même identifiant et ne décomptent pas deux fois le quota.
La limite quotidienne compte aussi les échecs, sans compter leur texte.

Pas de retry fournisseur automatique. Après arrêt du processus, une tentative
bloquée peut être reprise explicitement après cinq minutes. Un jeton de bail
empêche un ancien résultat de remplacer celui d'une nouvelle tentative.
Le fournisseur pourrait avoir facturé une requête échouée ou interrompue : ce
mécanisme garantit le quota applicatif, pas le remboursement du fournisseur.
La suppression durant une analyse annule son enregistrement et conserve sa
réservation ; les anciennes réponses ne peuvent pas restaurer un document supprimé.

## Stockage et suppression

Les octets PDF bruts restent uniquement en mémoire pendant l'extraction puis sont
relâchés ; aucun fichier PDF sur disque/objet ni antivirus distant. Le texte
paginé et l'analyse sont stockés en PostgreSQL jusqu'à suppression par l'étudiant.
Après suppression : pages, résultat et hash du contenu effacés, nom remplacé,
ligne réduite aux métadonnées de quota et au journal de tentatives. Ces traces
restent jusqu'à suppression du compte pour empêcher la fraude au quota.
La suppression de compte les efface en cascade. L'export privé inclut les
documents non supprimés. Les sauvegardes suivent la rétention existante de
l'exploitant ; la suppression active ne réécrit pas les sauvegardes historiques.

## Validation et livraison future

Nouvelle migration additive `20261105000000_pdf_analysis` : PdfDocument et
PdfAnalysisRequest. Les douze migrations historiques et les données commerciales
restent intactes. Migration appliquée uniquement au PostgreSQL local de test,
jamais à Oracle. Le disque Docker étant plein, les tests utilisent un PostgreSQL
17.6 et un Redis 7.4.6 dédiés en mémoire, sans supprimer d'image/volume existant.

Tests ajoutés : PDF texte réel, pagination, fichiers actifs/scannés/incohérents,
limites et saturation ; contrat fournisseur, citations, indisponibilité ; HTTP
session/CSRF/G.8, propriété, quota concurrent, non-remboursement après suppression,
reprise, limites journalières, Plus/Pro, déduplication, cascade ; UI états,
import multipart, sources, reprise ; client HTTP conserve CSRF et cookies.
Les sorties IA synthétiques sont uniquement des doublures de tests.

Avant Production, après revue et autorisations distinctes :

1. CI et recette de l'image Linux arm64 avec la nouvelle dépendance native PDF.js.
2. Recette d'un vrai PDF représentatif avec fournisseur réel et budget explicite,
   sans envoyer de document sensible. Aucune clé réelle disponible/utilisée ici.
3. Sauvegarde/validation de la migration additive puis livraison API avant Web.
   Ne pas appliquer la migration pendant un build Vercel. Garder les anciennes
   données ; ne pas supprimer les tables ou restaurer par-dessus de nouvelles écritures.
4. Confirmer la politique de rétention et de traitement des documents, les limites
   du proxy et l'usage raisonnable. Configurer la clé uniquement sur l'API.
5. Déployer le Web sur autorisation séparée, puis recette propriétaire/isolement
   et supervision agrégée. Aucun changement de prix, Stripe, ADMIN, G.8/G.9 ou
   worker ne fait partie de PR 1.

Résultats locaux de cette implémentation :

- API : 28 fichiers, 178 tests réussis ; couverture lignes/statements 95,25 %,
  branches 88,53 %, fonctions 97,85 % ; seuils existants inchangés.
- Web : 22 fichiers, 189 tests réussis, dont cinq nouveaux tests PDF.
- Client API : quatre tests réussis, dont le contrat multipart.
- TypeScript API/Web, ESLint API/Web/client, builds API/Web avec variables Vercel
  et Admin false, Prettier des fichiers concernés, Actionlint, git diff --check,
  frontières des workspaces et intégrité Prisma : réussis.
- Le premier passage complet a échoué sur le seul test BullMQ historique faute
  de Redis configuré ; le passage avec Redis dédié a réussi, sans modification
  ni désactivation du test. Le premier PostgreSQL de test a échoué à initdb
  (disque Docker plein) ; PostgreSQL en mémoire a permis les tests réels.
- Aucun Playwright navigateur ajouté/exécuté dans cette mission. Les validations
  UI sont des tests React ; l'extraction et les règles transactionnelles ont
  été vérifiées via HTTP/PostgreSQL réels avec fournisseur IA de test injecté.
- Aucun appel OpenAI réel, déploiement, push, merge ou changement Production.
