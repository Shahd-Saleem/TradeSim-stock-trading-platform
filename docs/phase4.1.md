# Phase 4.1: persisted simulated daily stock prices

All prices remain fictional. The local command advances a shared simulation calendar; nothing fetches real prices, runs on page refresh, or schedules background updates. Existing accounts, cash, holdings, cost basis and trades are not rewritten. No Prisma migration, dependency or new secret is required.

## Run and test locally

Keep the existing DATABASE_URL, DIRECT_URL and verified-TLS certificate configuration. The app runtime remains unable to write quotes. The local command uses DIRECT_URL (the existing administrative connection); if it is absent, DATABASE_URL must have quote-insert privileges. Never paste those values into output or commit .env.local.

```sh
npm run market:advance
npm run dev
```

On Windows, use npm.cmd if PowerShell blocks npm.ps1. Do not start a second dev server if one is already running.

1. Note the current simulation date and prices in Markets. If you own shares, note virtual cash, cost basis, equity and unrealized P/L in Portfolio.
2. Run `npm run market:advance`. It inserts the next Monday–Friday session for all eight stocks atomically. From the original 2026-11-09 seed, the next session is 2026-11-10.
3. Refresh Markets and Portfolio. Quotes, chart endpoints, equity and unrealized returns now use the newly saved prices. Cash, quantities, acquisition basis and existing execution prices stay unchanged. A cash-only account remains AED 100,000 unless prior trades/adjustments changed cash.
4. Refresh again: prices must be identical. A browser refresh only reads PostgreSQL; it never advances the simulation.
5. Open Review Buy/Sell. Its server quote matches the saved current price. To test stale confirmation, leave the dialog open, advance another day from the terminal, then confirm. The backend rejects the old quote, reloads the preview and requires a new confirmation. It does not silently execute at the new price.

For a repeatable, retry-safe publication, specify the intended next session:

```sh
npm run market:advance -- --date 2026-11-10
```

If that complete session is already stored, this is a no-op, including when later sessions exist. Repeating the default command intentionally advances another weekday each time; use --date when retrying an uncertain command result. Concurrent commands for the same explicit date publish once. Concurrent undated commands each represent a separate request to advance one day.

The CLI prints a safe date/count summary and never database credentials. If latest dates disagree, a quote is missing, or a historical target is incomplete, it fails without silently repairing or overwriting history. Review the data before retrying. A failed insertion rolls the whole publication back.

## Optional six-month fictional history

Run `npm.cmd run market:backfill` on Windows (or `npm run market:backfill` elsewhere) to persist approximately six months of generated stock history for all eight securities. This is an explicit administrative operation, not a page-load side effect. It uses the same connection and verified TLS settings as `market:advance`.

The coverage target begins 183 calendar days before the latest stored session. Only missing history **before each security's oldest stored quote** is inserted; existing dates, prices, quote IDs and timestamps are never updated or deleted. Interior gaps are left untouched. Repeating the command with the same latest session inserts zero rows, including concurrent retries. All insertions share the existing market advisory lock and one atomic transaction.

The last backfilled weekday equals the oldest published quote's existing previous close exactly. Earlier prices are calculated backward using the same deterministic, sector-sensitive daily returns as the forward generator. Inverse arithmetic rounds to the nearest fil, half upward; replaying a rounded inverse step forward can differ by one fil. Every generated previous-close field equals the preceding generated session's closing price. Prices contain both gains and losses, not a linear interpolation. Illustrative volume is carried backward unchanged. No official exchange holidays are modeled.

After running the command, refresh Markets and select 1M, 3M and 6M. Those windows show the last 30, 90 and 180 calendar days of saved prices, so progressively more sessions should appear, ending at the same unchanged current quote. Switch stocks to verify all eight; refresh again to verify persistence. Charts label this as generated fictional history. Dates are Dubai session dates. The chart can fit the entire selected history rather than enforcing a minimum 20-pixel gap per point.

This operation does not insert portfolio valuations, infer historical holdings, or invent personal performance. Account cash, holdings, cost basis, trades, current quotes and current portfolio valuation remain unchanged. Continue using `market:advance` for new sessions after the backfill.

