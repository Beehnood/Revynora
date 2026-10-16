# ADR 001 · Authentification différée

Statut : historique Phase 0, remplacé pour le MVP étudiant par [ADR 004](004-auth-sessions.md).

Un seul Next.js sert le site, `/app` et `/admin`. Aucune session réelle ni donnée personnelle. Les deux espaces portent une bannière de démonstration et une directive noindex. Aucune action administrative sensible n’existe.

Avant des données réelles : sélectionner un fournisseur d’identité, définir autorisations côté API, séparation des rôles, expiration de session et tests d’accès. Cacher une navigation ou désindexer une route ne constitue pas un contrôle d’accès. L’authentification reste un choix non résolu.
