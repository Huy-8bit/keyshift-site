// Code shown on the page, copied from the KeyShift README.

export const snippets = [
  {
    id: 'quickstart',
    tab: 'Quick start',
    lang: 'go',
    intro: 'Create a client, deny the keys that must never be cached, and read as usual.',
    code: `client, err := keyshift.New(keyshift.Config{
    ServiceName: "product-service",
    Redis:       keyshift.RedisConfig{Addr: "localhost:6379"},
    Cache: keyshift.CacheConfig{
        DenyPatterns: []string{"balance:*", "lock:*"}, // never cache these
    },
})
if err != nil {
    log.Fatal(err)
}
defer client.Close()

v, err := client.Get(ctx, "product:123")
fmt.Println(client.Explain("product:123").Reason) // why is it (not) cached?`,
  },
  {
    id: 'goredis',
    tab: 'Existing go-redis client',
    lang: 'go',
    intro: 'Already have a go-redis client? Wrap it. KeyShift never reconfigures or closes it.',
    code: `rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379", PoolSize: 50})
ks, err := keyshift.NewFromGoRedis(rdb, keyshift.Config{ServiceName: "product-service"})
// KeyShift never reconfigures or closes rdb.`,
  },
  {
    id: 'install',
    tab: 'Install',
    lang: 'bash',
    intro: 'Add the SDK to your module. The CLI is optional.',
    code: `go get github.com/Huy-8bit/keyshift@latest
go install github.com/Huy-8bit/keyshift/cmd/keyshift@latest   # optional CLI`,
  },
  {
    id: 'doctor',
    tab: 'Check a server',
    lang: 'bash',
    intro: 'Point the CLI at a Redis server and check it before you turn caching on.',
    code: `keyshift doctor --redis localhost:6379`,
  },
  {
    id: 'lab',
    tab: 'Run the lab',
    lang: 'bash',
    intro: 'From a clone of the repository, start the whole stack locally.',
    code: `make docker-up   # Redis, controller, simulated pods, Prometheus, Grafana on :3000`,
  },
] as const;
