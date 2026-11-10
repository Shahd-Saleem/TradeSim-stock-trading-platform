import { describe, expect, it } from "vitest";
import { aed, changePercent, positionValue, STARTING_CAPITAL } from "./money";
import { stocks, stockSchema } from "./market";
describe("financial primitives", () => {
  it("calculates share values exactly in fils", () => {
    expect(positionValue(29, 3)).toBe(87);
    expect(STARTING_CAPITAL).toBe(10000000);
  });
  it("rejects fractions, negative shares and unsafe amounts", () => {
    for (const args of [
      [2.1, 1],
      [2, -1],
      [Number.MAX_SAFE_INTEGER, 2],
    ])
      expect(() => positionValue(args[0], args[1])).toThrow(RangeError);
  });
  it("formats AED and handles zero baseline", () => {
    expect(aed(1345)).toBe("AED 13.45");
    expect(changePercent(1, 0)).toBe(0);
    expect(changePercent(110, 100)).toBe(10);
  });
});
describe("simulated market", () => {
  it("keeps eight validated bootstrap securities; displayed history comes from PostgreSQL", () => {
    expect(stocks).toHaveLength(8);
    for (const stock of stocks)
      expect(stockSchema.safeParse(stock).success).toBe(true);
    expect(
      new Set(stocks.map((stock) => `${stock.exchange}:${stock.symbol}`)).size,
    ).toBe(8);
  });
});
