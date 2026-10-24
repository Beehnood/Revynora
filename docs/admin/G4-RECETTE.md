# G.4 — Consultation du catalogue éditorial

Base Git `f3039df3e7471c58198f6d01a53f81a80832e8e9`, initialement propre. Audit préalable : [G4-AUDIT.md](G4-AUDIT.md). Lot local, aucun commit ni déploiement, aucune migration/seed ou donnée de production.

## Périmètre livré

- Entrée Cours dans la navigation G.2, lien actif, menu mobile et protection SSR conservés.
- `/cours` : recherche titre/matière appliquée explicitement, pagination serveur fixe de 20, état vide et page sans résultat, chargement, erreur et reprise. Tableau défilant accessible au clavier.
- `/cours/[id]` : identité éditoriale, matière, origine, date UTC et texte du cours. Le HTML éventuel est affiché comme texte ; aucun rendu HTML/Markdown exécutable. Aucun auteur/utilisateur ou fait pédagogique lié affiché.
- `GET /api/v1/admin/catalog/courses?page=1&search=...` et `GET /api/v1/admin/catalog/courses/:id`, avec AdminGuard et capacité explicitement nommée `catalogCourses/read`.
- Filtre immuable source ADMIN ET ownerId null dans la liste, le total et la fiche. Les cours privés USER/AI et les ADMIN avec propriétaire ne sont jamais exposés. Fiche absente ou privée : même réponse 404. UUID invalide : 400. STUDENT : 403 ; absence de session : 401.
- Aucun POST/PATCH/DELETE, publication ou gestion des matières ajouté. La capacité générique courses reste vide. Tous les autres droits futurs restent refusés.

## Architecture et données

Contrats `AdminCatalogCourse` et `AdminCatalogCourseDetail` partagés dans types, schéma strict de recherche dans validation. Cas d'usage Admin avec vérification de permission, règles pures dans domain/catalog et projections SQL bornées dans infrastructure/catalog.repository. Aucun appel aux endpoints étudiants depuis l'Admin. Les guards et règles étudiantes restent inchangés.

La liste renvoie id/title/domain/source/createdAt ; la fiche ajoute content. Aucun champ ownerId, aucun e-mail, quiz, réponse, carte, activité ou relation n'est chargé. Recherche littérale insensible à la casse (%, \_ et antislash échappés) avec paramètres SQL. Taille de recherche 100, page 1..10000 ; paramètres supplémentaires refusés. Texte borné côté SQL puis vérifié, erreur 422 si excessif au lieu d'une troncature silencieuse. Voir les plafonds et risques dans l'audit.

## Validation finale

Node 24.3.0 et pnpm 10.18.3. Vérifications dans une copie locale isolée du code avec dépendances disponibles, sans copier .env. Sources formatées validées remises dans le dépôt principal.

| Contrôle                                     | Résultat                                         |
| -------------------------------------------- | ------------------------------------------------ |
| Tests Admin avec couverture                  | 34 réussis, 11 fichiers                          |
| Tests unitaires API                          | 53 réussis, 14 fichiers                          |
| Intégrations SaaS/PostgreSQL                 | 19 réussies, dont G.1–G.4                        |
| Intégrations pédagogie/PostgreSQL            | 11 réussies                                      |
| Playwright Chromium                          | 11 scénarios réussis : G.2 (4), G.3 (3), G.4 (4) |
| ESLint et TypeScript Admin/API               | Réussis                                          |
| ESLint test navigateur G.4 et TypeScript Web | Réussis                                          |
| Builds Admin/API HTTPS avec --force          | Réussis                                          |
| Build Admin pour recette locale              | Réussi, non livrable                             |
| Frontières du monorepo                       | Réussies                                         |

Total : **128 tests distincts réussis**. Couverture Admin : lignes/statements 99,10 %, branches 93,96 %, fonctions 90 %. Aucun seuil ou exclusion modifié.

L'intégration vérifie 24 cours globaux sur deux pages, tri sans doublon, recherche par titre et matière, recherche littérale %, \_, projections exactes, absence de contenu dans la liste, cours privés/inexistants à 404, champs excessifs à 422, UUID/query invalides à 400, absence de méthodes de mutation, interdiction du contournement StudentGuard, et refus de source/propriétaire fournis à la création étudiante. Les cours de test sont supprimés uniquement par les identifiants générés pour ce test.

La première fixture d'intégration tentait d'insérer USER/AI sans propriétaire : la contrainte historique Course_owner l'a correctement rejetée. Fixture corrigée pour tester explicitement ce refus PostgreSQL, sans désactiver ni changer la contrainte. Ce défaut de test n'a pas nécessité de modification du code applicatif. Les 30 intégrations ont ensuite été relancées ensemble et réussies.

