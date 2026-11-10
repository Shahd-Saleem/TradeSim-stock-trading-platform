"use client";
import { ArrowUpRight, Wallet } from "lucide-react";
import type { Stock } from "@/lib/market";
import { aed, changePercent } from "@/lib/money";
import s from "./Dashboard.module.css";
import type { AccountData } from "@/lib/account-types";
import {
  percentLabel,
  returnBasisPoints,
  returnPercentLabel,
} from "@/lib/portfolio";
import { ProfitSummary } from "./PortfolioHoldings";

export function AccountOverview({
  onSelect,
  account,
  stocks,
}: {
  onSelect: (stock: Stock) => void;
  account: AccountData;
  stocks: Stock[];
}) {
  const balance = account.cashBalanceFils;
  const value = account.portfolioValueFils;
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
            {value === null ? "Valuation unavailable" : aed(value)}
            <span>
              {returnPercentLabel(
                account.profitLossFils,
                account.startingCapitalFils,
              )}{" "}
              return
            </span>
          </div>
          <div className={s.historyEmpty} role="status">
            <strong>Insufficient performance history</strong>
            <p>
              No historical portfolio valuations have been recorded. A
              performance line would not represent your actual returns.
            </p>
          </div>
          <p>
            Current equity uses saved cash and holdings at persisted daily
            simulated quotes. Buying or selling at the same price does not
            create a gain. Prices are not live.
          </p>
          <div className={s.allocation}>
            <Wallet size={17} aria-hidden="true" />
            <span>Virtual cash</span>
            <strong>
              {value === null
                ? "Unavailable"
                : value === 0
                  ? "0.00%"
                  : percentLabel(
                      returnBasisPoints(BigInt(balance), BigInt(value)),
                    ).replace("+", "")}
            </strong>
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
      <ProfitSummary account={account} />
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
