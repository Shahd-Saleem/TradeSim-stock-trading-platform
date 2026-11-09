import { describe, expect, it } from "vitest";
import { previewOrder } from "./order-preview";

describe("read-only order preview", () => {
  it("estimates exact integer-fils values without changing the balance", () => {
    const balance = 100;
    expect(previewOrder("3", 29, "buy", balance)).toEqual({
      quantity: 3,
      valueFils: 87,
      error: null,
    });
    expect(balance).toBe(100);
    expect(previewOrder(" 003 ", 29, "buy").valueFils).toBe(87);
  });
  it.each([
    "",
    " ",
    "0",
    "-1",
    "1.5",
    "1e3",
    "Infinity",
    "NaN",
    "abc",
    "1,000",
    "9007199254740992",
  ])("handles invalid quantity %j", (input) => {
    const result = previewOrder(input, 1345, "buy");
    expect(result.error).toBeTruthy();
    expect(result.valueFils).toBeNull();
  });
  it("rejects unsafe products without throwing", () => {
    expect(previewOrder("9007199254740991", 1345, "buy").valueFils).toBeNull();
  });
  it("allows the exact balance and warns above it while retaining the estimate", () => {
    expect(previewOrder("2", 50, "buy", 100).error).toBeNull();
    expect(previewOrder("3", 50, "buy", 100)).toMatchObject({
      valueFils: 150,
      error: expect.any(String),
    });
  });
  it("warns on sells with no holdings and re-estimates for a different stock", () => {
    expect(previewOrder("1", 1345, "sell").error).toBeTruthy();
    expect(previewOrder("2", 284, "buy").valueFils).toBe(568);
    expect(previewOrder("2", 1345, "buy").valueFils).toBe(2690);
  });
});
