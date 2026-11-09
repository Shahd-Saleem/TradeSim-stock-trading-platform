# TradeSim UAE

A responsive UAE paper-trading interface built with Next.js App Router, React, TypeScript, CSS Modules, Zod and TradingView Lightweight Charts. **Phase 1 only:** all quotes, changes and volumes are deterministic simulated fixtures, not live exchange data. Company names and symbols are illustrative identifiers; listing status is not verified.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. If PowerShell blocks npm.ps1, use `npm.cmd` instead of `npm`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Phase 1

- Responsive dark dashboard with named, consistently sized Lucide icons for Overview, Markets, Portfolio and Activity navigation.
- Overview focuses on account KPIs, a cash-only performance summary, a compact sample watchlist and simulated market highlights. It does not invent historical returns or holdings. Watchlist and highlight selections open the stock in Markets.
- Markets provides a dedicated searchable table of eight illustrative DFM/ADX stocks, exchange filters, selected-stock details and an interactive chart with 1M, 3M and 6M windows. Hover, zoom and pan are supported.
- Buy/Sell order preview with quantity input, exact integer-fils AED estimates, available virtual balance and zero shares held. Invalid quantities, unsafe amounts, insufficient funds and insufficient holdings produce accessible feedback. The estimate excludes fees. Submission is always disabled and labeled **Trading available in Phase 3**; there is no order endpoint or account mutation.
- AED 100,000 virtual starting capital, zero holdings and zero profit/loss. This local preview is not an authenticated account; state resets on reload.
- Explicit simulation labels and a fixed snapshot date of 9 November 2026. Trading controls are disabled.
- No external market calls, secrets, database or sign-in required.

## Architecture

- `src/app`: App Router server entry point, metadata and global reset.
- `src/components/Dashboard.tsx`: client navigation, filters and stock selection; `Dashboard.module.css` provides responsive styling.
- `src/components/AccountOverview.tsx`: account performance, sample watchlist and market highlights.
- `src/components/OrderPreview.tsx`: interactive Buy/Sell estimation only. Values recalculate on stock, side or quantity changes.
- `src/components/PriceChart.tsx`: isolated chart lifecycle, resizing and cleanup. Numeric AED values are used only for presentation/chart coordinates. Charts are attributed to [TradingView](https://www.tradingview.com/) per the [Lightweight Charts documentation](https://tradingview.github.io/lightweight-charts/docs).
- `src/lib/market.ts`: Zod-validated fixtures and seeded UTC history, independent of runtime clocks and randomness. Each chart ends at its quoted price.
- `src/lib/money.ts`: integer-fils arithmetic with safe-integer guards. AED 100,000 is 10,000,000 fils. Position valuation rejects negative or fractional inputs and unsafe products.
- `src/lib/market.test.ts`: tests for financial primitives and deterministic history.
- `src/lib/order-preview.ts` and its tests: pure quantity parsing, safe estimates, balance and holdings feedback. These are preview checks, not server-side execution validation.
- `src/components/Dashboard.test.tsx`: jsdom interaction tests for navigation, distinct views, filters, empty search results, stock/chart selection and disabled order previews. The chart renderer is mocked; these tests do not assert canvas rendering or visual layout.

No holdings or transactions are fabricated. Portfolio analytics show the initial cash-only state.

## Later phases — pending review

PostgreSQL, Prisma, authentication and order execution are deliberately deferred. Planned server boundaries include authenticated user-specific portfolios, Zod request validation, decimal-safe storage and atomic database transactions. Orders must use idempotency keys, concurrency protection and balance/position constraints to prevent duplicate trades, overspending and overselling. These guarantees are **not implemented or claimed in Phase 1**. Add transaction rollback, concurrency, authorization and retry integration tests with that implementation.

The original repository contained only a README and MIT license.

## Dependency review

At implementation time, npm audit reported eight moderate advisories in the development-only ESLint dependency chain, originating from a minimatch denial-of-service advisory (GHSA-g3hv-75wg-m249). npm proposes downgrading eslint-config-next across a major version; that change has not been applied. Review an upstream compatible patch before upgrading tooling. The initial runtime-only install reported no advisories.
