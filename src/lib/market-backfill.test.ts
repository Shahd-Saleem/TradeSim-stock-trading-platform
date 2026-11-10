import { expect, it } from "vitest";
import {
  historicalPrevious,
  historicalSeries,
  previousTradingDay,
} from "./market-backfill";
import { dailyPrice } from "./daily-market";
import { stocks } from "./market";

it("finds previous eligible sessions across weekends and years", () => {
  expect(previousTradingDay("2026-11-09")).toBe("2026-11-06");
  expect(previousTradingDay("2027-01-01")).toBe("2026-12-31");
});
it("generates deterministic, varied, connected history for every security", () => {
  for (const stock of stocks) {
    const anchor = {
      date: "2026-11-09",
      previousCloseFils: BigInt(stock.previousFils),
    };
    const points = historicalSeries(anchor, "2026-05-11", stock);
    expect(points.length).toBeGreaterThan(120);
    expect(points).toEqual(historicalSeries(anchor, "2026-05-11", stock));
    expect(points.at(-1)!.priceFils).toBe(anchor.previousCloseFils);
    let gains = 0,
      losses = 0;
    for (const [index, point] of points.entries()) {
      expect(point.priceFils).toBeGreaterThan(0n);
      expect([0, 6]).not.toContain(new Date(point.date).getUTCDay());
      expect(point.date >= "2026-05-11" && point.date < anchor.date).toBe(true);
      if (index)
        expect(point.previousCloseFils).toBe(points[index - 1].priceFils);
      const delta = point.priceFils - point.previousCloseFils;
      if (delta > 0n) gains++;
      if (delta < 0n) losses++;
      const forward = dailyPrice(
        point.previousCloseFils,
        point.date,
        stock,
      ).priceFils;
      expect(
        Number(
          forward > point.priceFils
            ? forward - point.priceFils
            : point.priceFils - forward,
        ),
      ).toBeLessThanOrEqual(1);
    }
    expect(gains).toBeGreaterThan(20);
    expect(losses).toBeGreaterThan(20);
  }
});
it("does not produce points inside existing history and rejects unsafe anchors", () => {
  expect(
    historicalSeries(
      { date: "2026-05-11", previousCloseFils: 100n },
      "2026-05-11",
      stocks[0],
    ),
  ).toEqual([]);
  expect(() => historicalPrevious(0n, "2026-11-09", stocks[0])).toThrow();
  expect(() =>
    historicalPrevious(10n ** 30n, "2026-11-09", stocks[0]),
  ).toThrow();
  expect(() => previousTradingDay("2026-02-30")).toThrow();
});
