import Link from "next/link";
import {
  ArrowUpRight,
  ChartCandlestick,
  ShieldCheck,
  Compass,
  ArrowRight,
} from "lucide-react";
import { aed, changePercent } from "@/lib/money";
import type { MarketData } from "@/lib/market-data";
import s from "./Landing.module.css";

export function Landing({
  authenticated,
  market,
}: {
  authenticated: boolean;
  market: MarketData;
}) {
  const stocks = market.stocks;
  const start = authenticated ? "/dashboard" : "/register";
  const stock = stocks[0];
  const prices = stock.history.slice(-90).map((point) => point.priceFils / 100);
  const min = Math.min(...prices),
    range = Math.max(...prices) - min || 1;
  const line = prices
    .map(
      (price, index) =>
        `${index ? "L" : "M"}${(index * 500) / Math.max(1, prices.length - 1)},${145 - ((price - min) * 115) / range}`,
    )
    .join(" ");
  return (
    <div className={s.page}>
      <a href="#main-content" className="skipLink">
        Skip to content
      </a>
      <header className={s.header}>
        <Link href="/" className={s.brand}>
          <span>↗</span>TradeSim <small>UAE</small>
        </Link>
        <nav aria-label="Public navigation">
          <Link href="/markets">Markets</Link>
          <Link href="#how-it-works">How it works</Link>
          <Link href={authenticated ? "/dashboard" : "/login"}>
            {authenticated ? "Dashboard" : "Sign In"}
          </Link>
        </nav>
        <Link href={start} className={s.headerCta}>
          Start Trading <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <main id="main-content">
        <section className={s.hero} aria-labelledby="hero-heading">
          <div className={s.heroCopy}>
            <div className={s.badge}>
              <span /> BUILT FOR YOUR FIRST STEP · UAE EQUITIES
            </div>
            <h1 id="hero-heading">
              Learn the market.
              <br />
              <span>Find your edge.</span>
            </h1>
            <p>
              A place to explore the companies shaping the UAE. Build your
              investing perspective with simulated DFM and ADX markets and
              virtual capital.
            </p>
            <div className={s.actions}>
              <Link href={start} className={s.primary}>
                Start Trading <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/markets" className={s.secondary}>
                Explore Markets <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <p className={s.availability}>
              Accounts and market exploration are available now.
              <br />
              Practice Buy/Sell orders with virtual funds.
            </p>
            <div className={s.heroFacts}>
              <div>
                <strong>AED 100,000</strong>
                <span>Virtual starting capital per new account</span>
              </div>
              <div>
                <strong>DFM + ADX</strong>
                <span>Discover UAE-listed companies</span>
              </div>
            </div>
          </div>
          <div className={s.preview}>
            <div className={s.previewTop}>
              <span>
                <ChartCandlestick size={16} aria-hidden="true" /> Market
                spotlight
              </span>
              <span className={s.simulated}>SIMULATED</span>
            </div>
            <div className={s.quote}>
              <div>
                <span>
                  {stock.exchange} · {stock.symbol}
                </span>
                <h2>{stock.name}</h2>
              </div>
              <div>
                <strong>{aed(stock.priceFils)}</strong>
                <span
                  className={
                    changePercent(stock.priceFils, stock.previousFils) < 0
                      ? s.loss
                      : s.gain
                  }
                >
                  {changePercent(stock.priceFils, stock.previousFils) > 0
                    ? "+"
                    : ""}
                  {changePercent(stock.priceFils, stock.previousFils).toFixed(
                    2,
                  )}
                  %
                </span>
              </div>
            </div>
            {prices.length < 2 ? (
              <p className={s.chartCaption}>
                Daily simulated history is building. Only saved quotes will be
                charted.
              </p>
            ) : (
              <svg
                viewBox="0 0 500 175"
                className={s.chart}
                role="img"
                aria-label="Emaar Properties stored simulated price history, not live data"
              >
                <defs>
                  <linearGradient id="landing-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#53d6b0" stopOpacity=".22" />
                    <stop offset="100%" stopColor="#53d6b0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${line} L500,175 L0,175 Z`}
                  fill="url(#landing-area)"
                />
                <path d={line} fill="none" stroke="#65dcba" strokeWidth="2" />
              </svg>
            )}
            <div className={s.chartCaption}>
              <span>{prices.length} saved sessions · AED</span>
              <span>Simulation date · {stock.sessionDate}</span>
            </div>
            <div className={s.previewList}>
              {stocks.slice(1, 4).map((item) => (
                <Link
                  key={item.symbol}
                  href={`/markets?symbol=${item.symbol}&exchange=${item.exchange}`}
                >
                  <span className={s.stockMark} style={{ color: item.color }}>
                    {item.symbol.slice(0, 2)}
                  </span>
                  <span>
                    <strong>{item.symbol}</strong>
                    <small>{item.exchange}</small>
                  </span>
                  <span>{aed(item.priceFils)}</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <div className={s.previewFoot}>
              <ShieldCheck size={14} aria-hidden="true" /> Virtual funds.
              Simulated prices. No brokerage connection.
            </div>
          </div>
        </section>
        <section
          className={s.features}
          id="how-it-works"
          aria-labelledby="journey-heading"
        >
          <div className={s.sectionHeading}>
            <span>A LITTLE CURIOSITY GOES A LONG WAY</span>
            <h2 id="journey-heading">
              Your investing journey starts with understanding.
            </h2>
            <p>
              Explore at your own pace, with a workspace designed to make the
              UAE market feel familiar.
            </p>
          </div>
          <div className={s.featureGrid}>
            {[
              {
                Icon: Compass,
                title: "Explore the UAE market",
                body: "Browse simulated DFM and ADX securities, compare price movements, and take a closer look with interactive charts.",
                number: "01",
              },
              {
                Icon: ShieldCheck,
                title: "Create your virtual account",
                body: "Register for AED 100,000 in virtual starting capital. Your private account stays saved between sessions.",
                number: "02",
              },
              {
                Icon: ChartCandlestick,
                title: "Build your perspective",
                body: "Get comfortable with the numbers, review your orders and practice buying or selling with virtual funds.",
                number: "03",
              },
            ].map(({ Icon, title, body, number }) => (
              <article key={number}>
                <div>
                  <Icon size={23} aria-hidden="true" />
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className={s.closing}>
          <div>
            <span>MAKE YOUR FIRST MOVE A THOUGHTFUL ONE</span>
            <h2>
              A fresh perspective.
              <br />A virtual place to begin.
            </h2>
          </div>
          <div>
            <Link href={start} className={s.primary}>
              Start Trading <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <p>Virtual capital only. No deposits required.</p>
          </div>
        </section>
      </main>
      <footer className={s.footer}>
        <Link href="/" className={s.brand}>
          TradeSim <small>UAE</small>
        </Link>
        <p>
          All market prices and movements are simulated. Not a live feed or
          investment advice.
        </p>
        <Link href="/markets">Explore Markets ↗</Link>
      </footer>
    </div>
  );
}
