# VOID game API Worker

Cloudflare Worker proxy for IGDB game search/details and HowLongToBeat completion data.

## Security controls

- **Origin allowlist:** Requests are accepted only from `ALLOWED_ORIGINS`. Originless requests are rejected by default. Set `ALLOW_ORIGINLESS_REQUESTS="true"` only if a trusted non-browser client requires access.
- **Rate limiting:** Cloudflare's native rate-limit binding allows 120 requests per minute per Cloudflare client IP and route group (`search` or `details`). Adjust the `[[ratelimits]]` block in `wrangler.toml` if production traffic requires a different limit.
- **Input limits:** URLs are limited to 2,048 characters, search text to 100 characters, and unsupported query parameters are rejected.
- **Monitoring:** Blocked origins, rate-limit events, and upstream failures emit structured JSON logs containing the event, route, origin, and Cloudflare Ray ID. Queries and credentials are never logged.

CORS is not authentication. A shared API secret was deliberately not embedded in the static web client because any browser-delivered secret can be extracted. The origin check reduces browser abuse and native rate limiting limits direct clients. If stronger caller identity becomes necessary, use a server-issued short-lived signed token, Cloudflare Access, or Turnstile rather than a permanent `NEXT_PUBLIC_*` secret.

## Configuration

Set Worker secrets:

```sh
npx wrangler secret put IGDB_CLIENT_ID --config worker/wrangler.toml
npx wrangler secret put IGDB_CLIENT_SECRET --config worker/wrangler.toml
```

Configure allowed origins in `worker/wrangler.toml` or the Cloudflare dashboard:

```toml
[vars]
ALLOWED_ORIGINS = "https://tinykings.github.io,http://localhost:3000"
ALLOW_ORIGINLESS_REQUESTS = "false"
```

For Capacitor or another client with a different origin, add its exact runtime origin to `ALLOWED_ORIGINS`; do not use `*` in production.

## Verification

Run a deployment dry run:

```sh
npx wrangler deploy --dry-run --config worker/wrangler.toml
```

Local requests must include an allowed `Origin` header unless originless requests are explicitly enabled:

```sh
curl -H 'Origin: http://localhost:3000' 'http://localhost:8787/api/games/search?q=halo'
```
