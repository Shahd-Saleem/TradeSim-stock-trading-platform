# Feature 3.4: portfolio analytics and confirmation

No schema changes, migrations, dependencies or new environment variables are required. Existing balances and accounts are preserved. Authentication, atomic execution, immutable history and per-account idempotency remain unchanged. Nothing connects to a broker or uses real money. Activity/history UI and recommendations are outside this feature.

## Valuation and returns

All accounting uses bigint integer fils. The server reads cash, positive-quantity holdings, latest stored simulated quotes, recent display trades and full-ledger aggregates in one REPEATABLE READ transaction. Sibling queries execute sequentially on its single PostgreSQL connection. Ownership filters use the server-verified user ID. There is no browser-selected account owner. Complete trade totals are independent of the 100-trade display limit.

For a holding with quantity Q, remaining total cost basis B and simulated price P:

- Average purchase price = B / Q, displayed to the nearest fil; the approximation marker makes display rounding explicit. Calculations never multiply that rounded average back into cost basis.
- Market value and estimated full-sale proceeds = Q × P.
- Unrealized P/L and estimated full-sale profit = Q × P − B.
- Unrealized percentage = (Q × P − B) / B × 100. A zero basis yields an unavailable percentage, not an infinite return.

For the whole account, let purchases be ALL recorded buy values, sales be ALL recorded sell proceeds, and remaining basis be the sum of open positions' cost bases:

- Equity = current virtual cash + current market value of open holdings. Invested funds are not added again.
- Released purchase cost = purchases − remaining basis.
- Realized P/L = sales − released purchase cost = sales − purchases + remaining basis.
- Unrealized P/L = market value − remaining basis.
- Total P/L = realized + unrealized. Percentage return uses the fixed initial AED 100,000.00 capital as denominator.

These aggregate identities use the exact remaining basis persisted by the existing trading engine. They cover multiple purchases, partial sales and closed positions without relying on timestamp sorting or inventing per-trade cost allocations. A purchase at the current quote reduces cash and increases holdings value equally; it creates no investment gain. A sale at the same quote exchanges holdings value for cash; it only moves allocated returns from unrealized to realized.

Partial sales release floor(B × sold quantity / Q) fils; a closing sale releases the full residual basis. All residual integer fils stay in the remaining holding until closure. Average unit prices round to nearest fil, and percentage returns to nearest basis point (0.01 percentage points), with half values rounded away from zero. These are presentation rounding only; realized and unrealized AED amounts retain exact integer fils. No fees, taxes or dividends are modeled.

Under ordinary trading, total P/L also equals equity minus starting capital. If a legacy/admin adjustment exists outside the trade ledger, `cashAdjustmentFils` identifies it and the UI excludes it from investment returns. The reconciliation is equity − starting capital = total P/L + cash adjustment. This feature provides no adjustment or balance-reset endpoint.

## Missing quotes and closed positions

Missing quotes are not valued at zero or replaced by fixture prices. The affected position's market value, unrealized return and sale estimates are null; whole-account equity, total return and unrealized total are unavailable. Cash, quantity, acquisition basis and realized returns remain available. Other quoted positions retain their detailed valuations. Zero-quantity positions are excluded. With no holdings, equity equals cash and unrealized P/L is zero; completed sales' realized returns remain visible.

The API continues using guarded safe-integer fils for its existing UI contract. Unsafe aggregate display values fail rather than silently lose precision. The account DTO now contains valuation completeness, realized/unrealized returns, return basis points and detailed holdings.

## Performance history

The old performance plot was a decorative flat line over a current-balance snapshot, not recorded portfolio history. The schema has no portfolio valuation series. Trade timestamps and stock chart fixtures are not substitutes for historical account equity. Overview now clearly says “Insufficient performance history” and shows current simulated equity and returns without drawing a fabricated line. Persisting a historical valuation series is deferred; a flat line would only be appropriate if genuine recorded valuations were unchanged.

Quotes remain fixed simulated snapshots, not live prices. Holdings disclose each quote's snapshot date. No stock history, invented points or purchase/sale cash movement is presented as historical investment performance.

## Trading UX and confirmation

Routine Refresh Quote controls are removed because they retrieve the same fixed simulation price. The panel loads authoritative quote/account data on entry, after completed trades and after definitive rejection. Retry loading account appears only to recover a failed data load. Signed quote expiry and price consistency are still validated inside the locked execution transaction.

Review Buy / Review Sell opens a native modal dialog with direction, company/ticker/exchange, quantity, simulated price, estimated total cost/proceeds, cash before, estimated cash after and a virtual-funds disclaimer. Cancel and Confirm Buy / Confirm Sell are explicit actions. Native dialog behavior provides focus containment and keyboard handling. Captured confirmation details remain frozen and are saved with uncertain requests for recovery.

The UI supplies `expectedCashBalanceFils` as a non-authoritative consistency guard. The backend compares it with locked database cash; a mismatch returns ACCOUNT_CHANGED (409) and requires a new confirmation. It never authorizes spending using that browser value. Existing quoteToken checks reject expired, changed or tampered quotes before writes. Rejection automatically loads an updated preview but NEVER automatically confirms or resubmits an altered order.

Successful idempotent replay is checked before quote/cash guards so a retry can retrieve its original result even after prices, balances or token expiry change. Pending submissions disable duplicate clicks. A 20-second client timeout leads to an uncertain result and safe same-key retry, not a fresh order. Uncertain dialogs can be closed and reopened without abandoning the request. Existing pre-feature pending orders lacking confirmation details show those details as unavailable and keep their original request key. Session expiry still requires sign-in.

## Verification

Run npm scripts typecheck, lint, test, test:integration and build. Unit/UI coverage includes acquisitions, weighted average, proportional/full sales, realized/unrealized gains and losses, break-even, missing quotes, external cash reconciliation, position descriptions, closed portfolios, honest history, exact confirmation amounts, cancellation, duplicate-click guards, stale/changed previews, retry recovery and fresh server props.

PostgreSQL tests use random temporary schemas, verified TLS and the restricted runtime role. They cover persisted analytics after client recreation, missing/restored quotes, full closure, more than 100 ledger entries, cross-user isolation, changed cash rejection and original-result replay, alongside existing authentication and atomic execution coverage. They never reset application accounts.

Chrome was also checked at 100% scale: Overview at 1366×768, 1440×900, 1920×1080 and 390×844; empty Portfolio at desktop width; and Buy confirmation at desktop/mobile widths. Screenshots are retained under ignored `.artifacts/feature-3.4/`. No horizontal overflow was detected. The visual check used a new temporary account, submitted no orders and deleted only that account afterward. Filled-position cards are covered by jsdom and real-database analytics tests, not by the browser screenshots.
