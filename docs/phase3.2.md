# Feature 3.2: simulated trading backend

The Buy/Sell UI remains disabled until Feature 3.3. These endpoints execute virtual orders only. Existing accounts are never reinitialized.

## API

`POST /api/orders` requires a valid Better Auth session cookie, exact configured Origin, and application/json. The maximum body is 8 KiB. Supply only:

```json
{
  "exchange": "DFM",
  "symbol": "EMAAR",
  "side": "BUY",
  "quantity": 10,
  "idempotencyKey": "2c94e27e-f841-4bfb-9038-93784f65d30b"
}
```

Quantity must be a positive safe integer JSON number. Exchange is DFM or ADX; side is BUY or SELL. Unknown properties (including price, balance, and user ID) are rejected. No fees are modeled.

New executions return 201; successful replays return 200. The shape is `{ ok: true, replayed, trade }`. The trade contains ID, symbol, exchange, side, quantity, priceFils, totalValueFils, currency AED, simulated true, createdAt and idempotencyKey. Quantities and integer-fils money are decimal strings to preserve precision in JSON. A replay returns the original immutable trade even if quotes or balances have changed. Fetch `/api/account` for current balances and holdings.

`GET /api/orders` returns `{ ok: true, trades }`, the authenticated user's latest 100 trades, ordered by execution time then ID. Client identity hints are ignored. Responses are private/no-store. Pagination is deferred.

Errors use `{ ok: false, error: { code, message } }`: INVALID_ORDER (400), UNAUTHENTICATED (401), INVALID_ORIGIN (403), ACCOUNT_NOT_FOUND (404), IDEMPOTENCY_CONFLICT (409), BODY_TOO_LARGE (413), INVALID_CONTENT_TYPE (415), INSUFFICIENT_FUNDS / INSUFFICIENT_SHARES / UNSUPPORTED_SECURITY / ORDER_TOO_LARGE (422), QUOTE_UNAVAILABLE / TEMPORARILY_UNAVAILABLE (503). Database diagnostics and credentials are never returned. After an uncertain outcome, retry the identical order with the same key. Failed transactions do not reserve a key. Key namespaces are per account.

## Accounting and concurrency

The service obtains the user ID from the server-verified session and locks that user's account row using PostgreSQL FOR UPDATE inside a READ COMMITTED transaction. All orders for an account serialize on that row, including duplicates. Inside the lock it checks for a previous successful key, selects the latest stored simulated quote, validates funds/shares, and updates cash, holdings and history atomically. Different accounts can trade independently. Future balance-changing services must use this same account-lock protocol.

The stored simulated quote is authoritative. Fixed-date simulation snapshots are intentional; these are not live quotes. All arithmetic uses bigint fils. Holdings store total weighted cost basis: purchases add acquisition value; partial sales release `floor(total basis * sold shares / owned shares)`; closing a position releases all residual basis and removes the holding. Average unit cost is derived from total basis divided by quantity. Monetary and quantity results are bounded to the existing UI's safe-integer range; overflowing orders fail before writing.

The migration gives the restricted runtime role UPDATE on cash/updatedAt only, holding writes, and INSERT on trades. It cannot reset starting capital, reassign accounts, or update/delete history. A database trigger also rejects trade updates/deletes by the migration owner. Isolation is enforced by session-scoped server queries, not Supabase Auth RLS. Admin credentials stay outside the request path.

## Setup and verification

No new environment variables or Prisma models are required. Run `npm run db:migrate` with the existing migration connection; verified TLS configuration remains unchanged. Fresh installations run runtime-role setup after migrations; existing installations receive grants through the migration.

Run typecheck, lint, test, test:integration and build npm scripts. Trading integration tests apply the full migration chain to a random temporary schema using the restricted runtime role. They cover server quotes, accounting, rejection, ownership, immutable history, concurrent orders, duplicate keys and rollback after a deliberately failed final history insert. Only the temporary schema is removed. Existing Phase 2 tests exercise the original Phase 2 migration and its financial write denial.

Operational order rate limits, scheduling, fees, cancellations, pagination and the trading UI remain outside this feature.
