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
| `src/content.ts` | Page copy, benchmark figures, comparison and compatibility tables |
| `src/snippets.ts` | Code shown in the Quick start tabs (copied from the KeyShift README) |
| `src/components/KeyField.astro` | The animated hero illustration (scripted, not live data) |
| `src/styles/global.css` | The whole theme |

## Accuracy rules for edits

- Benchmark numbers come from one developer machine (Apple M1 Pro, Redis 8.6 in Docker) and must stay labelled as benchmark results, not guarantees. The 5,000-instance figure is a logical simulation.
- Don't call KeyShift production-proven or battle-tested, and don't claim strong consistency.
- No invented users, testimonials, stars or download counts.
- `MGet`, `NotifyWrite` and Valkey support stay marked "coming in the next release" until a release that contains them is tagged.

## Deploy

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. In the repository settings, Pages must use **GitHub Actions** as its source.
