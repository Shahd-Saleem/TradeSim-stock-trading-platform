import { describe, expect, it } from "vitest";
import {
  dailyPrice,
  dubaiDate,
  marketLockKey,
  nextTradingDay,
  validDate,
} from "./daily-market";
import { stocks } from "./market";
describe("daily fictional market", () => {
  it("uses Dubai calendar dates even near UTC midnight", () => {
    expect(dubaiDate(new Date("2026-11-09T20:01:00Z"))).toBe("2026-11-10");
    expect(dubaiDate(new Date("2026-11-09T19:59:00Z"))).toBe("2026-11-09");
  });
  it("advances one weekday, skipping weekends and crossing months/years", () => {
    expect(nextTradingDay("2026-11-09")).toBe("2026-11-10");
    expect(nextTradingDay("2026-11-13")).toBe("2026-11-16");
    expect(nextTradingDay("2027-12-31")).toBe("2028-01-03");
  });
  it.each(["2026-02-30", "2026-13-01", "11/09/2026", "bad"])(
    "rejects invalid date %s",
    (value) => {
      expect(() => validDate(value)).toThrow();
    },
  );
  it("is stable, positive, bounded and generates both gains and losses", () => {
    const signs = new Set<number>();
    let date = "2026-11-09";
    for (let day = 0; day < 40; day++) {
      date = nextTradingDay(date);
      for (const stock of stocks) {
        const result = dailyPrice(BigInt(stock.priceFils), date, stock);
        expect(result).toEqual(
          dailyPrice(BigInt(stock.priceFils), date, stock),
        );
        expect(result.priceFils).toBeGreaterThan(0n);
        expect(Math.abs(result.basisPoints)).toBeLessThanOrEqual(300);
        signs.add(Math.sign(Number(result.priceFils) - stock.priceFils));
      }
    }
    expect(signs.has(-1)).toBe(true);
    expect(signs.has(1)).toBe(true);
  });
  it("guards monetary range and schema identifiers", () => {
    expect(() => dailyPrice(0n, "2026-11-10", stocks[0])).toThrow();
    expect(() => marketLockKey('tradesim";DROP SCHEMA')).toThrow();
  });
});
