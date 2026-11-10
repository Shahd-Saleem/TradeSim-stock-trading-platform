# Vercel production deployment

This is a deployment checklist, not an automated deployment. Use the existing Supabase project and its existing `tradesim` schema. Nothing in the build migrates, seeds, resets accounts, or generates prices.

## Vercel project settings

- Framework preset: **Next.js**. Root directory: the repository root.
- Node.js: **24.x**, matching `package.json` and the tested local runtime. See [supported versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- Install command: `npm ci` (include development dependencies; Prisma CLI is needed during generation).
- Build command: `npm run build`. Output directory: leave the Next.js default. Do not set a static export or Edge runtime; Prisma uses Node.js.
- Choose a function region near your Supabase database to reduce transaction latency.
- Decide the final canonical HTTPS hostname before configuring authentication, for example `https://YOUR-PROJECT.vercel.app`. Use that exact hostname for testing; a different alias or deployment-preview hostname is not a trusted auth origin.

## Environment variables

Configure these as **server-only Production** variables before the first deployment. Never use `NEXT_PUBLIC_` prefixes. Do not paste credentials into source, build commands, screenshots or issue reports.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Existing restricted `tradesim_runtime` connection, using the Supabase pooler hostname and URL-encoded password. Transaction pooling on port 6543 is intended for serverless; keep administrative credentials out of this URL. Copy the connection details for your project, retaining the restricted role and project suffix. |
| `DATABASE_CA_CERT` | Complete contents of `certs/supabase-ca.crt`, including the BEGIN/END CERTIFICATE lines. Paste PEM text with newlines; literal `\n` sequences are also accepted. This is a public CA certificate, never a private key. |
| `BETTER_AUTH_URL` | Exact canonical production origin, e.g. `https://YOUR-PROJECT.vercel.app`, without a path or trailing slash. Do not leave localhost here. |
| `BETTER_AUTH_SECRET` | A cryptographically random production secret, at least 32 characters. Generate locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`, then save privately. Keep stable across deployments. Changing it invalidates sessions/signed order previews; passwords and account records remain stored. |

Leave `DATABASE_CA_CERT_PATH` **unset on Vercel**: `certs/` is intentionally ignored and will not exist in a Git-based deployment. Inline CA configuration takes precedence over a path, and certificate/hostname verification remains enabled. No `NODE_TLS_REJECT_UNAUTHORIZED=0` or insecure SSL settings are needed or supported.

Do **not** add `DIRECT_URL`, test-database variables or an administrative Supabase password to Vercel. No Supabase anon/service-role API key is needed; this application uses PostgreSQL and Better Auth, not Supabase Auth. Do not set `NODE_ENV` manually. Prisma generation does not connect to PostgreSQL and can run with only runtime credentials configured.

Supabase recommends transaction pooling for serverless and session/direct connections for administrative workflows: [Prisma connection guide](https://supabase.com/docs/guides/database/prisma). The Prisma 7 adapter uses the existing `pg` pool (five connections per function instance), not Prisma 6 URL connection-limit settings. Pooling does not eliminate project-wide connection limits; monitor these if usage grows. Confirm transaction-pooler connectivity with the actual production credentials before accepting traffic. The currently working session-pooler URL is a temporary fallback if needed, with less efficient connection sharing under concurrency.

The local production smoke test during this review successfully served saved market data through this project's transaction pooler on port 6543, using the restricted role and inline CA with no administrative URL. It does not verify Vercel's network access or your future hostname settings.

## Migrations and existing data

The two committed migrations are `20261110000100_phase2` and `20261111000100_trading`. The deployment review compares their file checksums against the existing database; no new migration is introduced by deployment preparation.

Keep the administrative `DIRECT_URL` and `DATABASE_CA_CERT_PATH` in your private local `.env.local`. Before a future release that adds migrations, back up the database and run `npm.cmd run db:migrate` locally (or in a separately secured release job) using a direct/session connection on port 5432. It runs `prisma migrate deploy`, not `migrate dev`, and does not reset data. This command needs the local CA path for the Prisma migration engine; the inline runtime certificate is not a substitute for its file setting.

Do not add migration commands to every Vercel/preview build, run `db push`, reset the database, re-create the runtime role, or seed on deployment. Your securities, saved price history, users, trades, holdings and cash already exist. Runtime quote/trade-history permissions remain restricted. Keep the `tradesim` schema out of Supabase Data API exposed schemas; browser clients must use the authorized Next.js endpoints.

## Preview deployments and launch verification

Production credentials should not be shared with arbitrary previews. Leave Preview variables unset/disable automatic previews until you have a separate test Supabase project and a specific HTTPS preview auth origin. A preview without required variables may fail to build or serve routes; that does not justify copying production credentials into every preview. Wildcard trusted origins are intentionally not enabled.

Before public use, verify on the canonical production hostname:

1. Landing and Markets load saved simulated quotes/charts; guests see no personal balances.
2. Register a test user and confirm exactly AED 100,000.00, then log out and back in. Check protected pages and guest redirects.
3. `/api/account` without a cookie returns 401/no-store. Untrusted-origin auth/order POSTs return 403. Different users see only their own records.
4. Confirm secure, HTTP-only session cookies and successful logout. Existing database-backed session and email throttles work across instances.
5. If you choose to test an order, use a dedicated virtual test account: orders persist. Do not place verification trades on existing user accounts.

Authentication uses password hashing, exact-origin POST checks, secure cookies over HTTPS, seven-day database sessions and persistent throttling. Email verification and password reset email delivery are not configured; an SMTP service is not required for the current sign-up/login flow, but recovery and verified ownership are limitations to resolve before a broader public launch. No credentials or raw database errors are returned from the protected API handlers.

Phase 4.2 adds an opt-in daily Vercel job at `/api/cron/market`. Follow [automatic market setup](phase4.2.md) to add its separate quote-only writer connection, cron secret, enabled flag and optional closure dates. No administrative credentials are required on Vercel. Until configured and deployed, updates remain manual. Open visible pages periodically refresh saved data. Do not call `market:backfill` on every build or use the future-advancing manual command for automatic production updates.

Use `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run test:integration` and `npm.cmd run build` before release. Integration tests create and remove isolated random schemas, not production account records. After starting a local production server, `node scripts/smoke-http.mjs http://localhost:3000` checks public routes, guest redirects and private API protection without creating users or orders.

## Common blockers

- Missing/incorrect CA PEM, database URL, runtime-role password, paused Supabase project, network restrictions or exhausted connections cause route/database failures even if compilation passes.
- An old localhost URL, HTTP origin, extra URL path or different hostname causes cookie/origin failures. Add/change environment variables and redeploy to apply them.
- Missing ignored files are expected on Vercel; use inline CA and the build's Prisma generation step, not copied local generated Prisma output.
- An uncommitted local change is not part of a Git-based deployment. Review and commit the intended release yourself before importing/deploying it. No commit, push or deployment is performed by this preparation.
- Vercel Hobby is for personal, non-commercial projects and has resource limits; choose a suitable plan for your intended use. [Plan terms](https://vercel.com/docs/plans/hobby).

## Review results (November 10, 2026)

- TypeScript and ESLint passed; 136 unit/UI tests and 28 PostgreSQL integration tests passed.
- Production build passed; Prisma generation also passed with a placeholder transaction-pooler URL and no usable migration credentials/certificate file.
- All 11 local production HTTP checks passed, including guest isolation, protected-route redirects, 401 private API responses, origin rejection and security headers.
- Read-only checks verified client TLS, both applied migration checksums, restricted runtime privileges and all eight securities with saved quotes.
- The production dependency audit reported zero known vulnerabilities. The npm check required the Windows trusted certificate store (`NODE_USE_SYSTEM_CA=1`); certificate verification was never disabled.
- No deployment, application-data migration, reset, seed, account mutation, commit or push was performed. Vercel environment settings and canonical-domain authentication still require manual setup and post-deployment verification.
