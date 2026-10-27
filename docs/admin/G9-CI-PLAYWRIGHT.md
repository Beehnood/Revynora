# G.9 — Installation Playwright dans GitHub Actions

Diagnostic du 27 octobre 2026 pour la PR #6, HEAD initial
`57e8420334a1dc306582852c770308a22a7b91c4`.

## Cause démontrée

Les journaux complets des jobs [Admin](https://github.com/Beehnood/Revynora/actions/runs/40501095112/job/122178669371)
et [Quality](https://github.com/Beehnood/Revynora/actions/runs/40501095115/job/122178668332)
montrent la même incompatibilité. Le label `ubuntu-latest` a fourni Ubuntu
26.04.1 LTS, image `ubuntu-26.04`, version `20261012.163.1`, runner `2.338.0`.

`@playwright/test`, `playwright` et `playwright-core` sont verrouillés en
**1.56.1**. Les deux installations `pnpm install --frozen-lockfile` ont réussi
avec pnpm 10.18.3, sans résolution différente du lockfile.

Dernières erreurs avant le code de sortie 1 :

```text
Admin, 2026-10-27T12:07:39Z
Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.56.1!
Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64

Quality, 2026-10-27T12:08:25Z
Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.56.1!
Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64
```

L'échec intervient dans le contrôle de plateforme, avant apt et avant le
téléchargement Chromium. Aucune erreur réseau, de certificat, de paquet apt ou
de disque n'est la cause indiquée par ces étapes. Les tests navigateur suivants
ont été ignorés lors de ces deux exécutions initiales.

## Correction minimale

Seul le runner des jobs Quality et Admin est fixé à `ubuntu-24.04`, plateforme
prise en charge dans la [table de dépendances officielle de Playwright 1.56.1](https://github.com/microsoft/playwright/blob/v1.56.1/packages/playwright-core/src/server/registry/nativeDeps.ts).
La [procédure CI officielle](https://playwright.dev/docs/ci) reste suivie :
installation figée des paquets, installation du navigateur avec ses dépendances,
puis exécution des tests.

La commande reste `pnpm --filter @revynora/web exec playwright install --with-deps chromium`,
dans le workspace qui déclare Playwright. Aucun changement de version, de
lockfile, de téléchargement, de fonctionnalité commerciale ou de règle GitHub.

Les étapes suivantes sont conservées sans condition de contournement :

- Quality : `pnpm test:e2e`.
- Admin : `node scripts/admin-ci-browser.cjs`, incluant les lots G.2–G.9,
  les contrôles responsive et Axe.

## Vérification avant publication

Contrôle du diff : uniquement les deux labels de runner, leurs commentaires et
ce document. Vérification de syntaxe YAML et Prettier, `git diff --check`,
frontières du monorepo et intégrité Prisma effectuées localement. Le code G.9,
les migrations et les tests restent identiques au HEAD initial.

Le poste local utilise macOS : il ne reproduit pas l'installation apt Ubuntu.
La validation Linux et l'exécution effective des scénarios seront vérifiées dans
les nouveaux jobs de la PR, puis rapportées avec leurs résultats réels.
Aucune migration applicative ou de production, aucun déploiement ou appel Stripe.
