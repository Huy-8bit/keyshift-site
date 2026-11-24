// Page copy. Facts and numbers come from the KeyShift README and its docs (how-it-works.md, adaptive-admission.md,
// benchmarks.md). Nothing is invented. Benchmark figures are from one developer machine and are labelled as such.

export const costs = [
  {
    title: 'Busy keys keep getting thrown away',
    body: 'Every write invalidates every cached copy of a key. Until that invalidation arrives, readers can still get the old value.',
  },
  {
    title: 'Redis has to remember everything you read',
    body: 'With default tracking, Redis keeps a record of every key each instance has read. The tracking table and the invalidation traffic grow with the whole read set, not just the hot part.',
  },
  {
    title: 'Hot across the fleet, lukewarm on each pod',
    body: 'A key read 2,000 times a second across 50 pods is read only 40 times a second by each one.',
  },
] as const;

export type Scenario = {
  id: string;
  label: string;
  title: string;
  steps: string[];
  note?: string;
};

// The five paths a read (or a change) can take. Mirrors docs/how-it-works.md.
export const scenarios: Scenario[] = [
  {
    id: 'cold',
    label: 'Not cached',
    title: 'Most keys: straight to Redis',
    steps: [
      'Your code calls <code>client.Get(ctx, key)</code>.',
      'KeyShift checks the admitted set. This key isn’t in it.',
      'The read goes to Redis through your normal client, exactly as it would without KeyShift.',
      'The hot-key detector records the read and the size of the value.',
    ],
  },
  {
    id: 'hit',
    label: 'Cache hit',
    title: 'An admitted key, already in memory',
    steps: [
      'The key is in the admitted set, so the read goes to the local cache.',
      'The value is there, and it comes back from process memory without touching the network.',
      'The hit is counted, so a cached key doesn’t look cold just because it stopped reaching Redis.',
    ],
  },
  {
    id: 'miss',
    label: 'Cache miss',
    title: 'First read after a key is admitted',
    steps: [
      'The key was just admitted, or its copy was dropped, so the local cache misses.',
      'The client sends the <code>GET</code> on a connection with client tracking turned on.',
      'Redis returns the value and remembers that this connection holds the key.',
      'The value is stored locally. From the next read on, it comes from memory.',
    ],
  },
  {
    id: 'write',
    label: 'Key changes',
    title: 'Someone else writes the key',
    steps: [
      'Another service writes or deletes the key, or it expires.',
      'Redis pushes an invalidation to every connection that tracks the key.',
      'The local copy is dropped and KeyShift counts the invalidation.',
      'The next read fetches the new value from Redis.',
    ],
    note: 'Writes made through KeyShift itself drop the local copy as soon as they return. And no cached value is ever older than max_staleness, 3 s by default.',
  },
  {
    id: 'unhealthy',
    label: 'Tracking lost',
    title: 'When tracking can’t be confirmed',
    steps: [
      'A health probe checks the tracked path every second.',
      'A probe fails or times out, or a cached read hits a transport error.',
      'KeyShift empties the admitted set and flushes the local cache.',
      'Every read goes to Redis until probes pass again. Caching restarts from an empty cache.',
    ],
  },
];

// State transitions with their default thresholds (docs/adaptive-admission.md).
export const transitions = [
  { from: 'cold', to: 'candidate', when: 'Read rate reaches 2/s and the predicted hit ratio reaches 0.6.' },
  { from: 'candidate', to: 'admitted', when: 'It qualifies two windows in a row and fits in the memory budget.' },
  { from: 'admitted', to: 'cooldown', when: 'The measured hit ratio drops below 0.3, usually because something else writes the key.' },
  { from: 'cooldown', to: 'cold', when: 'The cooldown ends: 30 s at first, doubling with each strike, up to 16×.' },
  { from: 'candidate', to: 'cold', when: 'It stops qualifying.' },
  { from: 'admitted', to: 'cold', when: 'Its read rate stays under 1/s for three windows.' },
] as const;

export const otherStates = [
  { state: 'bypassed', label: 'BYPASSED', note: 'Matches a deny pattern, or the value is over 64 KiB.' },
  { state: 'disabled', label: 'DISABLED', note: 'Caching is switched off by configuration.' },
  { state: 'unhealthy', label: 'UNHEALTHY', note: 'Tracking can’t be confirmed, so caching is paused for every key.' },
] as const;

