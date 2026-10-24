# G.7 — Refonte UX/UI Admin

## Référence et périmètre

Branche `feature/admin-dashboard`, base `b2e102a4b50477bd8419ae75c81719e079144f74`, dépôt propre au départ. ADR 006/007 : Admin indépendant, primitives `@revynora/ui`, transport et contrats existants. Aucun changement API, Prisma, permission, guard, session ou calcul métier. Aucune dépendance ajoutée.

## Problèmes initiaux observés

L’audit local conserve 17 captures à 1440, 768 et 375 px dans `/private/tmp/revynora-visual-audit-M4oAQ1`. KPI comprimés à 768 px, dashboard long et peu hiérarchisé, graphique sans repères suffisants, titres redondants, filtres et pagination serrés, statuts techniques et montants EUR peu lisibles. Le message générique sur les futurs modules était devenu obsolète.

## Solutions

- En-tête concis et période appliquée explicite ; KPI agrandis, grille adaptative, raccourcis vers utilisateurs, abonnements et paiements.
- Statistiques regroupées ; graphique des inscriptions avec axes, dates, graduations, légende et tableau de valeurs exactes accessible. Les calculs et les données restent ceux de G.3.
- Offres, événements et audit dans un panneau dépliable ; limites financières détaillées dépliables, avertissement essentiel toujours visible.
- Sidebar fixe et moins large sur tablette ; menu mobile existant conservé. KPI en trois colonnes sur grand écran, deux colonnes avec services sur toute la ligne à 768 px, une colonne sur mobile.
- Filtres espacés, pagination lisible, régions de tableaux focalisables et indication du défilement horizontal. Les tableaux larges conservent un défilement interne volontaire.
- Dates françaises UTC, libellés français pour statuts connus, identifiants internes abrégés visuellement avec valeur complète au survol. Titres utilisateurs dédoublonnés.
- EUR affiché en euros français (250 unités → 2,50 €), précision entière conservée. Les autres devises restent exprimées en unités enregistrées avec échelle inconnue : aucune conversion supposée.
- États vides distinguant absence de données, filtres sans résultat et page sans résultat. Chargement, erreur et reprise conservés.

## Composants et limites

Styles limités à l’Admin ; `AdminView`, `AdminShell`, panneaux statistiques/supervision/financiers et vues utilisateurs/catalogue réutilisent les composants existants. Ajout d’un graphique SVG sans bibliothèque et d’utilitaires de présentation testés.

Les périodes d’abonnement ne sont pas des abonnés uniques. Les paiements restent des enregistrements, sans preuve d’encaissement ; aucune somme entre devises, MRR, ARR ou revenu net ajouté. Les estimations IA ne sont pas des factures. Les faibles effectifs ne sont pas anonymisés statistiquement. Les tableaux restent denses lorsqu’ils ont beaucoup de colonnes.

## Suites commerciales reportées

Modification d’offre, remboursement, facturation, rapprochement Stripe et mesures de revenus vérifiés restent hors périmètre. Leur éventuel cadrage appartient à G.8 et suivants, sans décision ni développement engagé ici.

Résultats et limites de validation : [G7-RECETTE.md](G7-RECETTE.md).
