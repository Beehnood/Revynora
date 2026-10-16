# Identité et fondation UI

La référence « Educational Design System Collage » guide le livre ouvert bicolore, la typographie compacte, les tuiles de matières et les teintes par rôle. Le logo est redessiné en SVG, sans extraire un bitmap de faible résolution. Les 22 icônes reprennent la géométrie Lucide (ISC) et sont harmonisées par couleur et épaisseur. Le sprite est régénérable via `node scripts/generate-icons.cjs` ; les identifiants sont dans ce script. Le glyphe typographique ƒx est utilisé pour les mathématiques dans l’interface.

Les collages de produit guident la sidebar, les cartes et les surfaces lilas. Les chiffres et graphiques d’activité sont volontairement remplacés par des états vides pour respecter la phase 0. L’illustration de la landing est construite en HTML/CSS/SVG, plutôt qu’utiliser les collages comme interface. Les trois collages originaux restent inchangés hors du dépôt.

## Tokens

Les variables de `apps/web/app/globals.css` sont la source : primaire #5738E8, survol #4326C7, texte #121839, secondaire #57617B, fond #F7F9FC, surface blanche et bordure #DCE2EF. Le primaire provisoire bleu du PDF est adapté au violet de la marque fournie. Tailwind expose les tokens avec @theme. Espacement fondé sur 8 px ; arrondis 8 à 22 px ; largeur publique maximale 1200 px. Police système Arial/Helvetica pour ne pas dépendre d’un téléchargement externe.

## Composants

`Button` suit le modèle shadcn/ui : Radix Slot, class-variance-authority et cn (clsx/tailwind-merge). Les primitives Card, Badge, Input, Label, Separator, Skeleton, Alert, FormField, Select et Textarea complètent les gabarits PageContainer, PageHeader, EmptyState, ErrorState et LoadingState. `components.json` prépare les alias shadcn pour une extension future. Galerie `/design-system` : états, rôles, matières et formulaire.

## États et accessibilité

Survol et focus visible sur les contrôles ; boutons désactivés ; soumission en chargement ; succès annoncé par status ; erreurs par alert et aria-describedby. Les menus exposent aria-expanded, se ferment avec Escape et rendent le focus au bouton. Lien d’évitement et landmarks, lang=fr, réduction des animations selon prefers-reduced-motion. Les formulaires ne font aucune requête ni persistance. Aucun bouton d’action métier n’est simulé comme opérationnel.

À 320 et 375 px : une colonne, menu compact ; à 768 px : cartes sur deux colonnes lorsque pertinent et sidebar repliable ; dès 1024 px : sidebar visible et grilles adaptées. Le contrôle automatisé de contraste n’est pas un audit WCAG exhaustif ; revue humaine avec lecteur d’écran à prévoir avant diffusion.

## Export des assets

`logo-mark.svg`, `logo-light.svg`, `logo-dark.svg`, `app-icon.svg`, `app-icon-dark.svg` et `icons.svg` sont éditables. Les PNG 16, 32, 48, 180 et 512 px sont générés par `node scripts/export-brand.cjs`. Pour le sprite : `<svg aria-hidden="true"><use href="/brand/icons.svg#physics" /></svg>` ; fournir un nom accessible sur le contrôle parent. Le nom et la disponibilité juridique de la marque restent à vérifier avant publication.

Captures locales reproductibles : serveur lancé, exécuter `node scripts/capture-ui.cjs`. Les fichiers desktop et mobile se trouvent dans ce dossier.

## Évolution Phase 1

L’identité, les tokens et les primitives sont conservés. Les formulaires d’authentification, l’assistant diagnostic, les choix radio/checkbox, les états de sauvegarde, la confirmation de soumission et la correction réutilisent ces fondations. La navigation étudiant utilise maintenant des liens vers des pages réelles ; les révisions et le planning sont explicitement à venir. Le script de capture simple couvre les pages publiques ; les captures des écrans étudiants authentifiés sont produites par Playwright dans `docs/phase1`. Les anciennes captures de ce dossier correspondent à la Phase 0.
