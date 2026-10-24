# Primitives UI Web partagées

Primitives, Brand et CSS existants extraits du Web, sans réécriture du design. Les anciens chemins du Web restent des façades de compatibilité ; Admin importe directement ce package. Aucun import d’une application dans ce package. Les styles historiques sont conservés pour éviter une régression visuelle.

Ce package utilise React DOM et Next ; il n’est pas un composant React Native. Le socle mobile n’en dépend pas. Chaque Next possède ses assets `/public/brand` pour être construit et servi séparément ; ces fichiers de marque sont copiés à l’identique, pas chargés depuis le serveur Web étudiant.
