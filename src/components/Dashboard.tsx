"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ChartCandlestick,
  BriefcaseBusiness,
  History,
} from "lucide-react";
import { AccountOverview } from "./AccountOverview";
import { OrderPreview } from "./OrderPreview";
import { stocks, type Stock } from "@/lib/market";
import { aed, changePercent, STARTING_CAPITAL } from "@/lib/money";
import { PriceChart } from "./PriceChart";
import s from "./Dashboard.module.css";
const periods = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
];
function Change({ stock }: { stock: Stock }) {
  const value = changePercent(stock.priceFils, stock.previousFils);
  return (
    <span className={value >= 0 ? s.positive : s.negative}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
export function Dashboard() {
  const [view, setView] = useState("Overview");
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState("All markets");
  const [selected, setSelected] = useState(stocks[0]);
  const [days, setDays] = useState(90);
  const filtered = useMemo(
    () =>
      stocks.filter(
        (stock) =>
          (exchange === "All markets" || stock.exchange === exchange) &&
          `${stock.symbol} ${stock.name} ${stock.sector}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
      ),
    [query, exchange],
  );
  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <Link href="/" className={s.brand}>
          <span className={s.logo}>↗</span>TradeSim
          <span className={s.uae}>UAE</span>
        </Link>
        <div className={s.workspace}>YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              ["Overview", LayoutDashboard],
              ["Markets", ChartCandlestick],
              ["Portfolio", BriefcaseBusiness],
              ["Activity", History],
            ] as const
          ).map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => setView(name)}
              className={`${s.navItem} ${view === name ? s.active : ""}`}
              aria-label={name}
              title={name}
              aria-current={view === name ? "page" : undefined}
            >
              <Icon
                size={20}
                strokeWidth={1.8}
                aria-hidden="true"
                className={s.navIcon}
              />
              {name}
              {name === "Markets" && <small>8</small>}
            </button>
          ))}
        </nav>
        <div className={s.sidebarBottom}>
          <div className={s.practiceIcon}>◇</div>
          <strong>
            Build confidence.
            <br />
            Before you invest.
          </strong>
          <p>
            A real market experience.
            <br />
            Zero real-world risk.
          </p>
          <span className={s.tag}>PAPER TRADING</span>
        </div>
        <div className={s.profile}>
          <span className={s.avatar}>G</span>
          <div>
            Guest explorer<small>Local preview · not signed in</small>
          </div>
        </div>
      </aside>
      <div className={s.main}>
        <header className={s.header}>
          <span>
            Workspace <span className={s.slash}>/</span> <strong>{view}</strong>
          </span>
          <div className={s.headerRight}>
            <span className={s.simBadge}>
              <i />
              Simulation mode
            </span>
            <span className={s.avatar}>G</span>
          </div>
        </header>
        <main>
          <div className={s.titleRow}>
            <div>
              <div className={s.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</div>
              <h1>
                {view === "Overview"
                  ? "A clear view of your potential."
                  : view === "Markets"
                    ? "Explore the UAE market."
                    : view === "Portfolio"
                      ? "Your investing journey."
                      : "Every move, in one place."}
              </h1>
              <p className={s.subtitle}>
                Explore UAE equities. Build your strategy. Learn by doing.
              </p>
            </div>
            <div className={s.date}>
              09 Nov 2026<span>Fixed simulation snapshot</span>
            </div>
          </div>
          <div className={s.notice}>
            <span>◈</span>
            <p>
              <strong>A safe space to learn.</strong> All prices and market
              movements are simulated. Your AED 100,000 is virtual capital.
            </p>
            <span className={s.phase}>PHASE 1 PREVIEW</span>
          </div>
          {(view === "Overview" || view === "Portfolio") && (
            <section className={s.stats} aria-label="Portfolio summary">
              {[
                [
                  "Portfolio value",
                  aed(STARTING_CAPITAL),
                  "Your starting point",
                  "◷",
                ],
                [
                  "Available balance",
                  aed(STARTING_CAPITAL),
                  "Virtual buying power",
                  "▣",
                ],
                ["Total profit / loss", "AED 0.00", "0.00% all time", "↗"],
                [
                  "Open positions",
                  "0",
                  "Your portfolio is a blank canvas",
                  "▥",
                ],
              ].map(([label, value, description, icon]) => (
                <article key={label} className={s.stat}>
                  <div>
                    {label}
                    <span>{icon}</span>
                  </div>
                  <strong>{value}</strong>
                  <small>{description}</small>
                </article>
              ))}
            </section>
          )}
          {view === "Overview" && (
            <AccountOverview
              onSelect={(stock) => {
                setSelected(stock);
                setView("Markets");
              }}
            />
          )}
          {view === "Markets" && (
            <>
              <div className={s.analysisGrid} id="spotlight-anchor">
                <section
                  className={s.panel}
                  aria-label="Selected stock details"
                >
                  <div className={s.panelHeader}>
                    <div>
                      <span className={s.eyebrow}>
                        SELECTED STOCK · SIMULATED
                      </span>
                      <h2>
                        {selected.name}{" "}
                        <span className={s.exchange}>{selected.exchange}</span>
                      </h2>
                    </div>
                    <div className={s.periods} aria-label="Chart time range">
                      {periods.map((period) => (
                        <button
                          key={period.label}
                          aria-pressed={days === period.days}
                          className={days === period.days ? s.selected : ""}
                          onClick={() => setDays(period.days)}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={s.chartPrice}>
                    {aed(selected.priceFils)} <Change stock={selected} />
                    <small>vs. simulated previous close</small>
                    <dl className={s.stockDetails}>
                      <div>
                        <dt>Symbol</dt>
                        <dd>{selected.symbol}</dd>
                      </div>
                      <div>
                        <dt>Sector</dt>
                        <dd>{selected.sector}</dd>
                      </div>
                      <div>
                        <dt>Previous close</dt>
                        <dd>{aed(selected.previousFils)}</dd>
                      </div>
                      <div>
                        <dt>Sim. volume</dt>
                        <dd>{selected.volume}</dd>
                      </div>
                    </dl>
                  </div>
                  <PriceChart stock={selected} days={days} />
                  <div className={s.chartFooter}>
                    <span>
                      <i />
                      Simulated daily prices · AED
                    </span>
                    <a
                      href="https://www.tradingview.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Charts by TradingView ↗
                    </a>
                  </div>
                </section>
                <OrderPreview stock={selected} />
              </div>
              <section className={s.panel} id="markets">
                <div className={s.tableHeading}>
                  <div>
                    <h2>
                      Market explorer{" "}
                      <span className={s.count}>{stocks.length}</span>
                    </h2>
                    <p>Discover a selection of UAE-listed companies.</p>
                  </div>
                  <label className={s.search}>
                    <span aria-hidden="true">⌕</span>
                    <input
                      aria-label="Search stocks by symbol, company or sector"
                      placeholder="Search stocks…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                </div>
                <div className={s.filters} aria-label="Filter by exchange">
                  {["All markets", "DFM", "ADX"].map((name) => (
                    <button
                      key={name}
                      className={exchange === name ? s.selected : ""}
                      aria-pressed={exchange === name}
                      onClick={() => setExchange(name)}
                    >
                      {name}
                    </button>
                  ))}
                  <span aria-live="polite">
                    {filtered.length} companies · simulated data
                  </span>
                </div>
                <div className={s.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Exchange</th>
                        <th>Price (AED)</th>
                        <th>Change</th>
                        <th>Sim. volume</th>
                        <th>Chart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((stock) => (
                        <tr
                          key={stock.symbol}
                          className={
                            selected.symbol === stock.symbol
                              ? s.selectedRow
                              : ""
                          }
                        >
                          <td>
                            <button
                              className={s.company}
                              onClick={() => {
                                setSelected(stock);
                                document
                                  .getElementById("spotlight-anchor")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                              aria-pressed={selected.symbol === stock.symbol}
                              aria-label={`View ${stock.name} chart and order preview`}
                            >
                              <span
                                className={s.stockIcon}
                                style={{
                                  color: stock.color,
                                  background: `${stock.color}15`,
                                }}
                              >
                                {stock.symbol.slice(0, 2)}
                              </span>
                              <span>
                                <strong>{stock.symbol}</strong>
                                <small>{stock.name}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span className={s.exchange}>{stock.exchange}</span>
                          </td>
                          <td className={s.numeric}>{aed(stock.priceFils)}</td>
                          <td>
                            <Change stock={stock} />
                          </td>
                          <td className={s.muted}>{stock.volume}</td>
                          <td>
                            <button
                              className={s.chartLink}
                              onClick={() => {
                                setSelected(stock);
                                document
                                  .getElementById("spotlight-anchor")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                              aria-label={`Select ${stock.symbol} chart`}
                            >
                              View ↗
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div className={s.empty}>
                      No companies match your search. Try another symbol or
                      exchange.
                    </div>
                  )}
                </div>
                <div className={s.tableFooter}>
                  Illustrative prices and volumes. Not a live feed or investment
                  advice.
                </div>
              </section>
            </>
          )}
          {(view === "Portfolio" || view === "Activity") && (
            <section className={`${s.panel} ${s.emptyState}`}>
              <div className={s.orbit}>
                <span>{view === "Portfolio" ? "◷" : "⇄"}</span>
              </div>
              <h2>
                {view === "Portfolio"
                  ? "Your first position is still ahead."
                  : "No transactions yet."}
              </h2>
              <p>
                {view === "Portfolio"
                  ? "This preview starts with AED 100,000 in virtual cash and no holdings."
                  : "Transaction history will become available with the trading engine."}
                <br />
                Accounts, persistence and trading are planned for a later phase.
              </p>
              <button
                className={s.primaryButton}
                onClick={() => setView("Markets")}
              >
                Explore simulated markets ↗
              </button>
            </section>
          )}
          <footer className={s.footer}>
            <span>
              TradeSim UAE <span>·</span> Learn the market. Find your edge.
            </span>
            <span>
              Simulated data only <i /> AED virtual capital
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
