# ADR 004 · Authentification du MVP

Statut : accepté, remplace le report de l’ADR 001 pour l’espace étudiant.

Le monolithe modulaire NestJS reste la source des sessions, des droits et de la propriété. Next.js conserve toutes les pages ; `/api/v1/*` est relayé vers NestJS par une réécriture serveur sur le même site. Aucun JWT ni secret dans localStorage.

Les mots de passe sont dérivés avec scrypt (N=32768, r=8, p=3, sel aléatoire 16 octets, sortie 64 octets, format versionné scrypt-v1). Vérification avec comparaison en temps constant ; hash fictif de même coût si l’adresse n’existe pas. Les e-mails sont normalisés en minuscules, avec unicité SQL insensible à la casse. L’inscription crée atomiquement l’utilisateur STUDENT/FREE et sa première session ; les champs de rôle et de plan ne sont pas acceptés en entrée.

Les sessions sont des jetons aléatoires de 32 octets ; seul SHA-256 du jeton est stocké. Cookie HttpOnly, SameSite=Lax, Path=/ pour permettre le contrôle SSR de `/app`, expiration configurable (7 jours). Secure=false est réservé au HTTP local ; activer COOKIE_SECURE en cas de futur HTTPS. La déconnexion révoque la session côté DB. Le guard relit rôle, plan et expiration à chaque appel. L’absence ou l’expiration de session redirige le Web vers la connexion ; une panne API affiche un état indisponible.

Mutations : en-tête X-Revynora-Client: web obligatoire, origine contrôlée si présente, CORS limité au Web et à son équivalent loopback localhost/127.0.0.1. Une origine étrangère ou un formulaire cross-site ne peut effectuer les mutations. NestJS n’accorde pas sa confiance à X-Forwarded-For ; la limite d’authentification locale (20 requêtes/minute/IP) est en mémoire et bornée. Une architecture à plusieurs instances nécessitera un limiteur distribué et un proxy de confiance explicite.

Les endpoints pédagogiques sont réservés aux comptes étudiants FREE. Une ressource privée d’un autre étudiant renvoie 404 pour ne pas révéler son existence. `/admin` reste une maquette désindexée sans données ni action de gestion. Aucun compte administrateur par défaut.

Vérification d’e-mail, réinitialisation de mot de passe, modification/suppression du compte et durcissement pour exposition publique ne sont pas implémentés dans ce MVP local. Aucun hébergement ni accès public n’est créé.
