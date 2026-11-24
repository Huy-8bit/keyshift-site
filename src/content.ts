// Page copy. Every statement and number here comes from the KeyShift README, docs and benchmark report;
// nothing is invented. Benchmark figures are from one developer machine and are labelled as such on the page.

export const problems = [
  {
    title: 'Write-heavy keys churn',
    body: 'Every write invalidates every cached copy, and readers can see stale values while the invalidations are in flight.',
    viz: 'churn',
  },
  {
    title: 'Redis tracks every key you read',
    body: 'With default tracking, the server’s tracking table and its invalidation traffic grow with each instance’s whole read set.',
    viz: 'tracking',
  },
  {
    title: 'Globally hot is not locally hot',
    body: 'A key read 2,000 times per second across 50 pods may be read only 40 times per second by each pod.',
    viz: 'split',
  },
] as const;

export const steps = [
  {
    title: 'Detect',
    body: 'Every read passes through a bounded hot-key detector: a sharded Space-Saving top-K with fixed memory. Counts decay every window, so old traffic fades.',
    facts: ['Space-Saving top-K', '≈ 0.8 MiB at default limits'],
  },
  {
    title: 'Decide',
    body: 'Once per window, an admission engine scores each candidate on read rate, predicted or observed hit ratio, write and invalidation rates, value size and the memory budget. A key must qualify for several windows before it is admitted.',
    facts: ['10 s window by default', 'Hysteresis'],
  },
  {
    title: 'Cache',
    body: 'Admitted keys are read through the client library’s tracked local cache. A local hit never touches the network, and Redis sends the invalidations.',
    facts: ['CLIENT TRACKING', 'go-redis or rueidis'],
  },
  {
    title: 'Watch',
    body: 'If a cached key’s measured hit ratio falls, for example because other services write it, the key is demoted and put into a cooldown that grows exponentially.',
    facts: ['Measured hit ratio', 'Exponential cooldown'],
  },
  {
    title: 'Stay safe',
    body: 'A health probe checks client tracking. If tracking cannot be confirmed, caching is suspended and the local cache is flushed. A hard bound caps how old any cached value can be.',
    facts: ['Health probe', 'max_staleness 3 s by default'],
  },
  {
    title: 'Explain',
    body: 'client.Explain(key) returns the state of any key and a human-readable reason for it, such as why it was demoted and for how long.',
    facts: ['Decision.State', 'Decision.Reason'],
  },
] as const;

export const lifecycle = [
  { state: 'cold', label: 'COLD', note: 'Reads go straight to Redis.' },
  { state: 'candidate', label: 'CANDIDATE', note: 'Qualifies, and has to keep qualifying for several windows.' },
  { state: 'admitted', label: 'ADMITTED', note: 'Read through the tracked local cache.' },
  { state: 'cooldown', label: 'COOLDOWN', note: 'Demoted after its hit ratio fell. The cooldown grows each time.' },
] as const;

export const sideStates = [
  { state: 'bypassed', label: 'BYPASSED', note: 'deny rule or oversized value' },
  { state: 'disabled', label: 'DISABLED', note: '' },
  { state: 'unhealthy', label: 'UNHEALTHY', note: '' },
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
    title: 'Keys tracked by Redis',
    context: 'Zipf workload, one instance',
    max: 32885,
    rows: [
      { label: 'Conventional', value: 32885, display: '32,885' },
      { label: 'KeyShift', value: 547, display: '≤ 547', ks: true },
    ],
    takeaway: 'About 100× fewer. KeyShift tracked a few hundred keys; 547 was the most in any scenario.',
  },
  {
    id: 'invalidations',
    title: 'Invalidation traffic',
    context: 'Open-loop Zipf run',
    max: 5739,
    rows: [
      { label: 'Conventional', value: 5739, display: '5,739' },
      { label: 'KeyShift', value: 92, display: '92', ks: true },
    ],
    takeaway: 'Only the admitted keys are tracked, so far fewer invalidations are sent.',
  },
  {
    id: 'stale',
    title: 'Stale reads, write-heavy workload',
    context: 'Open loop',
    max: 10,
    rows: [
      { label: 'Conventional', value: 6.9, display: '6.9%' },
      { label: 'KeyShift', value: 0, display: '0', ks: true },
    ],
    takeaway: 'Conventional caching served stale values up to 8.7 ms old. KeyShift refused to cache those keys.',
  },
  {
    id: 'hotshift',
    title: 'Hit ratio when the hot set shifts',
    context: 'Hot-shift scenario',
    max: 100,
    rows: [
      { label: 'Conventional', value: 71, display: '71%' },
      { label: 'KeyShift', value: 50, display: '50%', ks: true },
    ],
    takeaway: 'Conventional caching wins here, and right after a cold start: KeyShift waits for evidence before it admits a key.',
    favours: 'conventional',
  },
];

