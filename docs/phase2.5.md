# Phase 2.5: authentication UX and navigation

The public entry point is now a product landing page. Personal data is loaded only for verified sessions, and private views are real App Router routes rather than tabs in a public guest dashboard. No database schema, migrations, auth credentials or execution permissions changed in this phase.

| Route                 | Behavior                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/`                   | Public landing; Start Trading leads to registration or the dashboard according to the server-verified session |
| `/markets`            | Public simulated listings and charts; guests see no personal balance, holdings or order preview               |
| `/dashboard`          | Authenticated account overview                                                                                |
| `/portfolio`          | Authenticated portfolio                                                                                       |
| `/activity`           | Authenticated transaction history                                                                             |
| `/login`, `/register` | Preserve an allowlisted return destination; authenticated visitors continue directly to that destination      |
| `/api/account`        | Existing session-scoped, private/no-store API; anonymous requests receive 401                                 |

Private pages call `requireAccount` on the server before rendering. Anonymous requests redirect to `/login?returnTo=...`. Return destinations are limited to the four workspace routes; external URLs, protocol-relative URLs, backslashes, control characters and auth-page loops fall back to `/dashboard`. The client validates the destination again before post-auth navigation. Watchlist selections preserve the selected stock in the Markets URL.

Session verification completes before rendering account-specific content. React request-scoped memoization avoids redundant session work within a render; it does not share sessions across users. Loading boundaries show neutral skeletons without names or balances, and authentication forms immediately disable during requests. No artificial delay is used.

The sidebar profile displays the verified user's name and email. Its keyboard-operable account menu contains Log Out, with request/error feedback; Escape closes it. At narrow widths the avatar opens the full identity menu. Guest navigation remains public, while personal links lead through the server-side auth guard. Skip links, named navigation, active-page markers and existing chart/search controls remain accessible.

Next.js's development indicator is disabled with `devIndicators: false` in `next.config.ts`, using the [supported Next.js configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/devIndicators).

Marketing copy describes AED 100,000 as the virtual starting allocation for new registrations, never as an anonymous visitor's personal balance. Market prices remain deterministic and clearly simulated. Signed-in users retain the disabled order preview; Buy/Sell execution remains unavailable until Phase 3.

Verify with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The production HTTP smoke script (`node scripts/smoke-http.mjs http://localhost:3000`) also checks guest data exclusion, protected-page redirects and existing API/origin protections. Unit/UI tests cover landing CTAs, public market interactions, private-route authorization, safe return URLs, profile display and auth pending/error navigation. Chart canvas rendering remains mocked in jsdom.
