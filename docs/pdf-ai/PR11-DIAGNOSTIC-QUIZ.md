# PR 11 — diagnostic privé à partir d'un PDF analysé

Base : origin/main f04e00884761c17ba8b4f7e104e406f546f4e667.
Branche locale : feature/pdf-diagnostic-quiz. Aucun push, déploiement, appel IA réel
ou accès Production effectué pendant ce développement.

## Parcours

Après une analyse COMPLETED privée, « Je découvre ce cours » ouvre la synthèse,
les objectifs et les notions avant un départ explicite du quiz. « Je teste mes
connaissances » démarre directement le diagnostic. Aucune matière à sélectionner.
Les deux modes utilisent le même quiz vérifié, le mode est conservé par tentative.

Le résultat réutilise le score, les réponses sauvegardées, les corrections et les
notions faibles de LearningService. Les bonnes réponses, explications et citations
ne figurent jamais dans les DTO de quiz/tentative non soumise. Après soumission :
solutions, explications, chapitre et citation/page source. Le résultat est présenté
comme une estimation pédagogique sur la tentative, pas une note scolaire ni une
preuve absolue de maîtrise. Historique global existant et historique par document.

## Génération et droits

- Entre 5 et 10 questions SINGLE, quatre choix distincts et une bonne réponse.
- Réutilisation du validateur de qualité des quiz ; validation de chaque citation
  sur sa page source via le même validateur que l'analyse PDF.
- Chaque notion doit appartenir au chapitre de l'analyse ; libellé canonique
  enregistré. Plusieurs chapitres/notions exigés lorsque disponibles. Détection
  des questions identiques après normalisation ; pas de garantie algorithmique
  d'absence d'ambiguïté sémantique ou de questions proches.
- Transports Gemini generateContent et OpenAI Responses réutilisés via une fonction
  structurée PDF commune ; schéma compact uniquement côté Gemini. Aucun outil,
  lien externe, retry automatique ou fournisseur de secours. store=false OpenAI,
  réponses bornées, refus et erreurs expurgés, texte traité comme donnée non fiable.
- Mock refuse toute nouvelle génération PDF : aucun faux quiz IA. Un quiz réel
  déjà enregistré reste consultable/utilisable sans fournisseur actif.
- LearningAccessGuard, comptes actifs, propriété, CSRF et validations serveur
  existants conservés. Aucun changement Admin/G.8/G.9.

## Transactions et limites techniques

Un quiz enregistré par document (clé unique). La réservation utilise le verrou
User existant et le journal AIUsage : plafond quotidien AI_DAILY_LIMIT partagé
avec les diagnostics thématiques, trois essais de génération maximum par document,
un seul appel PDF actif par utilisateur. Les échecs restent comptés pour limiter
les abus ; fournisseur indisponible et cache ne créent aucune réservation.
Bail de cinq minutes, expirations clôturées ; une ancienne génération ne peut pas
écraser un bail remplacé ni ressusciter un document supprimé.

Une tentative en cours réutilisée, maximum vingt tentatives par quiz PDF.
Réservation atomique sous verrou User puis Quiz ; réponses et soumissions sous
verrou QuizAttempt. Double soumission idempotente, date/score conservés, réponse
après soumission refusée. Les diagnostics thématiques restent à cinq questions.
Aucun changement du quota commercial actuel de trois analyses PDF/semaine FREE,
des abonnements, prix ou contrats. La future gamme commerciale est hors périmètre.
La génération d'un quiz ne constitue pas une nouvelle analyse PDF hebdomadaire.
Le journal de génération compte les appels ; les métriques tokens/coût PDF ne sont
pas ajoutées dans ce MVP et leurs valeurs par défaut ne sont pas une mesure réelle.

## Stockage et suppression

Réutilisation de Quiz, Question, QuestionOption, QuizAttempt, Answer, Course,
AIUsage. Un Course privé est créé pour la synthèse du quiz, comme les diagnostics
existants, sans dupliquer le PDF brut. Nouvelles colonnes optionnelles : lien
Quiz/PdfDocument, chapitre/page/citation Question, mode QuizAttempt et lien
AIUsage/PdfDocument. Aucun changement des migrations historiques.

Migration additive 20261112000000_pdf_diagnostic_quiz, transactionnelle : colonnes
nullables, index unique et FK, contraintes de référence et de mode. Applicable
uniquement en base locale pendant cette mission ; aucune migration Production.

Suppression explicite du document : quiz, questions, choix, tentatives, réponses,
mini-cours et cartes associées supprimés dans la même transaction ; texte/analyse
PDF effacés par le mécanisme existant. Les traces AIUsage sans contenu restent
comptées et leur lien document est effacé. Les tombstones de quota d'analyse
hebdomadaire existants restent inchangés. L'historique est conservé jusqu'à cette
suppression explicite ; aucun reset ou suppression lors d'une nouvelle tentative.

## API

- POST /documents/:id/quiz : génération privée ou identifiant du quiz en cache.
- GET /documents/:id/quiz-attempts : historique privé, jusqu'à vingt tentatives.
- POST /quizzes/:id/attempts : body optionnel {mode: DISCOVER|TEST}.
- GET /quizzes/:id, GET /attempts/:id, PUT /attempts/:id/answers/:questionId,
  POST /attempts/:id/submit : endpoints existants réutilisés.
- DELETE /documents/:id : suppression associée atomique.

## Validation

Tests sans fournisseur réel : qualité/citations, Gemini/OpenAI simulés, extraction
réelle d'un PDF synthétique à deux pages, analyse enregistrée puis génération,
isolation/auth/CSRF, concurrence, solutions cachées, score, double soumission,
historique, dix questions, limites, cache hors ligne, bail expiré et suppression
en cours de génération. Tests Web des deux parcours et non-régression de la
bibliothèque/correction. Les vérifications finales et leurs nombres sont consignés
avec le bilan du commit ; aucune CI distante ou infrastructure n'est relancée.

Avant publication : autorisation de push/PR puis checks GitHub habituels. Une
recette de génération IA réelle reste distincte et demande autorisation fournisseur,
quota et traitement des données ; elle n'a pas été effectuée ici. Avant livraison :
plan séparé de migration additive et compatibilité applicative. Ne pas activer
l'IA Production ni copier de clé de développement pour valider cette PR.

## Bilan local final

- 47 tests backend unitaires ciblés réussis (qualité, citations, PDF, Gemini/OpenAI).
- 25 tests PostgreSQL/HTTP ciblés réussis, dont 5 scénarios PDF diagnostic.
- 25 tests Web ciblés réussis (diagnostic PDF, bibliothèque et tentatives).
- TypeScript API/Web, builds API/Web, ESLint ciblé, Prettier, validation Prisma,
  frontières de modules, intégrité des migrations historiques et diff : conformes.
- Migration additive appliquée uniquement à revynora_test locale isolée (14 au total).
- Aucun secret, fichier privé, rapport Oracle ou lockfile modifié par ce correctif.
