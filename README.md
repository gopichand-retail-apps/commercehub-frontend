# CommerceHub Frontend

![CI](https://github.com/gopichand-retail-apps/commercehub-frontend/actions/workflows/ci.yml/badge.svg)

[Architecture guide](docs/architecture.md) — source map, workflows, contracts, data, security, and checks.

## Repository layout and Windows workflow

This is the CommerceHub Next.js frontend repository. It keeps its own Git history, origin, package manifest, and lockfile; the API is the independent [commercehub-backend](https://github.com/gopichand-retail-apps/commercehub-backend) repository. Place the pair under one CommerceHub folder to use the supplied single-folder VS Code workspace.

Use Node **24.15.0** and npm with the committed lockfile. From this repository in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

The client is at http://127.0.0.1:5301; start the API separately. For both services in the complete Retail Apps workspace, use `./scripts/Start-Apps.ps1 -App CommerceHub` from the workspace root. Use `-EnvironmentName IT` only for the independent IT copies.

See the [app overview](docs/architecture.md#1-scope-users-and-repository-boundary) and [canonical architecture](docs/architecture.md). The architecture guide is included in this repository. No cross-app backend integration is added by this organization change.

Next.js 16 storefront for the APP-02 CommerceHub portfolio demo. The dev server binds to `127.0.0.1:5301`; open it as either `127.0.0.1:5301` or `localhost:5301`. `/api/*` is proxied to the Spring Boot API at `127.0.0.1:5302`.

Repository architecture and companion API contract: [repository architecture](docs/architecture.md) and [openapi.yaml](https://github.com/gopichand-retail-apps/commercehub-backend/blob/main/docs/openapi.yaml).

## Start

```sh
npm ci
npm run dev
```

For local development, the default mock API origin is `http://127.0.0.1:5302`.
`COMMERCEHUB_API_URL` remains a development-only fallback when the API uses a
different local origin. Production mock mode requires
`COMMERCEHUB_MOCK_API_URL`; live mode requires `COMMERCEHUB_REAL_API_URL`. These
origins are read by Next.js server rewrites, not exposed to browser code.

## Checks

For a clean checkout, configure the selected API and run the build before type checking so Next.js can generate its route types:

```powershell
$env:NEXT_PUBLIC_IS_MOCK = 'true'
$env:COMMERCEHUB_MOCK_API_URL = 'http://127.0.0.1:5302'
npm.cmd run build
npm.cmd run typecheck
```

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
[data-mode and architecture guide](docs/architecture.md#10-build-checks-and-deployment).

The privacy page and `robots.txt` describe/block this demo from indexing. This is not a production privacy policy or a compliance certification.

## Vercel frontend configuration

Import this frontend's GitHub repository as its own Vercel project. Set **Root Directory** to the repository root (`./`), **Node.js Version** to **24.x**, and keep the checked-in [vercel.json](vercel.json). It selects Next.js, with native Next output/routing with `npm ci` and `npm run build`. Do not set a static dist output or add an SPA rewrite over Next routes.

Set `NEXT_PUBLIC_IS_MOCK=true` and `COMMERCEHUB_MOCK_API_URL` to an approved isolated HTTPS API **origin without /api/v1**. For the other selector, set `NEXT_PUBLIC_IS_MOCK=false` and `COMMERCEHUB_REAL_API_URL`. The [environment template](.env.vercel.example) lists exact names; it is documentation, not an automatically loaded production configuration. Replace its reserved .invalid host. Changing mode or endpoints requires a new build/deployment. Both selectors still call an API; neither creates a browser-only backend or real provider integration.

The existing Next rewrite forwards /api/* to the selected API. A hosted API needs independently verified identity, persistence, exact origin/CORS and session/CSRF settings. Existing APIs remain local-only; localhost in a deployed bundle would point at the visitor or build machine.

The configuration adds noindex, frame/content-type/referrer/permission protections and no-store for the active UI model. Headers and noindex do not provide access control. Keep preview deployment protection enabled and use synthetic data. Hosted routing, cookies, headers, and user workflows have **not** been verified; no deployment is performed.

Known release gaps: The published baseline uses synthetic sessions. Verified-authentication/PostgreSQL candidate work exists separately in IT and is not included in these repositories. Formatting, development dependency, and deployment gaps remain.
