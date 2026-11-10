"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { OrderInput } from "@/lib/trading";
import { aed } from "@/lib/money";
import { safeInteger } from "@/lib/portfolio";
import s from "./Dashboard.module.css";
export const confirmationSchema = z.object({
  priceFils: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  cashBeforeFils: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ConfirmationSnapshot = z.infer<typeof confirmationSchema>;
export function OrderConfirmation({
  order,
  snapshot,
  company,
  pending,
  uncertain,
  expiredSession,
  onCancel,
  onConfirm,
}: {
  order: OrderInput;
  snapshot: ConfirmationSnapshot | null;
  company: string;
  pending: boolean;
  uncertain: boolean;
  expiredSession: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (visible) dialog.current?.showModal();
    else dialog.current?.close();
  }, [visible]);
  let total: number | null = null,
    after: number | null = null;
  if (snapshot) {
    try {
      const value = BigInt(snapshot.priceFils) * BigInt(order.quantity);
      total = safeInteger(value);
      after = safeInteger(
        BigInt(snapshot.cashBeforeFils) +
          (order.side === "BUY" ? -value : value),
      );
    } catch {
      /* Older or damaged recovery details are not execution authority. */
    }
  }
  return (
    <>
      {!visible && (
        <button
          type="button"
          className={s.tradeButton}
          onClick={() => setVisible(true)}
        >
          Resolve pending order
        </button>
      )}
      <dialog
        ref={dialog}
        className={s.confirmDialog}
        aria-labelledby="confirmation-heading"
        aria-describedby="confirmation-disclaimer"
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) {
            if (uncertain) setVisible(false);
            else onCancel();
          }
        }}
      >
        <span className={s.eyebrow}>REVIEW YOUR SIMULATED ORDER</span>
        <h2 id="confirmation-heading">
          {uncertain
            ? "Resolve your original order"
            : `Confirm ${order.side === "BUY" ? "Buy" : "Sell"}`}
        </h2>
        <p>
          {company} · {order.symbol} · {order.exchange}
        </p>
        <dl className={s.orderSummary}>
          <div>
            <dt>Direction</dt>
            <dd>{order.side === "BUY" ? "Buy" : "Sell"}</dd>
          </div>
          <div>
            <dt>Number of shares</dt>
            <dd>{order.quantity}</dd>
          </div>
          <div>
            <dt>Simulated price per share</dt>
            <dd>
              {snapshot
                ? aed(snapshot.priceFils)
                : "Original quote unavailable"}
            </dd>
          </div>
          <div>
            <dt>
              Estimated{" "}
              {order.side === "BUY" ? "purchase cost" : "sale proceeds"}
            </dt>
            <dd>{total === null ? "Unavailable" : aed(total)}</dd>
          </div>
          <div>
            <dt>Virtual cash before trade</dt>
            <dd>{snapshot ? aed(snapshot.cashBeforeFils) : "Unavailable"}</dd>
          </div>
          <div className={s.orderTotal}>
            <dt>Estimated virtual cash after trade</dt>
            <dd>{after === null ? "Unavailable" : aed(after)}</dd>
          </div>
        </dl>
        <p id="confirmation-disclaimer">
          Virtual funds only. No real money or brokerage orders. No fees are
          modeled. A changed quote or account balance requires a new
          confirmation.
        </p>
        {uncertain && (
          <p role="status">
            The earlier outcome is unconfirmed. Retry the original request to
            resolve it without executing twice. These are the original
            estimates, not a new quote.
          </p>
        )}
        {expiredSession && (
          <p>
            Your session expired. Close this dialog to sign in again; the
            original request remains saved for recovery.
          </p>
        )}
        <div className={s.dialogActions}>
          <button
            type="button"
            className={s.tradeSecondary}
            disabled={pending}
            onClick={uncertain ? () => setVisible(false) : onCancel}
          >
            {uncertain ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            className={s.tradeButton}
            disabled={pending || expiredSession}
            onClick={onConfirm}
          >
            {pending
              ? "Submitting…"
              : uncertain
                ? "Retry same order"
                : `Confirm ${order.side === "BUY" ? "Buy" : "Sell"}`}
          </button>
        </div>
      </dialog>
    </>
  );
}
