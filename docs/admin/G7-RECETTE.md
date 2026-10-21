# G.7 — Recette locale

## Environnement et preuves

Base `b2e102a4b50477bd8419ae75c81719e079144f74`, branche `feature/admin-dashboard`. Sources testées dans `/private/tmp/revynora-g7-qqyhypjk/source`, dépendances locales existantes réutilisées, aucun fichier .env copié ni installation. Les fichiers formatés testés sont recopiés à l’identique dans le dépôt principal.

Journaux, manifeste et diff : `/private/tmp/revynora-g7-qqyhypjk`. Les captures avant sont dans `/private/tmp/revynora-visual-audit-M4oAQ1` ; après dans `browser-results` du dossier G.7.

## Résultats réellement exécutés

| Contrôle                                                    | Résultat                            |
| ----------------------------------------------------------- | ----------------------------------- |
| Tests Admin avec couverture                                 | 42 réussis, 14 fichiers             |
| Tests unitaires API inchangée                               | 59 réussis, 16 fichiers             |
| Playwright Chromium G.7                                     | 5 scénarios réussis, un par largeur |
| ESLint et TypeScript Admin                                  | Réussis                             |
| ESLint nouveau scénario/config navigateur et TypeScript Web | Réussis                             |
| Build Admin HTTPS forcé                                     | Réussi                              |
| Build Admin loopback pour recette                           | Réussi, réservé au test             |
| Frontières monorepo                                         | Réussies                            |
| Prettier et git diff --check                                | Réussis lors du contrôle final      |

Total : **106 tests réussis**. Couverture Admin : lignes/statements 98,31 %, branches 92,54 %, fonctions 89,09 %. Aucun seuil ou exclusion modifié. Les premiers essais ont révélé deux assertions de présentation devenues ambiguës/obsolètes (devise USD et option/cellule « Marqué payé ») ; elles ont été corrigées puis les contrôles concernés relancés avec succès.

## Recette navigateur

Largeurs 320, 375, 768, 1280 et 1440 px. Cinq pages par largeur : dashboard, utilisateurs, cours, abonnements, paiements. Deux passages : données locales existantes puis réponses GET simulées uniquement dans le navigateur. **50 captures et 50 contrôles Axe WCAG A/AA/2.1 AA**, sans violation détectée ni débordement horizontal global. Le défilement interne des tableaux est intentionnel.

Les réponses simulées servent à examiner des tableaux remplis, montants, statuts et graphiques ; elles ne sont jamais persistées. Les captures `live-*` correspondent aux données locales, `fixture-*` aux réponses de recette. Aucune donnée métier créée, aucun formulaire de mutation soumis. Authentification avec un compte local existant ; aucune information de connexion dans les sources de test.

Vérifications : redirection anonyme, période appliquée, repères du graphique, montant 2,50 €, statut traduit, filtre et pagination réellement transmis, filtre sans résultat, erreur 503 et reprise, ouverture/fermeture du menu par clavier avec retour du focus, tableau accessible au clavier, annulation d’une confirmation utilisateur sans mutation. Les états de chargement sont aussi vérifiés par les tests de composants. Inspection visuelle finale : dashboard réel à 768 px, dashboard rempli à 1440 px, paiements remplis à 320 px. Le défaut de compression des KPI à 768 px est corrigé.

## Limites et régressions

Les tests de composants G.1–G.6 sont inclus dans les 42 tests Admin ; les 59 tests API passent. Les suites PostgreSQL et les anciens scénarios navigateur qui créent des fixtures persistées **ne sont pas réexécutés pour G.7**, afin de respecter l’absence de données fictives persistées. Le scénario financier G.6 est ajusté au nouveau libellé vide mais n’est pas annoncé comme exécuté. Pas de nouvelle vérification HTTP STUDENT avec compte créé ; les contrôles d’autorisation existants ne sont pas modifiés et leurs unitaires sont exécutés.

Axe et Chromium ne remplacent pas un lecteur d’écran manuel, Safari ou un appareil physique. Pas de build API supplémentaire : aucune source API modifiée. Le serveur de recette G.7 est arrêté après Playwright ; les serveurs préexistants ne sont pas modifiés. Le serveur 3002 préexistant peut encore afficher G.6 tant qu’il n’est pas relancé avec les nouvelles sources.

## Décision

**GO pour revue locale UX/UI G.7**, avec les limites de non-régression ci-dessus. Aucun commit, push, déploiement, migration, seed, configuration de production ou chantier G.8. Validation utilisateur attendue avant commit.
