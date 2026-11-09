"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Stock } from "@/lib/market";
import type { AccountData } from "@/lib/account-types";
import type { OrderInput } from "@/lib/trading";
import { orderSchema } from "@/lib/trading";
import { aed } from "@/lib/money";
import { previewOrder, type OrderSide } from "@/lib/order-preview";
import s from "./Dashboard.module.css";

type Quote = {
  priceFils: number;
  token: string;
  expiresAt: number;
  snapshotAt: string;
};
const errors: Record<string, string> = {
  INSUFFICIENT_FUNDS:
    "You don't have enough virtual cash. Refresh your account and reduce the quantity.",
  INSUFFICIENT_SHARES:
    "You don't own enough shares. Refresh your account and reduce the quantity.",
  INVALID_ORDER:
    "Enter a positive whole-number quantity within the supported range.",
  ORDER_TOO_LARGE:
    "This order exceeds the supported range. Use a smaller quantity.",
  QUOTE_CHANGED:
    "The quote changed or expired. Refresh the quote and review your order again.",
  QUOTE_UNAVAILABLE:
    "The simulated quote is unavailable. Refresh and try again.",
};
export function OrderPreview({
  stock,
  account,
  onAccountChange,
  onLockChange,
}: {
  stock: Stock;
  account: AccountData;
  onAccountChange: (account: AccountData) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const [side, setSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [intent, setIntent] = useState<OrderInput | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [expiredSession, setExpiredSession] = useState(false);
  const [refreshNeeded, setRefreshNeeded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const storageKey = `tradesim.pending.${account.user.email}.${stock.exchange}.${stock.symbol}`;
  const busy = useRef(false);
  const owned =
    account.holdings.find(
      (holding) =>
        holding.symbol === stock.symbol && holding.exchange === stock.exchange,
    )?.quantity ?? 0;
  const result = previewOrder(
    quantity,
    quote?.priceFils ?? 0,
    side,
    account.cashBalanceFils,
    owned,
  );
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [quoteResponse, accountResponse] = await Promise.all([
          fetch(
            `/api/orders/quote?exchange=${stock.exchange}&symbol=${encodeURIComponent(stock.symbol)}`,
            { cache: "no-store", signal: controller.signal },
          ),
          fetch("/api/account", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        if (quoteResponse.status === 401 || accountResponse.status === 401) {
          setExpiredSession(true);
          throw new Error("Sign in again to continue trading.");
        }
        if (!quoteResponse.ok || !accountResponse.ok)
          throw new Error(
            "Unable to refresh your quote and account. Please try again.",
          );
        const nextQuote: Quote = await quoteResponse.json();
        const nextAccount: AccountData = await accountResponse.json();
        if (
          !Number.isSafeInteger(nextQuote.priceFils) ||
          nextQuote.priceFils <= 0 ||
          !nextQuote.token ||
          nextQuote.expiresAt <= Date.now()
        )
          throw new Error("The quote expired. Please refresh it.");
        if (!controller.signal.aborted) {
          setQuote(nextQuote);
          onAccountChange(nextAccount);
          setRefreshNeeded(false);
          setLoadError("");
          try {
            const saved = sessionStorage.getItem(storageKey);
            const restored = saved
              ? orderSchema.safeParse(JSON.parse(saved))
              : null;
            if (
              restored?.success &&
              restored.data.symbol === stock.symbol &&
              restored.data.exchange === stock.exchange
            ) {
              setIntent(restored.data);
              setSide(restored.data.side === "BUY" ? "buy" : "sell");
              setQuantity(String(restored.data.quantity));
              setUncertain(true);
              onLockChange(true);
              setMessage(
                "An earlier order has an unconfirmed outcome. Retry the same order safely.",
              );
            }
          } catch {
            /* Storage may be unavailable; in-memory retries remain safe. */
          }
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your order preview.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [
    stock.exchange,
    stock.symbol,
    reload,
    onAccountChange,
    onLockChange,
    storageKey,
  ]);
  function refresh() {
    setLoading(true);
    setQuote(null);
    setReload((value) => value + 1);
  }
  function release() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Optional persistence. */
    }
    setIntent(null);
    setUncertain(false);
    onLockChange(false);
  }
  function review() {
    if (
      !quote ||
      result.error ||
      !result.quantity ||
      busy.current ||
      loading ||
      expiredSession
    )
      return;
    setIntent({
      exchange: stock.exchange,
      symbol: stock.symbol,
      side: side === "buy" ? "BUY" : "SELL",
      quantity: result.quantity,
      idempotencyKey: crypto.randomUUID(),
      quoteToken: quote.token,
    });
    setMessage("");
    setSuccess(false);
    onLockChange(true);
  }
  async function submit() {
    if (!intent || busy.current) return;
    busy.current = true;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(intent));
    } catch {
      /* Optional persistence. */
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status >= 500 && body.error?.code !== "QUOTE_UNAVAILABLE")
          throw new Error(
            "The outcome is not confirmed. Retry this same order safely using the button below.",
          );
        const code = body.error?.code;
        setMessage(
          response.status === 401
            ? "Your session expired. Sign in again to continue."
            : (errors[code] ??
                "This order could not be placed. Refresh your account and review it again."),
        );
        if (response.status === 401) {
          setExpiredSession(true);
          setUncertain(true);
          return;
        }
        release();
        setRefreshNeeded(true);
        setQuote(null);
        return;
      }
      if (!body.ok || !body.trade)
        throw new Error(
          "The outcome is not confirmed. Retry this same order safely.",
        );
      setSuccess(true);
      setMessage(
        `Simulated ${intent.side === "BUY" ? "buy" : "sell"} confirmed: ${body.trade.quantity} ${intent.symbol} shares for ${aed(Number(body.trade.totalValueFils))}. Virtual funds only.`,
      );
      release();
      setQuantity("");
      setRefreshNeeded(true);
      refresh();
    } catch (error) {
      setUncertain(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Connection interrupted. Retry this same order safely.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const locked = Boolean(intent) || pending;
  return (
    <section
      className={`${s.panel} ${s.orderPanel}`}
      aria-labelledby="order-heading"
      aria-busy={loading || pending}
    >
      <div className={s.eyebrow}>SIMULATED ORDER</div>
      <h2 id="order-heading">Plan your next move.</h2>
      <p className={s.orderIntro}>
        {stock.symbol} · {stock.exchange}
        <br />
        {stock.name}
      </p>
      <div className={s.sideControl} role="group" aria-label="Order side">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={locked}
            aria-pressed={side === value}
            onClick={() => {
              setSide(value);
              setMessage("");
              setSuccess(false);
            }}
            className={
              side === value
                ? value === "buy"
                  ? s.buySelected
                  : s.sellSelected
                : ""
            }
          >
            {value === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>
      <label className={s.quantityLabel} htmlFor="order-quantity">
        Quantity <span>Whole shares</span>
      </label>
      <input
        id="order-quantity"
        className={s.quantityInput}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 10"
        value={quantity}
        disabled={locked}
        onChange={(event) => {
          setQuantity(event.target.value);
          setMessage("");
          setSuccess(false);
        }}
        aria-invalid={Boolean(result.error && quantity)}
        aria-describedby="quantity-feedback"
      />
      <p
        id="quantity-feedback"
        className={result.error && quantity ? s.inputError : s.inputHelp}
        aria-live="polite"
      >
        {loading
          ? "Loading your account and server quote…"
          : (result.error ?? "Review the simulated order before confirming.")}
      </p>
      <dl className={s.orderSummary}>
        <div>
          <dt>Simulated share price</dt>
          <dd>{quote ? aed(quote.priceFils) : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Available virtual balance</dt>
          <dd>{aed(account.cashBalanceFils)}</dd>
        </div>
        <div>
          <dt>Shares held · {stock.symbol}</dt>
          <dd>{owned}</dd>
        </div>
        <div>
          <dt>Order quantity</dt>
          <dd>{result.quantity ?? "—"}</dd>
        </div>
        <div className={s.orderTotal}>
          <dt>Estimated {side === "buy" ? "cost" : "proceeds"}</dt>
          <dd aria-live="polite">
            {quote && result.valueFils !== null
              ? aed(result.valueFils)
              : "AED —"}
          </dd>
        </div>
      </dl>
      <p className={s.inputHelp}>
        Server-quoted simulation. Fees are not modeled. Quotes are valid for
        five minutes.
      </p>
      {message && (
        <p
          role={success ? "status" : "alert"}
          className={success ? s.tradeSuccess : s.inputError}
        >
          {message}
        </p>
      )}
      {loadError && (
        <p role="alert" className={s.inputError}>
          {success ? "Trade confirmed. " : ""}
          {loadError}
        </p>
      )}
      {expiredSession && (
        <Link href="/login?returnTo=%2Fmarkets" className={s.guestSignIn}>
          Sign in again
        </Link>
      )}
      {intent ? (
        <div
          className={s.tradeConfirmation}
          role="group"
          aria-label="Order confirmation"
        >
          <p>
            Confirm {intent.side.toLowerCase()} of {intent.quantity}{" "}
            {intent.symbol} shares? This changes your virtual account.
          </p>
          <button
            className={s.tradeButton}
            type="button"
            disabled={pending || expiredSession}
            onClick={() => void submit()}
          >
            {pending
              ? "Submitting…"
              : uncertain
                ? "Retry same order"
                : `Confirm ${side === "buy" ? "Buy" : "Sell"}`}
          </button>
          {!uncertain && (
            <button
              type="button"
              disabled={pending}
              className={s.tradeSecondary}
              onClick={release}
            >
              Back to edit
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={s.tradeButton}
          disabled={
            loading ||
            !quote ||
            Boolean(result.error) ||
            expiredSession ||
            refreshNeeded
          }
          onClick={review}
        >
          Review {side === "buy" ? "Buy" : "Sell"}
        </button>
      )}
      {!locked && (
        <button
          className={s.tradeSecondary}
          type="button"
          disabled={loading || expiredSession}
          onClick={refresh}
        >
          {refreshNeeded ? "Refresh account and quote" : "Refresh quote"}
        </button>
      )}
      <p className={s.previewNote}>
        Simulated trades only. No real money or brokerage orders.
      </p>
    </section>
  );
}
