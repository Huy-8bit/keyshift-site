// Every external URL on the site lives here, so it can be changed in one place.

const REPO = 'https://github.com/Huy-8bit/keyshift';
const blob = (file: string) => `${REPO}/blob/main/${file}`;

export const LINKS = {
  repo: REPO,
  pkg: 'https://pkg.go.dev/github.com/Huy-8bit/keyshift/pkg/keyshift',
  changelog: blob('CHANGELOG.md'),
  contributing: blob('CONTRIBUTING.md'),
  security: blob('SECURITY.md'),
  license: blob('LICENSE'),
  issues: `${REPO}/issues`,
  docs: `${REPO}/tree/main/docs`,
  portfolio: 'https://huy-8bit.github.io/',
} as const;

/** Documentation that lives in the repository under /docs. */
export const doc = (name: string) => blob(`docs/${name}`);

export const SITE = {
  name: 'KeyShift',
  version: '0.1.0',
  tagline: 'Detect hot keys. Cache intelligently. Scale efficiently.',
  title: 'KeyShift: adaptive, selective client-side caching for Redis in Go',
  description:
    'KeyShift is a Go SDK that finds the Redis keys worth caching in each application instance and serves them from local memory, with invalidation from Redis client tracking. Every other read goes straight to Redis.',
  author: 'Nguyen Gia Huy',
  year: 2026,
} as const;

export const INSTALL = 'go get github.com/Huy-8bit/keyshift@latest';

/** Prefix a site path with the configured base path (/keyshift-site/). */
export function url(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (/^(https?:|mailto:|#)/.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
