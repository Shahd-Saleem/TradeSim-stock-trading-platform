# Feature 3.1: desktop layout and responsiveness

The workspace now uses a 208px desktop sidebar, a 60px header, narrower content gutters, and more compact card/panel spacing. The 14px base font is unchanged; financial table headers and cells are slightly larger for readability. Large screens no longer inflate KPI typography automatically.

Money cards use zero-minimum grid tracks and permit amounts to wrap at narrow widths. Financial tables retain their own horizontal scroll containers on small screens without widening the page. No global scale, CSS zoom, or page-wide overflow hiding is used.

PriceChart now derives height from its CSS container through Lightweight Charts' automatic resizing: 220–260px on desktop according to viewport height, with the existing 280px mobile/tablet height preserved. Financial-table styling is scoped to `.tableScroll` so it cannot add borders to TradingView's internal layout table.

## Measured desktop results at 100% zoom

| Viewport    | Previous KPI row | Updated KPI row | Updated chart height |
| ----------- | ---------------- | --------------- | -------------------- |
| 1366 × 768  | 139px            | 120px           | 220px                |
| 1440 × 900  | 139px            | 120px           | 252px                |
| 1920 × 1080 | 144px            | 120px           | 260px                |

At 1366 × 768 the account-performance panel and complete watchlist now fit in the initial viewport. Normal vertical scrolling remains available. Browser checks found no page-wide horizontal overflow at any of the requested desktop sizes, 390 × 844, or 320 × 740. The baseline 320px dashboard overflow is resolved by wrapping amounts rather than shrinking the base text.

## Verification and screenshots

- TypeScript, ESLint, 65 unit/UI tests, and the production build passed.
- Headless Chrome ran at scale 1 / 100% zoom. All 20 combinations of the five viewports and `/dashboard`, `/markets`, `/portfolio`, `/activity` passed page-width and visible-chart-canvas bounds checks.
- Desktop screenshots were visually inspected at all three requested resolutions; mobile and chart screenshots were also reviewed.
- Screenshots and geometry measurements are stored locally in ignored `.artifacts/layout/before` and `.artifacts/layout/after` directories. Temporary browser profiles are ignored too.

To repeat the browser checks on Windows with installed Chrome or Edge, run a local production server with database access, then:

```sh
node scripts/browser-layout.mjs http://localhost:3000 current
```

The helper uses the configured Better Auth origin, creates a uniquely named test account through the existing registration endpoint, and removes only that account through the TLS-verified migration connection afterward. It never prints credentials or session cookies. Normal authentication rate limits remain enabled; rapid repeated runs may need to wait for the registration limit to reset.

No database schema, authentication rules, market data, or trading behavior changed. No orders can execute. Feature 3.1 is ready for review and has not been committed or pushed.
