// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PortfolioHoldings } from "./PortfolioHoldings";
import { holdingAnalytics, portfolioAnalytics } from "@/lib/portfolio";
import type { AccountData } from "@/lib/account-types";
afterEach(cleanup);
function account(price: bigint | null): AccountData {
  return {
    user: { name: "Trader", email: "trader@example.test" },
    cashBalanceFils: 9999798,
    startingCapitalFils: 10000000,
    ...portfolioAnalytics(9999798n, 10000000n, 502n, 300n, [
      { quantity: 3n, costBasisFils: 302n, priceFils: price },
    ]),
    holdings: [
      {
        name: "Emaar Properties",
        symbol: "EMAAR",
        exchange: "DFM",
        quoteSnapshotAt: price === null ? null : "2026-11-09",
        ...holdingAnalytics(3n, 302n, price),
      },
    ],
    trades: [],
  };
}
it("shows weighted cost, current valuation and full-sale estimates with accessible gains", () => {
  render(<PortfolioHoldings account={account(150n)} />);
  expect(
    screen.getByRole("heading", { name: "Emaar Properties" }),
  ).toBeTruthy();
  expect(screen.getByText("AED 1.01")).toBeTruthy();
  expect(screen.getByText("AED 3.02")).toBeTruthy();
  expect(screen.getByText("AED 1.50")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "If you sold all 3 shares" }),
  ).toBeTruthy();
  expect(screen.getAllByText(/Gain \+AED 1.48/).length).toBeGreaterThan(0);
  expect(screen.getByText(/49.01%/)).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Realized profit / loss" }),
  ).toBeTruthy();
});
it("labels losses and break-even without relying on colors", () => {
  const view = render(<PortfolioHoldings account={account(90n)} />);
  expect(screen.getAllByText(/Loss AED -0.32/).length).toBeGreaterThan(0);
  view.rerender(
    <PortfolioHoldings
      account={{
        ...account(100n),
        holdings: [
          { ...account(100n).holdings[0], ...holdingAnalytics(3n, 300n, 100n) },
        ],
      }}
    />,
  );
  expect(screen.getAllByText(/Break-even AED 0.00/).length).toBeGreaterThan(0);
});
it("keeps missing valuations unavailable and completed gains visible for closed portfolios", () => {
  const view = render(<PortfolioHoldings account={account(null)} />);
  expect(screen.getByText("Quote unavailable")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Full equity");
  view.rerender(
    <PortfolioHoldings
      account={{
        ...account(100n),
        holdings: [],
        realizedProfitLossFils: 218,
        unrealizedProfitLossFils: 0,
        profitLossFils: 218,
      }}
    />,
  );
  expect(screen.queryByRole("region", { name: "Your holdings" })).toBeNull();
  expect(screen.getAllByText(/Gain \+AED 2.18/).length).toBeGreaterThan(0);
});
