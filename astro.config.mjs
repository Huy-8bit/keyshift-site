// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Published with GitHub Pages at https://huy-8bit.github.io/keyshift-site/.
// Every internal link and asset goes through `url()` in src/config.ts, which respects `base`.
export default defineConfig({
  site: 'https://huy-8bit.github.io',
  base: '/keyshift-site/',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
