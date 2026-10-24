# Mobile natif — préparation et construction

## État

Expo 57.0.30, React Native 0.86.3, React 19.2.3 conservés. React Navigation Native Stack ajouté ; composants natifs accessibles et couleurs/logo existants. L’application contient onboarding, inscription/connexion, dashboard, cours/détails/création, diagnostic/QCM sauvegardé, résultats/corrections, Leitner, planning semaine/mois/liste, disponibilités/propositions IA à confirmer, progression, profil/préférences et informations d’abonnement. Les règles restent dans l’API Nest.

Une session mobile est créée via POST `/api/v1/auth/mobile/register` ou `/auth/mobile/login`, avec les schémas partagés existants. Réponse `{user,token,expiresAt}`, token opaque de 43 caractères haché côté serveur, aucun cookie créé. SecureStore conserve uniquement le token, jamais le mot de passe ou un cache de données pédagogiques. Les autres appels portent Authorization Bearer et X-Revynora-Client: mobile, sans Origin ni cookie. Expiration/révocation/désactivation et droits sont les mêmes que Web. Une réponse tardive ne rouvre pas une session fermée.

Au redémarrage, le profil et les droits sont relus. Sur erreur réseau, les écrans présentent un réessai ; aucune écriture n’est mise en file hors ligne. La déconnexion attend la révocation serveur avant de supprimer le token. Un échec de SecureStore pendant la connexion tente de révoquer la session nouvellement émise. Les permissions caméra/micro/localisation sont bloquées ; aucun achat natif ni push ajouté implicitement.

## Configuration

L’API cible est `https://api.revynora.watercode.dev/api/v1`. Elle n’est pas encore déployée : les écrans réseau resteront en erreur tant qu’elle n’est pas accessible. Pour le développement seulement, une URL LAN explicite peut être définie dans `apps/mobile/.env.local`. Une version distribuée nécessite HTTPS et ne dépend pas de localhost ni de Metro.

Identifiants proposés, non revendiqués comme enregistrés :

| Profil      | Identifiant Android/iOS            | Usage                                                                 |
| ----------- | ---------------------------------- | --------------------------------------------------------------------- |
| development | dev.watercode.revynora.development | Dev client, Metro nécessaire                                          |
| preview     | dev.watercode.revynora.preview     | Distribution interne, sans Metro                                      |
| production  | dev.watercode.revynora             | Binaire destiné à une future publication, sans soumission automatique |

Icon PNG 1024 et splash issus des SVG de marque existants, pas d’asset de signature dans Git. Le contrôle `eas-build-pre-install` refuse une API non publique ou un projet EAS non configuré. `EAS_PROJECT_ID` est un identifiant public réel à renseigner après revue du projet ; aucune valeur factice UUID n’a été créée. Dans chaque environnement EAS, définir EXPO*PUBLIC_API_URL et EAS_PROJECT_ID comme paramètres du projet. Aucune clé serveur en EXPO_PUBLIC*.

## Accès et builds — commandes non exécutées à distance

La CLI EAS 25.1.1 indique actuellement Not logged in. Se connecter dans son terminal, puis vérifier compte/projet avant création ou liaison :

```sh
cd apps/mobile
pnpm dlx eas-cli@25.1.1 login
pnpm dlx eas-cli@25.1.1 whoami
# Après accord, utiliser le projet existant ou configurer sa liaison :
pnpm dlx eas-cli@25.1.1 init
```

Renseigner ensuite le vrai EAS_PROJECT_ID dans l’environnement local de build et les environnements EAS. Vérifier `pnpm check:release`. Choisir un projet et ses identifiants avant génération de certificats ; aucune clé privée dans la conversation ni Git.

```sh
# Après validation explicite des builds distants et de l’API accessible :
pnpm dlx eas-cli@25.1.1 build --platform android --profile preview
pnpm dlx eas-cli@25.1.1 build --platform ios --profile preview
# Dev client, si nécessaire pour le développement :
pnpm dlx eas-cli@25.1.1 build --platform all --profile development
```

Preview Android produit un APK installable par lien interne. Preview iOS demande un compte Apple Developer payant et l’enregistrement des UDID autorisés (`eas device:create` puis build). L’utilisateur n’en possède pas encore : aucune installation iPhone ad hoc/TestFlight ne peut être revendiquée. Xcode complet n’est pas installé sur cette machine, et adb n’est pas disponible. Un simple export Metro n’est ni un APK ni une IPA.

Le profil production est préparé ; aucun eas submit, auto-submit, publication store ou EAS Update n’est lancé. TestFlight nécessite ensuite App Store Connect et une soumission explicitement validée. Restreindre la visibilité des builds internes dans les paramètres EAS avant partage.

## Recette appareils à effectuer après déploiement validé

Sur un Android et un iPhone identifiés, avec un compte étudiant de test dédié :

1. Installer le preview signé, fermer Metro et vérifier le splash/onboarding à froid.
2. Inscription puis connexion ; mot de passe masqué, clavier/VoiceOver/TalkBack, agrandissement du texte.
3. Diagnostic → sauvegarde → fermeture/réouverture → reprise → soumission → score/correction. Aucun corrigé avant soumission.
4. Même compte sur Web : mêmes cours, tentatives et scores. Déconnexion sur un appareil ne révoque que sa session ; expiration et suspension doivent refuser les accès.
5. Free : refus Leitner/planning ; Plus : Leitner autorisé et planning refusé ; Pro : les deux. Utiliser le mécanisme d’abonnement de test existant, jamais inventer un paiement actif.
6. Créer/réviser une carte sur Mobile puis la retrouver sur Web ; tester oubli, réussite et conflit de version.
7. Planning, examen et disponibilité ; proposition IA non persistée avant confirmation ; conflit Web/Mobile simultané clairement signalé.
8. Même progression et abonnement, après retour au premier plan et actualisation.
9. Mode avion : aucune fausse sauvegarde, aucun paiement, état d’erreur/réessai ; reprendre sans doublon après reconnexion. Vérifier le comportement d’une déconnexion hors réseau.
10. Confidentialité : SecureStore, aucun token dans les logs/captures, utilisateur B interdit sur les données de A.

Ces étapes ne sont pas marquées réussies par les tests Jest ou l’export. Les suites locales exercent l’UI native en environnement de test et les sessions/données réelles en intégration API, pas les gestes, la signature, les OS et les appareils physiques.

Sources : [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [distribution interne EAS](https://docs.expo.dev/build/internal-distribution/), [React Navigation](https://reactnavigation.org/docs/getting-started/).
