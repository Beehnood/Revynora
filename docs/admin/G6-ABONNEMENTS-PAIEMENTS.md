# G.6 — Consultation des abonnements et paiements

Base : `75bdea40ac3d7f7498e7434d0dbeb5c5a997e62b`, branche `feature/admin-dashboard`. Développement local uniquement, sans commit ni opération distante.

## Audit préalable

`Subscription` contient le catalogue FREE/PLUS/PRO, prix en centimes, devise, activation et référence tarif fournisseur. `UserSubscriptionHistory` décrit des périodes historisées avec statut ACTIVE/PAST_DUE/CANCELLED/INCOMPLETE, fournisseur, prix, dates et annulation en fin de période. Un statut ACTIVE historisé ne prouve ni un droit actuel ni un paiement : les droits effectifs dépendent aussi des dates et du rang de formule dans `resolveEntitlement`.

Free : tests/cours/historique. Plus : Free + Leitner. Pro : Plus + planning et rappels facultatifs. Les prix du catalogue sont lus, sans modification ni montant codé dans les nouvelles vues.

`Payment` contient montant, devise, statut PENDING/PAID/FAILED/REFUNDED, fournisseur, référence, reçu et identifiants de relation. `UserPaymentHistory` contient les événements. `CheckoutIntent`, `BillingState` et `MockBillingRecord` assurent le suivi technique ; ils ne sont pas exposés par G.6. Les contraintes SQL existantes refusent les prix/montants négatifs et les périodes inversées.

Les endpoints étudiants de checkout, portail, changement de formule et simulations ainsi que le webhook existent déjà. Le fournisseur Stripe vérifie les signatures, consulte les objets fournisseur et refuse les événements/abonnements live. Le montant persisté provient notamment de `invoice.amount_due` : il ne constitue pas un total encaissé. Aucun appel Stripe distant n’a été effectué. Le modèle Payment ne porte pas de preuve persistée du mode live, d’une vérification indépendante ou d’un encaissement réel. Une ligne marquée stripe ne permet donc pas d’affirmer un paiement réel vérifié.

## Périmètre livré

- `/abonnements` : catalogue existant et périodes enregistrées, filtres offre/statut/fournisseur, pagination.
- `/paiements` : filtres statut/fournisseur et pagination de 20 lignes, ordre stable date puis identifiant, page bornée à 10000.
- GET `/api/v1/admin/subscriptions` et `/api/v1/admin/payments`, protégés par AdminGuard puis permission explicite read. Les mutations restent refusées ; les modules futurs restent deny-by-default.
- Projections minimales : aucune identité étudiant, adresse email, référence fournisseur, URL de reçu, événement brut, secret, carte ou coordonnée bancaire. Fournisseur inconnu ramené à `other`.
- `mock` est affiché comme simulation, toute autre ligne de paiement comme non vérifiée. Le statut enregistré est conservé sans interprétation d’encaissement. Aucun agrégat financier, facture, remboursement ou changement de formule ajouté.
- Montants affichés comme entiers en centi-unités pour EUR uniquement ; les autres devises restent en unités stockées avec échelle non vérifiée, sans somme, arrondi ni conversion entre devises. États chargement, vide, erreur et reprise présents. Les périodes internes sont distinguées des simulations.

## Vérification finale locale

Les modifications G.6 et une copie de recette existaient déjà au début de cette reprise ; elles ont été préservées, auditées puis corrigées dans le seul périmètre G.6. Copie isolée : `/private/tmp/revynora-g6-source`, sans copie de fichier .env. Journaux actuels distincts désignés par `/private/tmp/revynora-g6-review-location`.

| Contrôle                              | Résultat                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| Tests unitaires Admin                 | 39 réussis                                                                        |
| Tests unitaires API                   | 59 réussis                                                                        |
| Intégrations PostgreSQL/HTTP          | 41 réussies, dont 4 G.6, et régressions SaaS, pédagogie, planning                 |
| Playwright Chromium                   | 14 scénarios réussis, dont 3 G.6 à 320/768/1280 px ; régressions G.2–G.5 incluses |
| ESLint/TypeScript Admin/API           | Réussis                                                                           |
| ESLint scénario G.6 et TypeScript Web | Réussis                                                                           |
| Builds Admin/API HTTPS forcés         | Réussis                                                                           |
| Frontières du monorepo                | Réussies                                                                          |
| Build Admin loopback pour recette     | Réussi, réservé aux tests et non livrable                                         |

Total : **153 tests distincts**. Les tests vérifient 401/403, les filtres combinés, les deux paginations stables, les statuts, montants nuls et maximum Int32 exacts, rejet des montants négatifs par la contrainte existante, projection minimale des réponses, aucune référence fournisseur ni URL de reçu, erreurs, vide et reprise. Les nouvelles permissions permettent read uniquement ; remboursement, création et modification restent refusés. Les statuts historisés ne deviennent pas des droits effectifs. Le test unitaire supplémentaire contrôle les délais de transaction et la propagation d'une erreur SQL.

Axe ne détecte aucune violation dans les vues examinées aux trois largeurs G.6 ; les régressions existantes contrôlent aussi les protections et la supervision. Aucun audit complet au lecteur d'écran ou sur appareil physique n'est revendiqué.

Les premiers essais HTTP/PostgreSQL et navigateur ont été bloqués par le sandbox. La relance autorisée a réussi sur la base locale existante revynora_test, sans migration, reset ou seed. La recette navigateur a ensuite rencontré deux anciens serveurs G.6 sur 3411/3412 : leur répertoire temporaire a été vérifié, seuls ces processus de test ont été arrêtés, puis les serveurs dédiés actuels ont servi la recette. Aucun serveur production ni autre worktree touché. Fixtures supprimées par leurs seuls identifiants, providers de test simulés, aucun appel Stripe distant. Le build loopback est non livrable ; aucun build déployé.

Les empreintes et le patch final sont conservés dans le dossier de revue. Aucun fichier indexé ni commit créé. Toutes les sources de ce lot correspondent à la copie validée ; seuls les documents de bilan ont été finalisés après les tests.

## Limites et suites

Aucune validation Stripe commerciale ou preuve d’encaissement ajoutée. Les écrans de statistiques préexistants ne sont pas refactorisés dans G.6. Ni export financier, ni recherche par identité, ni remboursement, ni mutation de formule : ces sujets nécessitent un cadrage distinct. Aucun G.7 commencé.

## Revue complémentaire

Les modifications G.6 étaient déjà présentes lors de cette reprise ; elles ont été conservées et auditées. Ajout d'un statement_timeout local de 5 s aux deux lectures, dans la transaction RepeatableRead (attente 3 s, transaction 12 s). Le nombre de lignes retournées est borné à 20 ; le comptage, les filtres sans index dédiés et OFFSET jusqu'à 199980 peuvent scanner beaucoup de lignes. Les index existants userId/date ne garantissent pas la performance des vues globales. Mesurer avant montée en charge ; aucune migration anticipée. Les listes couvrent les données conservées, sans filtre temporel implicite.

Les devises autres qu'EUR sont présentées en unités stockées (échelle non vérifiée), jamais toutes divisées par 100. Les prix catalogue et statuts enregistrés ne sont pas des encaissements. Les tests navigateur couvrent désormais aussi 768 px.