// Worked example from docs/how-it-works.md: one pod, six keys.
export const worked = [
  { key: 'product:123', reads: '2,000/s', writes: 'none', state: 'admitted', outcome: 'Admitted after two windows. About 99.9% of reads are local hits.' },
  { key: 'stock:7', reads: '15/s', writes: '25/s, another service', state: 'cooldown', outcome: 'Admitted on probation, then its measured hit ratio is close to zero. Cooldown, longer each time.' },
  { key: 'counter:views', reads: '500/s', writes: '400/s, this pod', state: 'cold', outcome: 'Predicted hit ratio is under 0.6, so it is never admitted.' },
  { key: 'config:flags', reads: '0.5/s', writes: 'rare', state: 'cold', outcome: 'Too few reads to be worth it, unless you pin it.' },
  { key: 'balance:42', reads: '900/s', writes: 'rare', state: 'bypassed', outcome: 'Matches a deny pattern, so it is never cached.' },
  { key: 'report:2026', reads: '50/s', writes: 'none', state: 'bypassed', outcome: 'The value is 2 MiB, over the size limit.' },
] as const;

export type BarChart = {
  id: string;
  title: string;
  context: string;
  max: number;
  rows: { label: string; value: number; display: string; ks?: boolean }[];
  takeaway: string;
  favours?: 'keyshift' | 'conventional';
};

export const charts: BarChart[] = [
  {
    id: 'tracked',
    title: 'Keys Redis had to track',
    context: 'Zipf workload, one instance',
    max: 32885,
    rows: [
      { label: 'Cache every read', value: 32885, display: '32,885' },
      { label: 'KeyShift', value: 547, display: '≤ 547', ks: true },
    ],
    takeaway: 'About 100× fewer. KeyShift tracked a few hundred keys, and never more than 547 in any scenario.',
  },
  {
    id: 'invalidations',
    title: 'Invalidations sent',
    context: 'Open-loop Zipf run',
    max: 5739,
    rows: [
      { label: 'Cache every read', value: 5739, display: '5,739' },
      { label: 'KeyShift', value: 92, display: '92', ks: true },
    ],
    takeaway: 'Fewer tracked keys means far fewer invalidations to send.',
  },
  {
    id: 'stale',
    title: 'Stale reads on a write-heavy workload',
    context: 'Open loop',
    max: 10,
    rows: [
      { label: 'Cache every read', value: 6.9, display: '6.9%' },
      { label: 'KeyShift', value: 0, display: '0', ks: true },
    ],
    takeaway: 'The stale values were up to 8.7 ms old. KeyShift didn’t cache those keys at all.',
  },
  {
    id: 'hotshift',
    title: 'Hit ratio when the hot set moves',
    context: 'Hot-shift scenario',
    max: 100,
    rows: [
      { label: 'Cache every read', value: 71, display: '71%' },
      { label: 'KeyShift', value: 50, display: '50%', ks: true },
    ],
    takeaway: 'Caching everything wins here, and right after a cold start, because KeyShift waits for evidence first.',
    favours: 'conventional',
  },
];

export const alsoMeasured = [
  'Both approaches took 50–86% of GETs off Redis on workloads with locality.',
  'A local hit took about 0.3 µs with rueidis at any value size, and about 0.4 µs with go-redis at 64 bytes. A Redis round trip on the same machine took about 0.2 ms.',
  'With connections killed and Redis restarted mid-run, KeyShift served no stale reads.',
  'Where caching can’t help (uniform access, oversized values), it admitted nothing and cost the same as running without a cache.',
  'In a logical simulation of 5,000 SDK instances on one machine, the controller aggregated the fleet in about 0.1 s, with upload p99 under 5 ms. It is a simulation, not 5,000 real pods.',
] as const;

export const comparison = {
  head: ['', 'go-redis client-side cache', 'rueidis DoCache', 'KeyShift'],
  rows: [
    ['What gets cached', 'Every cacheable read', 'Whatever the caller chooses', 'Keys admitted by measured local benefit'],
    ['Keys tracked by Redis', 'Every key read', 'Cached keys (OPTIN)', 'Cached keys only, on both drivers'],
    ['Write-heavy keys', 'Cached anyway', 'Cached if requested', 'Rejected or put in cooldown'],
    ['Hot-key detection', '–', '–', 'Yes'],
    ['Silent network partition', 'Bounded by MaxStaleness', 'Bounded by client TTL', 'Health probe suspends caching (~0.2 s in tests)'],
    ['Fleet view and policies', '–', '–', 'Optional controller'],
  ],
} as const;

