import { describe, expect, it } from "vitest";
import {
  holdingAnalytics,
  portfolioAnalytics,
  positionDescription,
  returnBasisPoints,
  roundedRatio,
} from "./portfolio";
import { calculateOrder } from "./trading";
describe("exact portfolio accounting", () => {
  it("does not treat an acquisition as a gain or double-count invested cash", () => {
    const buy = calculateOrder("BUY", 10n, 100n, 10000n, 0n, 0n);
    const result = portfolioAnalytics(buy.cash, 10000n, buy.total, 0n, [
      { quantity: buy.quantity, costBasisFils: buy.basis, priceFils: 100n },
    ]);
    expect(result).toMatchObject({
      portfolioValueFils: 10000,
      profitLossFils: 0,
      realizedProfitLossFils: 0,
      unrealizedProfitLossFils: 0,
      returnBasisPoints: 0,
    });
  });
  it("handles weighted purchases, partial sales and a fully closed position", () => {
    const first = calculateOrder("BUY", 3n, 100n, 10000n, 0n, 0n);
    const second = calculateOrder(
      "BUY",
      2n,
      101n,
      first.cash,
      first.quantity,
      first.basis,
    );
    expect(holdingAnalytics(second.quantity, second.basis, 150n)).toMatchObject(
      {
        averagePriceFils: 100,
        costBasisFils: 502,
        unrealizedProfitLossFils: 248,
      },
    );
    const partial = calculateOrder(
      "SELL",
      2n,
      150n,
      second.cash,
      second.quantity,
      second.basis,
    );
    const holdings = [
      {
        quantity: partial.quantity,
        costBasisFils: partial.basis,
        priceFils: 150n,
      },
    ];
    expect(
      holdingAnalytics(partial.quantity, partial.basis, 150n),
    ).toMatchObject({
      averagePriceFils: 101,
      costBasisFils: 302,
      valueFils: 450,
      unrealizedProfitLossFils: 148,
      estimatedSaleProceedsFils: 450,
      estimatedSaleProfitLossFils: 148,
    });
    expect(
      portfolioAnalytics(partial.cash, 10000n, 502n, 300n, holdings),
    ).toMatchObject({
      portfolioValueFils: 10248,
      realizedProfitLossFils: 100,
      unrealizedProfitLossFils: 148,
      profitLossFils: 248,
      returnBasisPoints: 248,
    });
    const closed = calculateOrder(
      "SELL",
      3n,
      140n,
      partial.cash,
      partial.quantity,
      partial.basis,
    );
    expect(closed.basis).toBe(0n);
    expect(
      portfolioAnalytics(closed.cash, 10000n, 502n, 720n, []),
    ).toMatchObject({
      portfolioValueFils: 10218,
      realizedProfitLossFils: 218,
      unrealizedProfitLossFils: 0,
      profitLossFils: 218,
    });
  });
  it("distinguishes realized losses, unrealized losses and break-even", () => {
    expect(
      portfolioAnalytics(9320n, 10000n, 1000n, 320n, [
        { quantity: 6n, costBasisFils: 600n, priceFils: 80n },
      ]),
    ).toMatchObject({
      portfolioValueFils: 9800,
      realizedProfitLossFils: -80,
      unrealizedProfitLossFils: -120,
      profitLossFils: -200,
      returnBasisPoints: -200,
    });
    expect(holdingAnalytics(5n, 500n, 100n).unrealizedReturnBasisPoints).toBe(
      0,
    );
  });
  it("preserves cash and realized returns when a quote is missing without treating it as zero", () => {
    expect(holdingAnalytics(3n, 302n, null)).toMatchObject({
      valueFils: null,
      priceFils: null,
      unrealizedProfitLossFils: null,
    });
    expect(
      portfolioAnalytics(9798n, 10000n, 502n, 300n, [
        { quantity: 3n, costBasisFils: 302n, priceFils: null },
      ]),
    ).toMatchObject({
      valuationComplete: false,
      portfolioValueFils: null,
      profitLossFils: null,
      realizedProfitLossFils: 100,
      unrealizedProfitLossFils: null,
    });
    expect(portfolioAnalytics(10000n, 10000n, 0n, 0n, [])).toMatchObject({
      valuationComplete: true,
      portfolioValueFils: 10000,
      profitLossFils: 0,
    });
  });
  it("rounds display ratios symmetrically and never counts external cash adjustments as returns", () => {
    expect(roundedRatio(201n, 2n)).toBe(101n);
    expect(roundedRatio(-201n, 2n)).toBe(-101n);
    expect(returnBasisPoints(1n, 0n)).toBeNull();
    expect(portfolioAnalytics(9999n, 10000n, 0n, 0n, [])).toMatchObject({
      portfolioValueFils: 9999,
      profitLossFils: 0,
      cashAdjustmentFils: -1,
    });
  });
  it("describes actual open positions", () => {
    expect(positionDescription(0)).toBe("No open positions yet");
    expect(positionDescription(1)).toBe("1 active holding in your portfolio");
    expect(positionDescription(2)).toBe("2 active holdings in your portfolio");
  });
});