Playwright G.4 couvre 320/768/1280 px : navigation et entrée active, recherche/pagination, lien de fiche au clavier, texte contenant une balise script non exécutée, absence de commandes de mutation, vide, erreur 503 simulée/reprise et fiche privée masquée. Le scénario de droits vérifie les deux routes SSR et les réponses API anonymes/STUDENT. Axe A/AA et débordement horizontal contrôlés sur liste/fiche aux trois largeurs, sans violation détectée. Captures conservées hors Git, aperçu mobile inspecté. Les sept scénarios G.2/G.3 sont aussi réexécutés, sans régression.

## Commandes et isolation

- `pnpm exec turbo run build --filter=@revynora/validation --filter=@revynora/api-client --force`.
- `pnpm --filter @revynora/admin test:coverage` ; `pnpm --filter @revynora/api test`.
- `pnpm --filter @revynora/api exec vitest run --config vitest.integration.config.ts src/saas/saas.integration.ts src/learning/learning.integration.ts`.
- `pnpm exec turbo run lint typecheck --filter=@revynora/admin --filter=@revynora/api`.
- `pnpm exec turbo run build --filter=@revynora/admin --filter=@revynora/api --force` avec API_URL HTTPS attendue et drapeaux Vercel limités au processus.
- `pnpm check:boundaries`.
- `pnpm --filter @revynora/web exec eslint playwright.admin.config.ts tests/admin-e2e/catalog-g4.spec.ts` ; `pnpm --filter @revynora/web exec tsc --noEmit`.
- Build Admin dédié avec `API_URL=http://127.0.0.1:3411`, puis `pnpm --filter @revynora/web exec playwright test --config playwright.admin.config.ts`.
- Prettier et contrôle final du diff.

URL de base vérifiée en mémoire : hôte loopback, nom revynora_test exclusivement. Aucun accès, test d'authentification ou écriture de production. Pas de reset, migration ou seed. Adaptateurs de test simulés. Serveurs dédiés 3411/3412, sans réutilisation de serveurs existants ; groupes de processus bornés et arrêtés à la fin. Journaux et captures dans le dossier indiqué par `/private/tmp/revynora-g4-location`. Ne pas livrer le build loopback de recette ; le build HTTPS a été vérifié séparément.

## Décision et limites

**GO pour revue locale G.4.** Le catalogue peut être vide : aucune donnée de démonstration n'est injectée dans l'application. Les cours ADMIN rattachés à un utilisateur restent délibérément inaccessibles depuis ce module. Aucun workflow éditorial n'est inventé à partir du champ source.

La recherche de sous-chaîne, le comptage et la lecture de grands textes peuvent coûter cher en base malgré les limites de sortie et les délais ; aucune garantie de charge production n'est revendiquée. Les valeurs hors plafonds requièrent une décision éditoriale ultérieure, pas une modification automatique. Chromium/axe ne remplacent pas un lecteur d'écran manuel ou un appareil physique. Les brouillons légaux, le candidat Web, Prisma et les autres chantiers sont préservés. G.5 non commencé ; toute suite attend une autorisation distincte.

## Dernière revue avant commit : Unicode

Ajout de deux tests (un unitaire, une intégration), sans changement applicatif. La matrice couvre les trois champs, quatre formes Unicode, limites exactes et dépassements de +1 unité UTF-16. Vérification HTTP/PostgreSQL : valeurs exactes restituées sans troncature, 422 explicite en fiche et sur page contenant un titre/matière excessif, liste préservée pour content excessif, fiche privée à 404. La conséquence fonctionnelle du refus de page entière est documentée dans G4-AUDIT.md.

Relance sur sources finales : 54 tests unitaires API et 31 intégrations (20 SaaS, 11 pédagogie) réussis ; ESLint et TypeScript API réussis. Le premier lancement unitaire sans DATABASE_URL a échoué sur cinq tests IA de configuration ; relancé avec configuration locale isolée, tous réussis. Le premier lancement PostgreSQL bloqué par le sandbox a été relancé avec accès local autorisé. Aucun défaut applicatif révélé par ces échecs d'environnement.

Les validations Admin et navigateur précédentes restent applicables : leurs sources et toutes les sources applicatives sont inchangées, empreintes comparées à la preuve précédente. Total cumulé : 130 tests distincts (34 Admin, 54 API, 31 intégrations, 11 Playwright) ; les tests Admin/Playwright ne sont pas réexécutés pour cette revue de tests et documentation.
