# Phase 4.2: automatic daily simulated market updates

One Vercel Cron Job invokes `GET /api/cron/market` once daily using `0 12 * * *` (12:00 UTC, 16:00 Asia/Dubai). This runs in Vercel, independently of your laptop. Hobby supports daily cron within its normal function/resource allowances, with invocation anywhere in the scheduled hour rather than exact-minute precision. Vercel does not automatically retry failed cron calls: the next successful call catches up. [Vercel limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [security, retries and production execution](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

No external price feed, paid scheduler, database schema migration or historical portfolio performance is introduced. All prices remain fictional and stored in PostgreSQL.

## Manual setup before deploying this release

1. On your trusted local machine, keep the existing private `DIRECT_URL`, `DATABASE_URL` and verified-TLS certificate configuration. Run `npm.cmd run db:market-writer` once. This creates a `tradesim_market_writer` login with a random password, grants only schema usage, SELECT on Security/SimulatedQuote and INSERT on SimulatedQuote, and saves `MARKET_DATABASE_URL` privately in `.env.local`. It does not change account records or existing roles. Existing writer roles/passwords are not reset on reruns. The setup command has not been run automatically during implementation.
2. In Vercel's **Production** environment, add:

   | Variable | Value |
   | --- | --- |
   | `MARKET_DATABASE_URL` | Copy the value saved privately by the setup command. It uses the quote-only role and Supabase transaction pooler on port 6543. Do not include surrounding `.env` quotes. |
   | `CRON_SECRET` | A separate random base64url/hex secret, 32–256 characters. Generate locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. No spaces/newlines; never a `NEXT_PUBLIC_` variable. |
   | `MARKET_CRON_ENABLED` | `true` |
   | `MARKET_CLOSED_DATES` | Optional comma-separated `YYYY-MM-DD` dates for simulated holiday closures. Empty means Monday–Friday only. Use a deliberate closure list; no official exchange calendar is inferred or downloaded. |

   Keep the existing `DATABASE_URL` as the normal restricted application role and keep `DATABASE_CA_CERT` configured. Both pools use the same verified CA. Keep `DIRECT_URL` and all administrative passwords **off Vercel**. Do not grant quote writes to `tradesim_runtime`. No Supabase API key is required.
3. Review/commit/deploy this release yourself when ready. No commit, push or deployment is performed here. Vercel registers `vercel.json` cron configuration on production deployment; previews cannot run the handler even with the enabled flag. Do not copy writer credentials or the cron secret into previews.
4. In Vercel's Cron Jobs/Schedules panel, confirm the job is enabled and inspect its function logs. You can use the platform's Run action or make an authenticated GET using `Authorization: Bearer <your CRON_SECRET>` from a trusted local client. Never put the secret in a URL or paste it into chat/logs. A successful call returns JSON with the latest/target sessions, publication counts and backlog status. It is safe to retry. Merely opening the URL without the header returns 401 (503 if disabled/unconfigured).

If setup creates the writer role but local credential-file saving fails, do not recreate/reset existing user accounts. Recover by privately rotating **only that writer role's** password and configuring `MARKET_DATABASE_URL`. Check database permissions and Supabase pooler connectivity before enabling the job.

## Calendar and catch-up behavior

- Simulated sessions are Monday–Friday, excluding the explicitly configured closure dates. The simulated close is 15:00 Asia/Dubai (11:00 UTC); the scheduled hour starts one hour later. This is a fictional session policy, not a claim about the official DFM/ADX holiday calendar.
- Before today's close, the latest eligible completed session is the previous eligible date. Weekends and configured holidays retain the last published session date; they do not label Friday's price with Saturday's date.
- The handler reads the latest common date of all eight securities under an exclusive transaction advisory lock, then generates every missing eligible session in order. The server clock and server configuration determine dates; query-string target dates are rejected.
- Each invocation publishes at most 40 missed sessions in one transaction (320 quote rows), with one bulk insert. This limits runtime and database round trips. Longer gaps return `moreSessionsPending: true`; another authorized call or the next daily run continues from the committed date.
- A failed batch rolls back completely. Concurrent invocations serialize; a retry after a successful/uncertain response reads the saved date and inserts nothing already published. Existing security/timestamp uniqueness remains in force.
- If manual testing already advanced prices beyond the real completed session, the job returns `aheadOfClock: true` and does not change those published quotes. Wait for the real clock to catch up; do not delete historical prices or reset accounts to force progress.
- Closure changes affect only unpublished sessions. Dates previously published by manual commands remain immutable; interior historical gaps are not repaired. The existing `market:advance` command is a manual simulation-clock tool and can intentionally advance future dates; do not run it alongside automatic production updates. Use the authenticated catch-up endpoint for production retries.
- If any security is missing a quote or the latest eight dates disagree, publication fails safely. Review the data rather than deleting/replacing records.

## Data and UI consistency

The generator and integer-fils rounding are identical to Phase 4.1. All eight securities and all caught-up sessions publish atomically; order execution holds the matching shared market lock and continues validating signed quotes against the latest saved price. Old confirmations are rejected after a price change, requiring fresh confirmation. Historical trades, cash, holdings, weighted cost basis and realized returns are never rewritten by this job.

Markets, stock charts, account equity and unrealized P/L already read authoritative saved quotes. The displayed market session date remains the latest published date, not the current wall-clock date. No separate mutable date field or derived fake quote is added. Equity changes only through the existing cash-plus-holdings valuation; no portfolio-history rows are invented.

Open workspaces and the landing page refresh their server snapshots every five minutes while visible, and on focus/visibility return (30-second event throttle). Hidden tabs do not poll. This uses router refresh, not a full browser reload, and never generates prices. Chart dates/holdings update after the new server response; trading still checks the server quote even if a tab is stale. The UI does not claim live prices. Ordinary navigation/reload also reads the latest saved snapshot.

## Verify

Implementation checks passed: 158 unit/UI tests, 31 PostgreSQL integration tests, TypeScript, ESLint and production build. Database tests used isolated schemas only. No production prices or financial records were changed; the production writer role and Vercel environment variables have not been created/configured automatically.

- Run typecheck, lint, unit/UI tests, PostgreSQL integration tests and production build using the existing npm scripts.
- Calendar tests cover Dubai close/midnight, weekends, explicit closures and invalid dates. Endpoint tests verify missing/wrong secrets, disabled jobs, rejected query targets and sanitized errors. UI tests cover periodic refresh, hidden tabs, throttling and cleanup.
- PostgreSQL tests use isolated schemas to verify deterministic multi-day catch-up, concurrent retries, rollback, unchanged published/financial records, revaluation, current execution quotes, future-date protection and bounded backlogs. They do not advance production prices.
- After deployment, record current prices/date and run the authorized endpoint after a completed new session. Refresh Markets/Portfolio, check all eight, then retry: counts should be zero. On a weekend/closure with no backlog, the date and prices should remain unchanged.
- Monitor non-2xx invocations, `moreSessionsPending`, `aheadOfClock` and Supabase availability. Vercel timing, free-plan quotas, database pauses and network failures can delay publication; the job cannot promise an exact-minute update. Confirm the next successful run catches up.