export const stats = [
  {
    value: '50–86%',
    label: 'fewer Redis GETs',
    note: 'With either approach, on workloads with locality.',
  },
  {
    value: '~0.3 µs',
    label: 'per local cache hit',
    note: 'rueidis driver at any value size; go-redis about 0.4 µs at 64 bytes. A Redis round trip in the same setup took about 0.2 ms.',
  },
  {
    value: '0',
    label: 'stale reads under faults',
    note: 'Connections killed and Redis restarted in the middle of a run.',
  },
  {
    value: 'Nothing',
    label: 'admitted when caching can’t help',
    note: 'With uniform access or oversized values, its costs matched running with no cache at all.',
  },
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

export const sdkApi = ['Get', 'GetBytes', 'GetFresh', 'Set', 'SetString', 'Del', 'Explain', 'Stats', 'ApplyPolicy'] as const;
export const sdkNext = [
  { name: 'MGet', note: 'batch reads: uncached keys go in one pipeline, and cross-slot batches work on Cluster' },
  { name: 'NotifyWrite', note: 'restores read-your-writes after a write made outside the SDK' },
] as const;
export const cliCommands = ['doctor', 'inspect', 'top', 'stats', 'instances', 'policy', 'bench', 'simulate'] as const;

export const limits = [
  {
    title: 'Eventually consistent, within bounds',
    body: 'A cached value can still be served for a short time after another client changes it. That window is bounded by invalidation delivery and by max_staleness, 3 s by default. KeyShift does not offer strong consistency.',
  },
  {
    title: 'Some data should never be cached',
    body: 'Balances, locks, rate limits and authorization data belong in <code>DenyPatterns</code>, or should be read with <code>GetFresh</code>, which always goes to Redis.',
  },
  {
    title: 'It waits for evidence',
    body: 'A key is admitted only after it qualifies for several windows. When the hot set shifts quickly, or right after a cold start, caching every read gets the higher hit ratio.',
  },
  {
    title: 'Cluster caching needs rueidis',
    body: 'With go-redis, caching works on standalone Redis. On Redis Cluster the go-redis driver does detection only; caching there uses the rueidis driver.',
  },
  {
    title: 'Version 0.1.0, before 1.0',
    body: 'APIs may change before 1.0, and KeyShift has not yet been proven in large production deployments. Try it on one service first and watch <code>Explain</code> and the dashboards.',
  },
] as const;

export const docGroups = [
  {
    title: 'Start',
    docs: [
      { file: 'quickstart.md', title: 'Quickstart' },
      { file: 'how-it-works.md', title: 'How it works' },
      { file: 'architecture.md', title: 'Architecture' },
    ],
  },
  {
    title: 'Internals',
    docs: [
      { file: 'adaptive-admission.md', title: 'Adaptive admission' },
      { file: 'hotkey-detection.md', title: 'Hot-key detection' },
      { file: 'consistency.md', title: 'Consistency' },
    ],
  },
  {
    title: 'Operate',
    docs: [
      { file: 'compatibility.md', title: 'Compatibility' },
      { file: 'observability.md', title: 'Observability' },
      { file: 'security-model.md', title: 'Security model' },
    ],
  },
  {
    title: 'Evidence',
    docs: [
      { file: 'benchmarks.md', title: 'Benchmarks' },
      { file: 'limitations.md', title: 'Limitations' },
    ],
  },
] as const;
