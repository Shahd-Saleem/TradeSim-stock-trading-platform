"use client";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import type { Stock } from "@/lib/market";
import { aed, STARTING_CAPITAL } from "@/lib/money";
import { previewOrder, type OrderSide } from "@/lib/order-preview";
import s from "./Dashboard.module.css";

export function OrderPreview({ stock }: { stock: Stock }) {
  const [side, setSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState("");
  const result = previewOrder(quantity, stock.priceFils, side);
  return (
    <section
      className={`${s.panel} ${s.orderPanel}`}
      aria-labelledby="order-heading"
    >
      <div className={s.eyebrow}>SIMULATED ORDER PREVIEW</div>
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
            aria-pressed={side === value}
            onClick={() => setSide(value)}
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
        onChange={(event) => setQuantity(event.target.value)}
        aria-invalid={Boolean(result.error && quantity !== "")}
        aria-describedby="quantity-feedback"
      />
      <p
        id="quantity-feedback"
        className={result.error && quantity !== "" ? s.inputError : s.inputHelp}
        aria-live="polite"
      >
        {result.error ?? "Estimate only. No order will be submitted."}
      </p>
      <dl className={s.orderSummary}>
        <div>
          <dt>Simulated share price</dt>
          <dd>{aed(stock.priceFils)}</dd>
        </div>
        <div>
          <dt>Available virtual balance</dt>
          <dd>{aed(STARTING_CAPITAL)}</dd>
        </div>
        <div>
          <dt>Shares held · {stock.symbol}</dt>
          <dd>0</dd>
        </div>
        <div className={s.orderTotal}>
          <dt>Estimated {side === "buy" ? "cost" : "proceeds"}</dt>
          <dd aria-live="polite">
            {result.valueFils === null ? "AED —" : aed(result.valueFils)}
          </dd>
        </div>
      </dl>
      <p className={s.inputHelp}>
        At the simulated quoted price. Fees are not modeled in this preview.
      </p>
      <button type="button" disabled className={s.disabledButton}>
        <LockKeyhole size={15} aria-hidden="true" />
        Trading available in Phase 3
      </button>
      <p className={s.previewNote}>
        Preview only. No trades execute or balances change.
      </p>
    </section>
  );
}
