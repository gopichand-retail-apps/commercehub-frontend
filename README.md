# CommerceHub Frontend

Next.js 16 storefront for the APP-02 CommerceHub portfolio demo. The dev server binds to `127.0.0.1:5301`; open it as either `127.0.0.1:5301` or `localhost:5301`. `/api/*` is proxied to the Spring Boot API at `127.0.0.1:5302`.

Shared architecture and API contract: [`../commercehub-backend/docs/architecture.md`](../commercehub-backend/docs/architecture.md) and [`../commercehub-backend/docs/openapi.yaml`](../commercehub-backend/docs/openapi.yaml).

## Start

```sh
npm install
npm run dev
```

For local development, the default mock API origin is `http://127.0.0.1:5302`.
`COMMERCEHUB_API_URL` remains a development-only fallback when the API uses a
different local origin. Production mock mode requires
`COMMERCEHUB_MOCK_API_URL`; live mode requires `COMMERCEHUB_REAL_API_URL`. These
origins are read by Next.js server rewrites, not exposed to browser code.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:identity
npm run test:unit
COMMERCEHUB_MOCK_API_URL=http://127.0.0.1:5302 npm run build
npm run test:e2e
```

`npm run test:unit` generates LCOV, JSON summary, and text coverage reports under
`coverage/`; the Jest gate enforces at least 90% statements, branches, functions,
and lines across every executable `src/**/*.{js,jsx,ts,tsx}` module plus
`next.config.ts`. The identity/session, API client, and API mode configuration
modules have additional 95% per-file gates. No UI or domain module is excluded.
Stylesheets are not part of JavaScript/TypeScript coverage counters. The
built-in Node identity tests remain a separate check, while the Jest suite
exercises the same identity code as part of the full source denominator.

The browser regression tests start an isolated API with in-memory H2 on port
5304 and a frontend on port 5303. They do not reuse the active local services
or file-backed H2 database:

```sh
npm run test:e2e
NEXT_PUBLIC_IS_MOCK=false npm run test:e2e
```

Each mode runs six browser workflows covering model locale/metadata,
API-backed catalog/quotes, promo failure recovery, mobile layout, authenticated
checkout, and session expiry. The second command verifies live-endpoint
selection against the same isolated test API. The unselected endpoint is
unreachable, so a passing suite verifies mode routing. E2E is separate from
source coverage and does not prove a real identity provider or production
database integration.

The storefront includes search, category filters, sorting, a browser-local cart, server-calculated quotes, the fictional `HELLO10` code, simulated checkout, and a session-only order lookup. It intentionally collects no customer profile or payment fields. Product images are local copies covered by the Unsplash license; attribution is not required, and a license link is provided in the footer.

Data mode defaults to `isMock=true` in [`src/lib/config.ts`](src/lib/config.ts).
Set `NEXT_PUBLIC_IS_MOCK=true|false` at Next.js dev startup or build time. Mock mode
uses `COMMERCEHUB_MOCK_API_URL`; live mode requires `COMMERCEHUB_REAL_API_URL`.
During local development only, mock mode can fall back to `COMMERCEHUB_API_URL`
or the loopback API at port 5302. These API origin settings are server-side
configuration; `NEXT_PUBLIC_IS_MOCK` is public build-time configuration, never a
secret. Rebuild/redeploy after changing deployed mode settings.

Both modes fetch role choices from `GET /api/v1/sessions/roles` and create
short-lived server-issued sessions. The session token is held in this tab's
`sessionStorage`, but authentication and order authorization are enforced by the
API. The storefront no longer selects role fixtures from the public content
model or creates guest access keys in the UI. The current backend is still a
synthetic prototype without an external identity provider or real customer
accounts; only the Customer role can place/view implemented orders. See the
[data-mode and architecture guide](../DATA_MODE_AND_ARCHITECTURE.md).

The privacy page and `robots.txt` describe/block this demo from indexing. This is not a production privacy policy or a compliance certification.
