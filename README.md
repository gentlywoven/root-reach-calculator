# Root Reach Calculator

A faction picker for the [Root](https://ledergames.com/products/root-a-game-of-woodland-might-and-right) board game that tracks reach values and shows which factions are still viable for the current player count.

Live at **[gentlywoven.github.io/root-reach-calculator](https://gentlywoven.github.io/root-reach-calculator/)**

> Unofficial fan-made tool, not affiliated with Leder Games or [Root](https://ledergames.com/products/root-a-game-of-woodland-might-and-right). Released under the [MIT License](./LICENSE).

## About this fork

This repository is a fork of the [upstream Root Reach Calculator](https://github.com/RuTsEST/root-reach-calculator). It is a working base for upcoming changes; fork-specific changes will be documented here as they are made.

## How to use

- **Ban vs Pick** — Ban marks factions out of the draft without adding reach; Pick selects them and adds their reach to the total. Switch with the Ban/Pick toggle.
- **Players vs bots** — Choose a player count (2–6) for standard games, or **1 Bot** / **2 Bots** for Clockwork-style setups. The reach target updates with the mode.
- **Official rules** — Reach targets for player counts follow [Root](https://ledergames.com/products/root-a-game-of-woodland-might-and-right) / Leder Games. Bot (Clockwork) thresholds in this tool are **unofficial estimates**, not from the Clockwork rulebook.
- **Encoded special rules** — Second Vagabond is only available after the first is picked; Knaves of the Deepwood and either Vagabond are mutually exclusive. Factions that cannot still meet the reach target are grayed out.

## Development

```bash
npm start        # dev server at localhost:3000
npm test         # unit tests
```

## Deploy

Pushes to `master` build the CRA app and deploy to GitHub Pages via GitHub Actions ([`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml)). You can also run the workflow manually from the Actions tab.

`package.json` `homepage` is `https://gentlywoven.github.io/root-reach-calculator/` so asset paths stay correct for the project site.

### Manual fallback

If you need to publish from a laptop without waiting on Actions:

```bash
npm run build && npx gh-pages -d build
```

Build explicitly first — the `predeploy` hook is unreliable when the dev server is running. Verify faction images are in `build/static/media/` before deploying. GitHub Pages CDN can take a few minutes to propagate.

## Analytics and privacy

Privacy-friendly visit tracking via [GoatCounter](https://www.goatcounter.com/) (no cookies, no consent banner), loaded only on `gentlywoven.github.io`. Dashboard: https://gentlywoven.goatcounter.com
