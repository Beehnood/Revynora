# Nouveau diagnostic — objectif libre et bilan explicable

Correction locale du 19 novembre 2026, basée sur main
`d8c5da0bc9042122a413f5da067dcd6955fb6103`.

Le formulaire Web et Mobile commence par un objectif libre, borné à 160 caractères.
Aucun niveau ni domaine n’est à sélectionner. Les exemples de démonstration restent
facultatifs ; le mode mock ne génère pas de contenu IA ni d’estimation personnelle.
Le champ HTTP historique `level` reste accepté pour les anciens clients, mais est
validé puis retiré avant les appels aux fournisseurs et n’influence aucun bilan.

## Questions et correction

Les adaptateurs OpenAI et Gemini existants partagent les consignes : cinq questions
couvrant au moins trois notions distinctes ; deux questions de repères/compréhension,
deux d’application à un contexte nouveau et une de raisonnement/mise en relation.
Le serveur vérifie la structure, les options, la couverture des notions et refuse
les champs de score ou de niveau dans la réponse IA. La pertinence sémantique et la
difficulté réelle des questions ne peuvent pas être garanties par ces contrôles.
Aucun nouveau modèle, SDK ou fournisseur n’est installé ou activé.

La correction utilise exclusivement les options et réponses enregistrées côté
serveur. Authentification, propriété, CSRF, validation des réponses, verrou de
soumission et idempotence restent en place. Le résultat, les bonnes réponses et
l’estimation ne sont exposés qu’après soumission. Les notions équivalentes par
casse/espacement sont regroupées pour les nouveaux diagnostics à difficultés variées,
afin d’éviter un bilan contradictoire. La correction et les listes de notions des
anciens questionnaires et quiz PDF conservent leur interprétation historique.

## Grille pédagogique v1, non étalonnée

Le score reste le pourcentage de réponses entièrement correctes, sans bonus partiel.
Pour les nouveaux questionnaires marqués « Diagnostic à difficultés variées » et
issus d’un fournisseur réel, avec cinq réponses valides et au moins trois notions :

| Estimation sur cette tentative | Conditions cumulatives                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Avancé                         | Score ≥ 80 %, deux applications et raisonnement réussis, au moins trois notions entièrement réussies |
| Intermédiaire                  | Score ≥ 60 %, au moins une application réussie, au moins deux notions entièrement réussies           |
| Débutant                       | Autres résultats d’un questionnaire éligible                                                         |

La difficulté est **prévue par les consignes**, pas mesurée ou calibrée. Il s’agit
d’une heuristique transparente de première version, pas d’une évaluation absolue,
d’une certification ou d’une mesure générale du niveau de la personne. Les erreurs
dans les questions ou leur correction peuvent affecter ce bilan. Les critères,
les nombres de réponses/notions réussies et les limites sont affichés à l’étudiant.

Les démonstrations, anciens questionnaires à niveau déclaré, quiz PDF sans grille
et données incomplètes/non conformes ne reçoivent **aucun niveau estimé**. Le score,
les corrections et les conseils par notion restent disponibles après soumission.
Ne pas présenter les questions basiques de la banque mock comme des questions IA
étalonnées de difficultés variées.

## Révisions et historique

Les erreurs déterminent les notions prioritaires : notions sans réponse correcte
et bases manquées en priorité, notions partiellement réussies à consolider, puis
notions entièrement réussies à entretenir. Chaque étape présente son motif et des
actions concrètes : relire la correction, reformuler, pratiquer un exemple puis
vérifier ses progrès sur de nouvelles questions. Ce sont des recommandations ;
aucun planning payant, rappel ou droit commercial n’est créé automatiquement.

Une nouvelle tentative produit son propre bilan sans réécrire les réponses ou le
score précédents. Aucun niveau global n’est enregistré sur User. Le résultat est
recalculé depuis les réponses immuables du test ; le marqueur persistant de Quiz.level
identifie la grille `mixed-diagnostic-v1`. **Ne pas changer cette grille pour les
anciens questionnaires** : une future grille doit utiliser un nouveau marqueur et
préserver l’interprétation v1. Aucun schéma ou migration Prisma n’est nécessaire.

## Validation et livraison ultérieure

Les tests ciblés couvrent les 32 combinaisons de réponses du test à cinq questions,
les seuils et preuves requis, l’absence d’estimation en démonstration/historique,
les réponses invalides, les doublons de soumission, la propriété, le contenu masqué
avant soumission, les interfaces Web/Mobile et les contrats des deux adaptateurs.
Les appels fournisseurs de ces tests sont simulés. Une génération réelle de ce
nouveau questionnaire à difficultés variées n’a pas été effectuée.

Ordre futur : API rétrocompatible d’abord, puis Web/Mobile. Aucun déploiement,
changement Production, appel IA réel, modification de quota/prix/permission ou
migration n’est effectué par ce correctif. AI_PROVIDER reste mock en Production.

Résultats locaux : **90 tests API, 22 tests Web et 13 tests Mobile PASS**.
TypeScript et ESLint API/Web/Mobile, builds API et Web, Prettier et
`git diff --check` : PASS. Installation pnpm 10.18.3 frozen-lockfile ; lockfile,
schéma et migrations Prisma inchangés. Le client Prisma a été régénéré sans
connexion de base. Les scénarios Playwright adaptés n’ont pas été exécutés ;
aucune intégration sur base réelle ni génération IA réelle n’est revendiquée.
