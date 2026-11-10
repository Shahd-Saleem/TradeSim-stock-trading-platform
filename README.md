# TradeSim UAE

Feature 3.4 adds exact portfolio analytics, realized/unrealized returns, responsive holdings, honest performance-history messaging and detailed order confirmation. See [the portfolio analytics guide](docs/phase3.4.md), [trading interface](docs/phase3.3.md) and [backend API](docs/phase3.2.md). Earlier phase descriptions below describe their original scope.

A responsive UAE paper-trading application built with Next.js App Router, React, TypeScript, CSS Modules, Prisma, PostgreSQL, Better Auth, Zod and TradingView Lightweight Charts. **Phase 2:** persistent virtual accounts and email/password authentication. All quotes, changes and volumes remain deterministic simulated fixtures, not live exchange data. Company names and symbols are illustrative identifiers; listing status is not verified.

## Run locally

Phase 2.5 adds a public landing page at `/`, public charts at `/markets`, and protected `/dashboard`, `/portfolio`, and `/activity` pages. Guests see no personal balance. See [the navigation and authentication UX guide](docs/phase2.5.md).

Requires Node.js 22.13+ and npm.

Complete the [Phase 2 environment and database setup](docs/phase2.md) before starting the application. That guide documents credentials, verified TLS, migrations, runtime-role separation and integration tests. The current workspace has already been migrated and seeded.

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
- New accounts receive AED 100,000 virtual starting capital with zero holdings. Signed-in balances persist; the guest preview remains nonpersistent.
- Explicit simulation labels and a fixed snapshot date of 9 November 2026. Trading controls are disabled.
- No external market calls. PostgreSQL and authentication provide saved accounts; the guest interface remains available.

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

Phase 2 adds PostgreSQL, Prisma, authentication and persistent virtual accounts; see [the Phase 2 implementation guide](docs/phase2.md). Phase 3 order execution remains deferred. Orders will need idempotency keys, concurrency protection and atomic balance/position updates to prevent duplicate trades, overspending and overselling. There is currently no trade execution endpoint.

The original repository contained only a README and MIT license.

## Dependency review

At implementation time, npm audit reported eight moderate advisories in the development-only ESLint dependency chain, originating from a minimatch denial-of-service advisory (GHSA-g3hv-75wg-m249). npm proposes downgrading eslint-config-next across a major version; that change has not been applied. Review an upstream compatible patch before upgrading tooling. The initial runtime-only install reported no advisories.
