# Phase 2: persistent virtual accounts

This guide describes Phase 2. Feature 3.2 deliberately adds narrow runtime trading permissions and authenticated order endpoints; see [the trading backend guide](phase3.2.md) for current behavior.

Supabase hosts PostgreSQL. Prisma 7 handles the schema, migrations and application queries; Better Auth handles email/password identities and database-backed sessions. This application does not use Supabase Auth or its browser Data API.

## Local setup

1. Run `npm ci`. Prisma Client is generated on installation without requiring a reachable database.
2. Copy `.env.example` to `.env.local`, fill in a Supabase **session-pooler** or direct connection in `DATABASE_URL`, and download the database CA certificate to `certs/supabase-ca.crt`. Never commit either credentials or the local environment file. Use percent-encoding for reserved characters in connection-string passwords.
3. Run `npm run auth:setup`. This generates a random secret locally without displaying it and preserves an existing configured secret. Set `BETTER_AUTH_URL` to the exact browser origin, initially `http://localhost:3000`. External origins must use HTTPS.
4. Run `npm run db:check`, `npm run db:migrate`, then `npm run db:seed`.
5. Run `npm run db:runtime` once. This creates and verifies `tradesim_runtime`, moves the migration connection into `DIRECT_URL`, and securely updates `DATABASE_URL` to use the restricted role. It will not overwrite an existing role's password. The migration user needs permission to create schemas, functions, triggers and this runtime role.
6. Run `npm run dev`. Restart the server after changing environment variables. Visit `/register` or `/login`; sign out from the workspace header.

On Windows where npm.ps1 is blocked, use `npm.cmd` in place of `npm`. The installed development tools require a modern Node version; this project is verified with Node 24.14.1.

| Variable                    | Meaning                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`              | Restricted runtime PostgreSQL connection after role setup                                              |
| `DIRECT_URL`                | Direct/session-pooler migration and seed credentials; optional before runtime-role separation          |
| `DATABASE_CA_CERT_PATH`     | CA PEM file path used for certificate and hostname verification                                        |
| `BETTER_AUTH_SECRET`        | Locally generated authentication secret; preserve it across restarts                                   |
| `BETTER_AUTH_URL`           | Exact application origin; HTTPS except for localhost                                                   |
| `TEST_DATABASE_URL`         | Optional migration/owner connection for a separate test database                                       |
| `TEST_RUNTIME_DATABASE_URL` | Required with `TEST_DATABASE_URL`; restricted `tradesim_runtime` connection in that same test database |

The configured development project has already been migrated and seeded. The local auth secret and runtime role have already been configured. No test users are retained in the application schema.

## Schema and financial guarantees

The private `tradesim` schema contains `User`, auth `Account` (credential identities), `Session`, `Verification`, `RateLimit`, `AuthThrottle`, `VirtualAccount`, `Security`, `SimulatedQuote`, `Holding`, `Trade` and `Watchlist` tables.

Every user insert provisions exactly one virtual account in the same database transaction. Its fixed starting capital and initial cash balance are **10,000,000 integer fils = AED 100,000.00**. A unique user reference prevents duplicate accounts; deferred constraints prevent a committed user without an account. Repeated initialization does not reset balances. The credential identity table is separate from the virtual account table.

Money and share quantities use PostgreSQL BIGINT and server-side bigint arithmetic. A checked conversion bridges to Phase 1's safe integer-fils display functions; unsafe values fail instead of silently losing precision. Account balances are nonnegative, currency is AED, security symbols are unique within an exchange, holdings are unique per account/security, and trade idempotency keys are unique per account. Tables have foreign keys and indexes for ownership and history queries.

The runtime role can read financial tables but cannot insert, update or delete balances, holdings or trades. Account provisioning uses a fixed-search-path security-definer trigger owned by the migration role. Supabase `anon`, `authenticated`, and PUBLIC roles have no access to the private schema. Prisma does not automatically apply Supabase Auth RLS identities: isolation here is enforced by server-verified session ownership and private-schema privileges, not by claiming `auth.uid()` policies exist.

Migration SQL in `prisma/migrations` is immutable once applied. Use a new reviewed migration for schema changes. `db:migrate` captures Prisma's connection-bearing diagnostic output and reports a safe summary. `db:seed` upserts the eight existing simulated securities and fixed-date quotes, without creating users or orders. Market discovery and chart generation continue using the identical deterministic fixtures.

## Authentication and authorization

Registration and login accept validated names/emails/passwords. Email is normalized server-side and uniqueness is enforced in PostgreSQL. Better Auth uses salted scrypt password hashing and database-backed seven-day sessions with daily renewal. Cookies are HttpOnly, SameSite=Lax, and Secure for HTTPS origins. Cookie session caching is disabled so expired/revoked sessions are checked against the database. Logout invalidates the stored session.

Mutation requests require the exact trusted Origin. Request bodies are bounded to 8 KiB, passwords to 12–128 characters, and failures return generic messages. An atomic HMAC-email limiter allows at most eight authentication attempts per 15-minute window; Better Auth adds persistent endpoint limits. In this local configuration, the IP limiter intentionally uses a shared conservative bucket rather than trusting spoofable forwarded-IP headers. Before deployment, configure the trusted ingress/proxy identity explicitly if per-client limits are needed. No deployment is included in Phase 2.

`GET /api/account` returns 401 without a verified session, scopes queries to that session's user, and returns private/no-store responses. It never accepts a client-selected account owner. Authenticated dashboard KPIs, portfolio summaries, holdings/history views and disabled order estimates use the saved account. Database failures show an error/retry state without replacing a saved balance with initial capital. Phase 2.5 replaces the guest account preview with public market exploration without personal balances; see [the navigation guide](phase2.5.md).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Integration tests create a cryptographically random `tradesim_test_*` schema, apply the checked-in migration, grant temporary schema access to the restricted runtime role, and exercise the same authentication HTTP handler used by Next.js. They remove only that newly created schema at teardown; they never reset application accounts. If separate test URLs are absent, the migration connection creates this isolated schema in the configured development database. Do not run integration tests with production credentials.

Tests cover initial funding, salted password storage, persistence after client recreation/re-login, ownership isolation, missing/tampered sessions, origin checks, duplicate initialization, constraints, transaction rollback, runtime write denial, concurrent throttling and logout. UI tests cover guest navigation, search/filtering, chart selection, and authenticated balance use. Chart canvas rendering is mocked in jsdom; browser visual testing is separate.

## Scope boundaries

- Buy/Sell execution remains disabled and labeled **Trading available in Phase 3**. No order endpoint, balance reset endpoint, deposits, real prices or brokerage integration exist.
- Watchlists have a normalized persistence model; the current interface still explicitly shows a fixed sample watchlist. Watchlist editing is not implemented.
- Email verification and password-reset email delivery require a mail provider and are not enabled in this phase. Email addresses are not presented as verified identities.
- Historical portfolio time series are not fabricated; the dashboard shows a current balance snapshot.
- Deployment, production operational hardening, backup policy and Phase 3 execution require separate review. Eight previously reported moderate advisories remain in development lint dependencies; no automatic breaking downgrade was applied.
