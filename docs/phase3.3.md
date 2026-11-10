# Feature 3.3: simulated Buy/Sell interface

Feature 3.4 replaces inline confirmation with an accessible dialog, removes routine quote refresh controls, reloads stale previews automatically and adds a cash-consistency guard. See [the current portfolio and confirmation guide](phase3.4.md).

Authenticated users can select a stock in Markets, choose Buy or Sell, and enter a positive whole-number quantity. The panel loads their account and the database's latest simulated quote, recalculates quantity and AED cost/proceeds, and shows available virtual cash and owned shares. It never substitutes fixture prices for a failed order quote. Guests continue to see public fixture charts without personal account data or trading controls.

Review Buy / Review Sell freezes the intended order. Confirm Buy / Confirm Sell is a separate action that sends POST /api/orders. Back to edit abandons an unsubmitted confirmation. Inputs and stock selection are disabled while confirming or resolving an order. A synchronous request guard also prevents rapid duplicate clicks.

A fresh UUID identifies each intended order. Network errors and uncertain server errors preserve the entire request, including its key and quote token; Retry same order reuses it. Unconfirmed requests are saved in sessionStorage per user and security and recovered when revisiting that stock in the same tab. Storage is optional: when unavailable, retries remain safe while the panel stays mounted. Confirmed and definitively rejected requests are cleared. A lost response cannot cause duplicate execution on retry because the backend checks successful keys before validating quote expiry.

On success the panel announces the simulated execution and fetches fresh account data and a quote. The dashboard updates virtual cash and holdings in place without a page reload. Failed account refresh does not turn a confirmed trade into a failed order or resubmit it; new orders stay disabled until refresh succeeds. Expired sessions disable submission and provide a login link with a safe Markets return destination. No new analytics or history UI is added.

## Quote contract

GET /api/orders/quote?exchange=DFM&symbol=EMAAR requires a verified Better Auth session. It returns private/no-store JSON with priceFils (safe integer), snapshotAt (simulation snapshot), expiresAt (milliseconds), and token. The token is HMAC-SHA256 signed with the existing BETTER_AUTH_SECRET and a quote-specific domain separator. No new secret or migration is required.

The interface supplies token as quoteToken on POST /api/orders. Inside the account-locked transaction, the service validates the token signature, security, quote ID, exact price and five-minute expiry against the authoritative database quote. Changed or expired quotes return QUOTE_CHANGED (409), without balance changes. The user must refresh and explicitly review again. Completed idempotent replays return the original trade even after quote expiry/change. The original Feature 3.2 API remains compatible: requests without quoteToken execute using the current database quote, without preview consistency protection. The interface always includes the token.

The five-minute validity is an order-confirmation window, not a claim that the fixed-date simulated market snapshot is live. Prices, funds and orders remain simulated; fees are not modeled. Money calculations remain integer-fils, server-side authorization remains authoritative, and the existing atomic accounting and immutable history are preserved.

## Verification

Run npm scripts typecheck, lint, test, test:integration and build. UI tests cover server-price previews, explicit confirmation on both sides, invalid inputs, insufficient funds/shares, pending guards, same-key retries, remount recovery, quote/session failures, refresh failures and refreshed balances/holdings. PostgreSQL integration tests cover authenticated quote access, tampering, expiry, in-place quote changes and successful replay after price changes in isolated temporary schemas, alongside the existing trading/authentication tests.

UI tests use jsdom and mocked HTTP responses; they do not constitute browser visual testing. The integration suite exercises real PostgreSQL and shared Next.js route handlers. No commits, deployment or real financial integrations are part of this feature.
