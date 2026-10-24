# Audit et plan Phase 4

Base 5436eb2, branche feature/phase-4-deployment-mobile, restauration restore/phase-4-20261017. Dépôt propre avant travaux. Les ADR, le cahier global et la recette Phase 3 décrivent les règles à conserver. Aucun AGENTS.md applicable trouvé lors de l'audit précédent ; les quatre workspaces sont conservés.

Disponible : Next étudiant et Admin indépendants ; Nest modulaire ; Auth par sessions opaques hachées en PostgreSQL ; cours/QCM/correction, Leitner, planning/IA et progression ; contrats Zod/types/client fetch ; huit migrations appliquées, 139 tests de référence. PostgreSQL/Redis Docker locaux et CI qualité existent. Expo 57 / RN 0.86.3 / React 19.2.3 est uniquement un socle sans navigation, stockage de session ni écrans métier.

Manques et risques concrets : API écoute 127.0.0.1 (inaccessible entre conteneurs), absence d'image API/runtime et de configuration TLS/sauvegarde/supervision ; auth cookie uniquement, non adaptée à un client natif sans proxy ; origine API/Next à fixer avant build ; absence d'identifiants natifs et de signature/EAS ; CI unique. Les mesures de production restantes incluent MFA Admin, politique légale/rétention, coût/quota IA et vérification des intégrations externes. Les cookies Web doivent rester sur chaque origine Next via son proxy /api/v1 ; ne pas les déplacer sur un domaine API distinct et casser SameSite/SSR.

Plan détaillé :

1. Ajouter des sessions natives opaques via les mêmes règles Auth et la même table ; SecureStore sur appareil, bearer sans cookie, validation du client/origine ; tester expiration/révocation/IDOR et absence de régression Web.
2. Préparer image Nest non-root, Compose indépendant, PostgreSQL/Redis privés persistants, Nginx TLS/rate-limit, migrations explicites, sauvegarde/restauration et sondes. Tester localement les configurations possibles sans infrastructure distante.
3. Préparer deux projets Vercel indépendants avec builds filtrés, API_URL HTTPS et cookies conservés via proxy. Aucune création ni publication distante sans validation.
4. Ajouter navigation native et design system conforme à la marque, onboarding/auth, cours/diagnostics/tentatives/résultats, Leitner, planning/IA, progression, profil/préférences/abonnement ; données exclusivement API centrale et états loading/empty/error/hors ligne.
5. Configurer EAS development/preview/production, icon/splash et identifiants explicitement proposés ; API publique HTTPS obligatoire dans une version distribuée, absence de fallback localhost. Préparer APK interne et procédure iOS ad hoc/TestFlight ; ne pas revendiquer de binaire signé ou de test appareil sans exécution réelle.
6. Ajouter tests natifs et de synchronisation, pipelines de validation séparés API/Web/Admin/Mobile sans déploiement automatique. Exécuter qualité et régression avant le bilan et la demande de validation distante.

Informations demandées : domaines API/Web/Admin, VM Oracle, projets Vercel/Expo et compte Apple/testeurs. Leur absence n'empêche pas de préparer et tester le code local ; elle empêche la configuration finale des endpoints/signatures et les opérations distantes. Aucun secret ne doit être transmis dans le chat ou le dépôt.

## Audit des accès et cibles

Domaines confirmés par l’utilisateur : revynora.watercode.dev, admin.revynora.watercode.dev et api.revynora.watercode.dev ; zone Namecheap watercode.dev, aucun autre enregistrement à modifier. VM partagée Ubuntu 24.04 : utiliser l’alias gmilli-oracle, port local 3101 proposé sous réserve d’un audit des ports. Tentative SSH avec BatchMode et StrictHostKeyChecking : connexion refusée par authentification publickey ; aucun script exécuté à distance. Capacité, services et ports de la VM non vérifiés. Ne pas déduire qu’un hôte est prêt.

Vercel CLI 64.5.0 : session locale déconnectée ; Expo/EAS CLI 25.1.1 : Not logged in. Cela ne signifie pas que les comptes n’existent pas ; les projets et identifiants ne peuvent pas être inspectés dans cette session. Xcode complet absent (CommandLineTools uniquement) ; adb absent. Aucun binaire signé ni test appareil exécuté. Les requêtes DNS pour les nouveaux CNAME Web/Admin et l’A API n’ont renvoyé aucune réponse ; ne pas modifier les autres projets.

Le remote Git effectivement configuré est github.com/Beehnood/Revynora.git ; vérifier cette orthographe lors de la liaison Vercel, l’utilisateur ayant indiqué Behnood/Revynora. La branche main n’est pas modifiée.

Les trois configurations vercel.json (racine de secours, Web et Admin) désactivent explicitement les déploiements Git automatiques afin que le push de préparation ne publie pas une preview. Aucun workflow ne lance vercel deploy, eas build ni SSH. Réactiver uniquement après validation explicite et vérification des projets distants.

Attention : main est encore au commit a26f122 (Phase 2). Les phases 2.5, 3 et cette préparation sont sur les branches dédiées ; la branche Phase 4 les contient. Un projet Vercel branché sur main ne bénéficie donc pas encore de la séparation Admin ni des dernières fonctionnalités. Aucune fusion automatique n’est effectuée.