## Calendar and generation

Sessions are fictional Monday–Friday dates, skipping Saturday and Sunday. Public holidays are not modeled in this deliberately small phase; this is not the official DFM/ADX calendar. Each generated quote uses 15:00 Asia/Dubai (11:00 UTC) as its session timestamp. Existing legacy quote timestamps remain unchanged and are interpreted using Dubai calendar dates.

The simulation clock is manual and independent of wall-clock time. You can advance several sessions during testing, even beyond today's real date. Dates are labeled as simulated sessions, not future real market data. Each command advances exactly one eligible date; it cannot skip a weekday. There is no hidden historical backfill or future-date scheduler.

The v1 generator hashes a fixed version namespace plus session date and market/sector/security identifiers. Two centered samples produce each component, with shared market and sector movement plus security-specific noise. Utilities use lower volatility; other sectors vary more. The combined return is bounded to ±300 basis points (3%) before rounding, with no guaranteed upward drift. Movement can round to zero on some days.

`nextPriceFils = round(previousPriceFils * (10000 + returnBasisPoints) / 10000)`

All monetary arithmetic is bigint. Prices round once to the nearest fil (positive half values round upward), have a minimum of one fil, and must fit the existing safe-integer presentation range. Price-range failure aborts the entire batch. The previous close is the preceding stored session price. Existing illustrative volume is carried forward; daily volume modeling is outside this phase.

The generator is deterministic, public and educational, not unpredictable competition-grade randomness or a financial forecast. Published quotes are never regenerated. Future algorithm changes should version new generation prospectively, not rewrite old sessions.

## Persistence and consistency

Reuse the existing SimulatedQuote table and its security/timestamp uniqueness constraint. The administrative service takes an exclusive PostgreSQL transaction advisory lock scoped to the schema and inserts eight quotes in one transaction. Trades take the corresponding shared lock before the existing account-row lock, so publication cannot change the authoritative market midway through execution. Replays, signed-quote validation, cash guards and atomic holdings/history updates remain intact.

Only the command writes daily quotes; the ordinary application role still cannot insert/update/delete them. There is no HTTP mutation endpoint for advancing the market. The seed script now leaves an existing bootstrap quote untouched instead of overwriting it on reruns.

Markets, Overview highlights/watchlist, public landing prices and stock charts load the same saved market snapshot in a read-only REPEATABLE READ transaction. Fixtures are now bootstrap metadata/test data only. SSR request caching is scoped to one request, not a long-lived cache of old prices. When an order panel receives a newer authoritative quote, it refreshes server-rendered market data so listings and the selected chart can catch up without polling. Already-open idle pages otherwise update on navigation/refresh.

Account valuation continues using the latest stored quote for each holding. Equity is cash plus holdings market value; unrealized P/L is value minus remaining cost basis. Market advancement does not change cash, quantities, realized returns or basis. All ownership checks remain server-side.

## Charts and limits

The old refresh-generated 180-day fixture chart has been removed. Charts use only persisted quote rows, including the explicitly generated fictional backfill, and show an honest short-history state when only the seed exists. They show the last stored quote per Dubai date and filter the saved points for the selected calendar-day range, with at most 181 recent quote rows per security loaded. Weekend points are not fabricated. Legacy intraday rows are collapsed to that date's last saved quote for chart display only; no rows are deleted.

Stock-price history is not historical portfolio equity. Genuine portfolio valuation snapshots and performance charts remain deferred; the existing insufficient-performance-history message is preserved. No stock history is substituted for account returns.

## Verification

Run the existing typecheck, lint, test, test:integration and build npm scripts. Unit/UI tests cover Dubai midnight boundaries, valid dates, weekend/year transitions, bounded deterministic gains/losses, persisted-price rendering, selected-stock updates, short histories and exact stored chart points. PostgreSQL tests create isolated random schemas and verify all-eight publication, concurrent dated retries, atomic rollback, weekday sequencing, original quote/trade preservation, unchanged account/holding records, updated equity/unrealized P/L, denied runtime quote writes, authoritative execution and stale-token rejection. They never reset application accounts.
