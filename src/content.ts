// Page copy. Facts and numbers come from the KeyShift README and its docs (how-it-works.md, adaptive-admission.md,
// benchmarks.md). Nothing is invented. Benchmark figures are from one developer machine and are labelled as such.

export const capabilities = [
  {
    title: 'Finds the hot keys',
    body: 'Every read passes through a small hot-key detector with fixed memory, about 0.8 MiB at default limits. Counts fade every window, so old traffic doesn’t keep a key hot.',
  },
  {
    title: 'Caches what pays off',
    body: 'Once per window, each candidate is scored on read rate, hit ratio, writes, invalidations, value size and the memory budget. Only keys that keep qualifying are cached.',
  },
  {
    title: 'Backs off by itself',
    body: 'When invalidations show a cached key isn’t paying off, it is demoted and kept out for a while. When tracking can’t be confirmed, caching pauses and reads go to Redis.',
  },
  {
    title: 'Explains every decision',
    body: 'Ask about any key with <code>client.Explain(key)</code> and you get its state and the reason for it, in plain words.',
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
      'The read goes straight to Redis through your normal client.',
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

// Benchmark results for KeyShift itself (docs/benchmarks.md). One developer machine; not guarantees.
export const results = [
  { value: '50–86%', label: 'fewer GETs reaching Redis', note: 'On workloads with locality.' },
  {
    value: '≤ 547',
    label: 'keys tracked by Redis',
    note: 'Per instance, in any scenario. Only admitted keys are tracked, so a Zipf workload needed just a few hundred.',
  },
  {
    value: '0',
    label: 'stale reads',
    note: 'On a write-heavy workload, where it chose not to cache the busy keys, and with connections killed and Redis restarted mid-run.',
  },
  {
    value: '~0.3 µs',
    label: 'per local cache hit',
    note: 'rueidis driver, any value size; go-redis about 0.4 µs at 64 bytes. A Redis round trip on the same machine took about 0.2 ms.',
  },
  {
    value: '~0.2 s',
    label: 'to pause caching',
    note: 'When the network silently partitions, the health probe suspends caching. Measured in tests.',
  },
  {
    value: '~0.1 s',
    label: 'to aggregate 5,000 instances',
    note: 'Controller, upload p99 under 5 ms. A logical simulation on one machine, not 5,000 real pods.',
  },
] as const;

export const resultsNote =
  'On workloads where caching can’t help, such as uniform access or oversized values, KeyShift admitted nothing and added no caching cost.';

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
    body: 'A key has to qualify for a couple of windows before it is cached. Right after a cold start, or when the hot set moves quickly, it takes those windows before the new hot keys are served from memory.',
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
