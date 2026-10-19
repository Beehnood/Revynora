# G.5 — Audit et périmètre minimal

Base fbc65c204c67121576ace1cd402c02d863c69844, branche feature/admin-dashboard, dépôt initial propre. Audit des sources, sans accès distant.

## Données et contrôles existants

AIUsage conserve provider, status PENDING/SUCCESS/ERROR, tokens, estimation USD nullable, attempts, errorCode et createdAt. AiService et le générateur de planning enregistrent cet usage ; G.3 fournit déjà les agrégats fournisseur/statut, tokens et couverture des estimations. Aucune facture fournisseur ni catégorie diagnostic/planning persistée fiable pour toutes les lignes : pas de coût facturé ni ventilation par fonctionnalité inventés.

LeitnerCard contient front/back privés, box, dueAt et archivedAt. Revision contient remembered, transitions de boîte et createdAt ; requestId unique rend la révision idempotente. Le dépôt impose userId, propriété et échéance. Seul le nombre de révisions enregistrées est retenu, sans résultat individuel ni taux de mémorisation. Les suppressions en cascade empêchent de reconstruire une activité historique supprimée.

StudyPlan et StudyPlanItem contiennent titres et horaires privés, createdAt et statut actuel. StudyPlanItemVersion conserve des versions mais ne constitue pas une télémétrie complète d'exécution réelle. On compte les plans et éléments créés, pas les heures étudiées, ni les changements historiques de statut. Les disponibilités sont exclues.

ReminderDelivery contient itemId/version, dueAt et statut texte, sans createdAt ni preuve fournisseur. Le worker peut marquer SENT en mode local. Les rappels retenus sont ceux encore rattachés à un élément existant, dont dueAt appartient à la période, par statut normalisé PENDING/SENT/CANCELLED/OTHER. SENT signifie statut enregistré, jamais livraison SMTP certifiée. Les rappels orphelins sont exclus explicitement. EmailMessage (destinataire, objet, corps) n'est pas lu.

Les contrôleurs Leitner, planning, planning IA et notifications utilisent StudentGuard et les cas d'usage/propriétaires/entitlements correspondants. Aucun appel Admin à ces endpoints. AdminGuard et permissions G.1 sont conservés. Nouvelle capacité explicite supervision/read pour ADMIN uniquement ; ai, leitner et planning restent vides. Aucun droit de mutation.

## Contrat et bornes

GET /api/v1/admin/supervision?from=YYYY-MM-DD&to=YYYY-MM-DD, schéma strict G.3 réutilisé : 1 à 366 jours UTC, début inclus, fin exclue. Réponse de comptes uniquement (category, status, count), sans identifiant, texte, horaire individuel ni dimension utilisateur. Ne constitue pas une anonymisation statistique garantie pour les petits effectifs ; accès ADMIN seulement, sans segmentation ni forage individuel.

Agrégation PostgreSQL, transaction RepeatableRead, TimeZone UTC, statement_timeout 5 s, attente 3 s et transaction 12 s. Nombre de groupes borné par catégories fixes et statuts normalisés ; aucune valeur de statut libre retournée. Aucune liste privée chargée. Les index existants commencent souvent par userId (Revision, StudyPlan, AIUsage), StudyPlanItem possède startsAt mais pas createdAt seul, ReminderDelivery possède l'unicité itemId/version sans index dueAt. Scans possibles malgré la période bornée et les timeouts ; mesurer avant forte volumétrie, sans migration anticipée.

## Hors périmètre

Pas de prompt, diagnostic, contenu de carte, réponse étudiante, emploi du temps, préférence ou destinataire. Pas de taux de rétention, temps réellement étudié, livraison effective de rappel, factures IA, instrumentation nouvelle, migration, seed ni mutation. Ces indicateurs exigeraient de nouveaux événements ou une évolution autorisée des modèles. G.6 non commencé.
