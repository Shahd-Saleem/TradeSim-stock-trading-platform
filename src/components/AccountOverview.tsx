"use client";
import { ArrowUpRight, Wallet } from "lucide-react";
import { stocks, type Stock } from "@/lib/market";
import { aed, changePercent, STARTING_CAPITAL } from "@/lib/money";
import s from "./Dashboard.module.css";

export function AccountOverview({
  onSelect,
}: {
  onSelect: (stock: Stock) => void;
}) {
  const highlights = [...stocks].sort(
    (a, b) =>
      changePercent(b.priceFils, b.previousFils) -
      changePercent(a.priceFils, a.previousFils),
  );
  return (
    <>
      <div className={s.overviewGrid}>
        <section
          className={`${s.panel} ${s.performance}`}
          aria-labelledby="performance-heading"
        >
          <div className={s.eyebrow}>YOUR ACCOUNT AT A GLANCE</div>
          <h2 id="performance-heading">Portfolio performance</h2>
          <div className={s.performanceValue}>
            {aed(STARTING_CAPITAL)}
            <span>0.00% return</span>
          </div>
          <div
            className={s.performancePlot}
            role="img"
            aria-label="Cash-only starting portfolio: AED 100,000, zero profit or loss. No performance history yet."
          >
            <span>AED 100,000</span>
            <div className={s.flatLine} />
            <div className={s.plotCaption}>Starting balance · cash only</div>
          </div>
          <p>
            No performance history yet. Your preview holds 100% virtual cash and
            no stocks.
          </p>
          <div className={s.allocation}>
            <Wallet size={17} aria-hidden="true" />
            <span>Virtual cash</span>
            <strong>100%</strong>
          </div>
        </section>
        <section
          className={`${s.panel} ${s.watchlist}`}
          aria-labelledby="watchlist-heading"
        >
          <div className={s.eyebrow}>A FEW COMPANIES TO EXPLORE</div>
          <h2 id="watchlist-heading">Sample watchlist</h2>
          <p>A fixed selection · simulated prices</p>
          {stocks.slice(0, 4).map((stock) => {
            const change = changePercent(stock.priceFils, stock.previousFils);
            return (
              <button
                key={stock.symbol}
                onClick={() => onSelect(stock)}
                aria-label={`Explore ${stock.name} in Markets`}
              >
                <span>
                  <strong>{stock.symbol}</strong>
                  <small>{stock.name}</small>
                </span>
                <span>
                  {aed(stock.priceFils)}
                  <small className={change >= 0 ? s.positive : s.negative}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)}%
                  </small>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            );
          })}
        </section>
      </div>
      <section
        className={`${s.panel} ${s.highlights}`}
        aria-labelledby="highlights-heading"
      >
        <div className={s.eyebrow}>ACROSS DFM & ADX</div>
        <h2 id="highlights-heading">Market highlights</h2>
        <p>
          Movers in this simulated selection, compared with simulated previous
          closes.
        </p>
        <div className={s.highlightGrid}>
          {[
            { label: "Largest gain", stock: highlights[0] },
            {
              label: "Largest decline",
              stock: highlights[highlights.length - 1],
            },
          ].map(({ label, stock }) => {
            const change = changePercent(stock.priceFils, stock.previousFils);
            return (
              <button key={label} onClick={() => onSelect(stock)}>
                <small>
                  {label} · {stock.exchange}
                </small>
                <strong>
                  {stock.name}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </strong>
                <span>
                  {aed(stock.priceFils)}{" "}
                  <span className={change >= 0 ? s.positive : s.negative}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)}%
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
