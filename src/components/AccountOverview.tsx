"use client";
import { ArrowUpRight, Wallet } from "lucide-react";
import { stocks, type Stock } from "@/lib/market";
import { aed, changePercent } from "@/lib/money";
import s from "./Dashboard.module.css";
import type { AccountData } from "@/lib/account-types";

export function AccountOverview({
  onSelect,
  account,
}: {
  onSelect: (stock: Stock) => void;
  account: AccountData;
}) {
  const balance = account.cashBalanceFils;
  const value = account.portfolioValueFils;
  const profitLoss = account.profitLossFils;
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
            {aed(value)}
            <span>
              {((profitLoss / account.startingCapitalFils) * 100).toFixed(2)}%
              return
            </span>
          </div>
          <div
            className={s.performancePlot}
            role="img"
            aria-label={`Current virtual portfolio value: ${aed(value)}. No historical performance series available.`}
          >
            <span>{aed(value)}</span>
            <div className={s.flatLine} />
            <div className={s.plotCaption}>
              Current balance snapshot · simulated valuation
            </div>
          </div>
          <p>
            No historical performance series yet.{" "}
            {account
              ? "Your account balance is saved securely between sessions."
              : "Sign in to save your virtual account."}
          </p>
          <div className={s.allocation}>
            <Wallet size={17} aria-hidden="true" />
            <span>Virtual cash</span>
            <strong>
              {value === 0 ? "0.00" : ((balance / value) * 100).toFixed(2)}%
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