export type Support = 'caching' | 'detection' | 'direct';
export const compatibility: { server: string; goredis: [Support, string]; rueidis: [Support, string]; next?: boolean }[] = [
  { server: 'Redis 6.2, 7.4, 8.4, 8.6 (standalone)', goredis: ['caching', 'Caching (DB 0)'], rueidis: ['caching', 'Caching'] },
  { server: 'Redis Cluster 8.6', goredis: ['detection', 'Detection only'], rueidis: ['caching', 'Caching'] },
  { server: 'Valkey 8.1, 9.0 (standalone)', goredis: ['caching', 'Caching'], rueidis: ['caching', 'Caching'], next: true },
  { server: 'No RESP3 or no CLIENT permission', goredis: ['direct', 'Direct reads'], rueidis: ['direct', 'Direct reads'] },
];

export const components = [
  {
    name: 'Go SDK',
    tag: 'pkg/keyshift',
    body: 'Does all the work inside your process. Wrap the go-redis client you already have, or let it create one. <code>Get</code>, <code>GetBytes</code>, <code>GetFresh</code>, <code>Set</code>, <code>SetString</code>, <code>Del</code>, <code>Explain</code>, <code>Stats</code> and <code>ApplyPolicy</code>.',
    next: 'Coming in the next release: <code>MGet</code> for batch reads, and <code>NotifyWrite</code> to restore read-your-writes after a write made outside the SDK.',
  },
  {
    name: 'Controller',
    tag: 'optional',
    body: 'Collects telemetry from every instance and ranks hot keys across the fleet, so you can tell keys that are hot on one pod from keys that are hot everywhere. Rolls out versioned policies in stages, with rollback, behind a REST API with ingest, viewer and admin tokens.',
  },
  {
    name: 'Grafana dashboards',
    tag: 'Prometheus',
    body: 'Two ready-made dashboards, KeyShift Fleet and KeyShift SDK. Metrics never carry raw key names: keys are sent as HMAC fingerprints unless you explicitly allow them.',
  },
  {
    name: 'CLI',
    tag: 'keyshift',
    body: '<code>doctor</code>, <code>inspect</code>, <code>top</code>, <code>stats</code>, <code>instances</code>, <code>policy</code>, <code>bench</code> and <code>simulate</code>. It can also run opt-in, time-limited Redis 8.6 HOTKEYS sessions on the server.',
  },
  {
    name: 'Lab',
    tag: 'Docker Compose',
    body: '<code>make docker-up</code> starts Redis, the controller, simulated pods, Prometheus and Grafana on one machine. It also has fault-injection tests, the benchmark suite and a 5,000-instance control-plane simulation.',
  },
] as const;

export const limits = [
  {
    title: 'It’s eventually consistent',
    body: 'A cached value can be served for a moment after someone else changes it. Invalidation delivery and <code>max_staleness</code> (3 s by default) bound how long that moment can be. There is no strong consistency.',
  },
  {
    title: 'Some data should never be cached',
    body: 'Put balances, locks, rate limits and authorization data in <code>DenyPatterns</code>, or read them with <code>GetFresh</code>, which always asks Redis.',
  },
  {
    title: 'It waits for evidence',
    body: 'A key needs a couple of windows of good numbers before it is cached. Right after a cold start, or when the hot set moves quickly, caching every read gets more hits.',
  },
  {
    title: 'Redis Cluster needs rueidis',
    body: 'With go-redis, caching works on standalone Redis. On Redis Cluster, go-redis only detects hot keys, and caching uses the rueidis driver.',
  },
  {
    title: 'It’s still young',
    body: 'This is version 0.1.0. APIs may change before 1.0, and KeyShift hasn’t been proven in large production deployments yet.',
  },
] as const;

export const docs = [
  { file: 'quickstart.md', title: 'Quickstart' },
  { file: 'how-it-works.md', title: 'How it works' },
  { file: 'architecture.md', title: 'Architecture' },
  { file: 'adaptive-admission.md', title: 'Adaptive admission' },
  { file: 'hotkey-detection.md', title: 'Hot-key detection' },
  { file: 'consistency.md', title: 'Consistency' },
  { file: 'compatibility.md', title: 'Compatibility' },
  { file: 'observability.md', title: 'Observability' },
  { file: 'security-model.md', title: 'Security model' },
  { file: 'benchmarks.md', title: 'Benchmarks' },
  { file: 'limitations.md', title: 'Limitations' },
] as const;
