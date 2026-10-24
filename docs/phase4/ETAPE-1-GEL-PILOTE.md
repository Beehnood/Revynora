# Étape 1 — Candidat au gel du pilote Web

Date : 18 octobre 2026. Base : `b64d857c9ca1538a4d845c782733d09685ed8631`, branche `feature/phase-4-deployment-mobile`, dépôt `Revynora`.

## Décision et périmètre

Le candidat est techniquement prêt à être figé pour un pilote Web de validation. Aucun nouveau défaut bloquant n’a été identifié dans les corrections examinées. Le commit ci-dessous est proposé à validation ; il n’a pas été créé. L’étape 1 sera formellement clôturée après validation et enregistrement de ce commit. Aucune étape distante ne commence sur la seule base de ce document.

Le pilote conserve les parcours Web déjà validés et leur API Nest, PostgreSQL et Redis. Les fonctionnalités Admin et Mobile existantes restent dans le monorepo, sans développement supplémentaire ni déploiement à cette étape. Les fournisseurs mock/local existants sont conservés : les résultats IA et paiements concernés sont des simulations, les e-mails ne sont pas réellement envoyés. Cette version ne constitue pas une ouverture commerciale.

## Vérifications achevées

- État Git complet disponible : quatre fichiers suivis modifiés et un rapport d’audit non suivi, avant ajout du présent bilan ; aucun fichier indexé pour commit. Aucun autre changement détecté.
- Revue des cinq fichiers issus de l’audit : cache Corepack partagé correctement placé avant la préparation de pnpm ; CI testant le stage migration en utilisateur non-root sans réseau ; formatage Mobile sans changement de comportement ; documentation cohérente avec les constats de l’audit.
- `git diff --check` : code de sortie 0. Contrôle ciblé également réussi.
- `pnpm format:check` : code de sortie 0, tous les fichiers correspondants sont conformes.
- Prettier avec la liste explicite des 428 fichiers suivis ou proposés : code de sortie 0, tous les fichiers correspondants sont conformes. Ce contrôle évite la découverte récursive dans les artefacts générés.
- Les messages de simulation existent déjà dans les pages Web et les parcours d’abonnement/IA ; aucune fonctionnalité ni nouveau comportement ajouté.

Les blocages de lecture constatés le 17 octobre ne rendent donc plus ces contrôles incomplets au moment de cette reprise. La disponibilité future des fichiers synchronisés reste un point d’environnement local, sans suppression ni modification du système de synchronisation.

Les tests, builds, migrations et sondes réussis le 17 octobre sont conservés comme preuves dans [l’audit](AUDIT-AVANT-DEPLOIEMENT.md). Aucun code fonctionnel ni dépendance n’a changé depuis ces vérifications ; ils ne sont pas réexécutés. Les tests Admin/Mobile ne sont pas relancés et aucune opération Docker n’est nécessaire à ce gel. Aucun nouvel audit des dépendances ni appel réseau.

## Contenu exact du candidat

Les empreintes suivantes figent les cinq fichiers issus de l’audit à l’instant de la revue, sur la base Git indiquée. Toute modification ultérieure de ces fichiers nécessite une nouvelle revue ciblée. Le présent bilan complète ce lot documentaire ; son empreinte sera portée par le commit lui-même.

| Fichier                                  | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `.github/workflows/backend.yml`          | `77bcc30ed3b7f1fde728f6a81eed07e6b79d892d6451fc5d0ef1b678a6517818` |
| `infra/production/Dockerfile.api`        | `514ce697a87a78cc84f47179a371e80932c25aa68b22c5643c37a0cef40b34e3` |
| `apps/mobile/tests/secure-store.test.ts` | `d38902e6db450f7d08fefab7803a83afda8e3cb9ab653bf9262ff60c813caee4` |
| `docs/phase4/DEPLOIEMENT.md`             | `c70250f09d505b7bde1a7819758ffeef555bdcf94b408fff356c26823f56c1fa` |
| `docs/phase4/AUDIT-AVANT-DEPLOIEMENT.md` | `de70f1965376ac637824c2215647453b6f3e145798b5f205413a4e43531eda50` |

## Commit proposé

Titre : `fix(phase4): freeze web pilot deployment candidate`

Contenu :

- `infra/production/Dockerfile.api`
- `.github/workflows/backend.yml`
- `apps/mobile/tests/secure-store.test.ts`
- `docs/phase4/DEPLOIEMENT.md`
- `docs/phase4/AUDIT-AVANT-DEPLOIEMENT.md`
- `docs/phase4/ETAPE-1-GEL-PILOTE.md`

Le changement Mobile est uniquement le formatage déjà corrigé pendant l’audit pour conserver la CI globale verte. Il ne commence pas l’étape Mobile.

Commandes proposées après validation, dans ce dépôt, sans push ni fusion :

```sh
git add -- infra/production/Dockerfile.api .github/workflows/backend.yml apps/mobile/tests/secure-store.test.ts docs/phase4/DEPLOIEMENT.md docs/phase4/AUDIT-AVANT-DEPLOIEMENT.md docs/phase4/ETAPE-1-GEL-PILOTE.md
git diff --cached --check
git diff --cached --stat
git commit -m "fix(phase4): freeze web pilot deployment candidate"
```

Aucun `git add .`, reset, suppression, tag, push ou fusion proposé. Une fois le commit créé, vérifier que l’état Git est propre et relever son SHA comme référence du pilote.

## Travaux différés

- Étape 2 : préparation de l’installation Docker et capacité Oracle ; installation uniquement après autorisation distante explicite. Gmilli, AAFPN et leurs bases restent protégés.
- Étapes 3–5 : API/base/Redis, DNS/TLS/Nginx et raccordement Vercel suivant les configurations préparées. Aucune commande correspondante exécutée pendant l’étape 1.
- Étapes 6–7 : déploiement Admin puis finalisation Mobile, sans anticipation.
- Étape 8 : exploitation du pilote, triage des 41 avis de sécurité déjà connus, sauvegardes/alertes et durcissements non bloquants identifiés dans l’audit. Le gel de code ne lève pas les réserves de l’audit sur une ouverture publique ; les chemins exposés devront être traités avant celle-ci.
- Étape 9 : paiement réel, fournisseurs réels et commercialisation. Aucune mise à jour majeure de dépendances, refonte CSP, MFA ou séparation des rôles PostgreSQL pendant cette clôture de code.

## Passage à l’étape 2

**GO technique sous réserve de validation du candidat et création du commit de gel.** Aucun blocage technique supplémentaire n’a été constaté à cette étape. Tant que ce gel n’est pas validé/enregistré, l’étape 2 reste en attente. L’installation Docker, toute connexion Oracle et toute modification distante nécessitent ensuite une autorisation explicite distincte. Le présent bilan n’autorise aucune intervention distante.
