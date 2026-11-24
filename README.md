# keyshift-site

Landing page for [KeyShift](https://github.com/Huy-8bit/keyshift), adaptive and selective client-side caching for Redis in Go.

Published at **https://huy-8bit.github.io/keyshift-site/** with GitHub Pages.

## Develop

```bash
npm ci
npm run dev        # http://localhost:4321/keyshift-site/
npm run verify     # astro check + build + link check (what CI runs)
node scripts/check-links.mjs --online   # also fetch every external link
npm run og         # re-render public/og.png from scripts/og.html
```

Astro, static output. Every internal link goes through `url()` in `src/config.ts` so it respects the `/keyshift-site/` base path.

## Where things live

| File | What it holds |
|---|---|
| `src/config.ts` | Every external URL (repo, Go reference, docs), version, site metadata |
| `src/content.ts` | Page copy, read-flow cases, state rules, worked example, benchmark figures, tables |
| `src/snippets.ts` | Code shown in the Get started tabs (copied from the KeyShift README) |
| `src/components/HeroFlow.astro` | Hero diagram: local cache vs Redis vs invalidations |
| `src/components/ReadFlow.astro` | Interactive "follow a read" diagram (five cases, from docs/how-it-works.md) |
| `src/components/StateMachine.astro` | Key states and transition rules (defaults from docs/adaptive-admission.md) |
| `src/components/CostCompare.astro`, `Architecture.astro` | "Cache every read vs KeyShift" panels and the fleet architecture |
| `src/styles/global.css` | The whole theme |

## Accuracy rules for edits

- Benchmark numbers come from one developer machine (Apple M1 Pro, Redis 8.6 in Docker) and must stay labelled as benchmark results, not guarantees. The 5,000-instance figure is a logical simulation.
- Don't call KeyShift production-proven or battle-tested, and don't claim strong consistency.
- No invented users, testimonials, stars or download counts.
- `MGet`, `NotifyWrite` and Valkey support stay marked "coming in the next release" until a release that contains them is tagged.

## Deploy

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. In the repository settings, Pages must use **GitHub Actions** as its source.
