import { describe, expect, it } from "vitest";
import { aed, changePercent, positionValue, STARTING_CAPITAL } from "./money";
import { history, stocks } from "./market";
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
  it("keeps dates ordered and prices positive across every stock", () => {
    for (const stock of stocks) {
      const points = history(stock, 180);
      expect(points.every((point) => point.value > 0)).toBe(true);
      expect(points.map((point) => point.time)).toEqual(
        points.map((point) => point.time).sort(),
      );
      expect(history(stock, 30)).toEqual(points.slice(-30));
    }
  });
  it("is deterministic and ends at the quoted price", () => {
    const data = history(stocks[0], 90);
    expect(data).toEqual(history(stocks[0], 90));
    expect(data).toHaveLength(90);
    expect(data.at(-1)?.value).toBe(stocks[0].priceFils / 100);
    expect(new Set(data.map((p) => p.time)).size).toBe(90);
  });
});
