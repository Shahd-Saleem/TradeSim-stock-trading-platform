// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { Dashboard as WorkspaceDashboard } from "./Dashboard";
import { marketFixture } from "../../tests/fixtures/market";
import type { MarketData } from "@/lib/market-data";
function Dashboard({
  market = marketFixture,
  ...props
}: Omit<Parameters<typeof WorkspaceDashboard>[0], "market"> & {
  market?: MarketData;
}) {
  return <WorkspaceDashboard market={market} {...props} />;
}
import type { AccountData } from "@/lib/account-types";
import { stocks } from "@/lib/market";
import { holdingAnalytics } from "@/lib/portfolio";
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./PriceChart", () => ({
  PriceChart: ({
    stock,
    days,
  }: {
    stock: { symbol: string };
    days: number;
  }) => (
    <div role="img" aria-label={stock.symbol + " chart " + days + " days"} />
  ),
}));
const account: AccountData = {
  user: { name: "Amal Hassan", email: "amal@example.test" },
  cashBalanceFils: 5000,
  startingCapitalFils: 10000000,
  portfolioValueFils: 5000,
  profitLossFils: -9995000,
  valuationComplete: true,
  realizedProfitLossFils: 0,
  unrealizedProfitLossFils: 0,
  returnBasisPoints: 0,
  cashAdjustmentFils: -9995000,
  holdings: [],
  trades: [],
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/account"
          ? account
          : {
              priceFils: stocks.find((stock) =>
                url.includes(`symbol=${stock.symbol}`),
              )!.priceFils,
              token: "test-quote",
              expiresAt: Date.now() + 300000,
              snapshotAt: "2026-11-09",
            },
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe("public and private workspace", () => {
  it.each([304, -304])(
    "shows small signed returns consistently for P/L of %s fils",
    (profit) => {
      const data = {
        ...account,
        profitLossFils: profit,
        returnBasisPoints: 0,
        portfolioValueFils: account.startingCapitalFils + profit,
      };
      const expected = profit > 0 ? "+0.0030%" : "-0.0030%";
      const { rerender } = render(
      <Dashboard initialView="Overview" account={data} />,
      );
      expect(screen.getByText(`${expected} all time`)).toBeTruthy();
      expect(screen.getByText(`${expected} return`)).toBeTruthy();
    rerender(<Dashboard initialView="Portfolio" account={data} />);
      expect(
        screen.getAllByText(
          new RegExp(expected.replace(/[+.*?^${}()|[\]\\]/g, "\\$&")),
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it("uses persisted market prices, dates and refreshed stock data instead of bootstrap fixtures", () => {
    const market = {
      ...marketFixture,
      sessionDate: "2026-11-10",
      stocks: marketFixture.stocks.map((stock, index) =>
        index === 0
          ? { ...stock, priceFils: 1500, sessionDate: "2026-11-10" }
          : stock,
      ),
    };
    const view = render(<Dashboard initialView="Markets" market={market} />);
    expect(screen.getByText("2026-11-10")).toBeTruthy();
    expect(screen.getAllByText("AED 15.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("AED 13.45")).toBeNull();
    view.rerender(
      <Dashboard
        initialView="Markets"
        market={{
          ...market,
          stocks: market.stocks.map((stock, index) =>
            index === 0 ? { ...stock, priceFils: 1600 } : stock,
          ),
        }}
      />,
    );
    expect(screen.getAllByText("AED 16.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("AED 15.00")).toBeNull();
  });
  it("shows guest charts without personal balances, private views or order entry", () => {
    const { container } = render(<Dashboard initialView="Markets" />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "EMAAR chart 90 days" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Portfolio summary" }),
    ).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Quantity/ })).toBeNull();
    expect(screen.queryByText("Available virtual balance")).toBeNull();
    expect(container.textContent).not.toContain("100,000");
    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    ).toBe("/dashboard");
    expect(
      screen.getByRole("link", { name: "Portfolio" }).getAttribute("href"),
    ).toBe("/portfolio");
    expect(
      screen.getByRole("link", { name: "Activity" }).getAttribute("href"),
    ).toBe("/activity");
  });
  it.each(["Overview", "Portfolio", "Activity"] as const)(
    "never renders the private %s view without account data",
    (initialView) => {
      render(<Dashboard initialView={initialView} />);
      expect(
        screen.queryByRole("region", { name: "Portfolio summary" }),
      ).toBeNull();
      expect(screen.getByRole("table")).toBeTruthy();
    },
  );
  it("preserves guest search, exchange filters, stock selection and chart periods", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <Dashboard
        initialView="Markets"
        initialSymbol="FAB"
        initialExchange="ADX"
      />,
    );
    expect(screen.getByRole("img", { name: "FAB chart 90 days" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1M" }));
    expect(screen.getByRole("img", { name: "FAB chart 30 days" })).toBeTruthy();
    const search = screen.getByRole("textbox", {
      name: "Search stocks by symbol, company or sector",
    });
    fireEvent.change(search, { target: { value: "bank" } });
    expect(screen.getAllByRole("row")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "ADX" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.change(search, { target: { value: "no-such-company" } });
    expect(screen.getByText(/No companies match/)).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "All markets" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "View Dubai Electricity & Water chart and order preview",
      }),
    );
    expect(
      screen.getByRole("img", { name: "DEWA chart 30 days" }),
    ).toBeTruthy();
  });
  it("shows the saved account, real profile and route-based navigation", () => {
    render(<Dashboard account={account} initialView="Overview" />);
    expect(
      screen.getByRole("region", { name: "Portfolio summary" }).textContent,
    ).toContain("AED 50.00");
    expect(
      screen.getByRole("heading", { name: "Portfolio performance" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByText("amal@example.test").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByText("Amal Hassan", { selector: "summary strong" }),
    );
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Explore First Abu Dhabi Bank in Markets",
      }),
    );
    expect(router.push).toHaveBeenCalledWith(
      "/markets?symbol=FAB&exchange=ADX",
    );
  });
  it("uses the saved balance for authenticated previews and requires review", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Dashboard account={account} initialView="Markets" />);
    const panel = within(
      screen.getByRole("region", { name: "Plan your next move." }),
    );
    const quantity = panel.getByRole("textbox", { name: /Quantity/ });
    await waitFor(() =>
      expect(panel.queryByText(/Loading your account/)).toBeNull(),
    );
    expect(panel.getByText("AED 50.00")).toBeTruthy();
    fireEvent.change(quantity, { target: { value: "3" } });
    expect(panel.getByText("AED 40.35")).toBeTruthy();
    fireEvent.change(quantity, { target: { value: "4" } });
    expect(
      panel.getByText(/exceeds your available virtual balance/),
    ).toBeTruthy();
    fireEvent.change(quantity, { target: { value: "1.5" } });
    expect(quantity.getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(panel.getByRole("button", { name: "Sell" }));
    fireEvent.change(quantity, { target: { value: "1" } });
    expect(panel.getByText(/do not hold enough shares/)).toBeTruthy();
    expect(
      panel
        .getByRole("button", { name: "Review Sell" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "View Dubai Electricity & Water chart and order preview",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: /Quantity/ }).getAttribute("value"),
      ).toBe(""),
    );
  });
  it.each([
    ["Portfolio", "Your first position is still ahead."],
    ["Activity", "No transactions yet."],
  ] as const)(
    "preserves the authenticated %s empty state",
    (initialView, heading) => {
      render(<Dashboard account={account} initialView={initialView} />);
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    },
  );
  it("refreshes virtual cash and owned shares in place after a confirmed buy", async () => {
    let traded = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          traded = true;
          return Response.json(
            { ok: true, trade: { quantity: "1", totalValueFils: "1345" } },
            { status: 201 },
          );
        }
        return Response.json(
          url === "/api/account"
            ? traded
              ? {
                  ...account,
                  cashBalanceFils: 3655,
                  holdings: [
                    {
                      symbol: "EMAAR",
                      exchange: "DFM",
                      quantity: 1,
                      costBasisFils: 1345,
                      valueFils: 1345,
                    },
                  ],
                }
              : account
            : {
                priceFils: 1345,
                token: "quote",
                expiresAt: Date.now() + 300000,
                snapshotAt: "2026-11-09",
              },
        );
      }),
    );
    const view = render(<Dashboard account={account} initialView="Markets" />);
    await waitFor(() =>
      expect(screen.queryByText(/Loading your account/)).toBeNull(),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Quantity/ }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
    expect(
      screen
        .getByRole("button", { name: "Select FAB chart" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Buy" }));
    await waitFor(() => expect(screen.getByText("AED 36.55")).toBeTruthy());
    await waitFor(() =>
      expect(
        screen.getByText("Shares held · EMAAR").nextElementSibling?.textContent,
      ).toBe("1"),
    );
    view.rerender(
      <Dashboard
        account={{
          ...account,
          cashBalanceFils: 10000,
          portfolioValueFils: 10000,
        }}
        initialView="Overview"
      />,
    );
    expect(
      screen.getByRole("region", { name: "Portfolio summary" }).textContent,
    ).toContain("AED 100.00");
  });
  it.each([0, 1, 2])(
    "describes %s actual positions and shows honest history",
    (count) => {
      render(
        <Dashboard
          initialView="Overview"
          account={{
            ...account,
            holdings: Array.from({ length: count }, (_, index) => ({
              symbol: `TEST${index}`,
              exchange: "DFM",
              name: "Test holding",
              quoteSnapshotAt: "2026-11-09",
              ...holdingAnalytics(1n, 100n, 100n),
            })),
          }}
        />,
      );
      expect(
        screen.getByText(
          count === 0
            ? "No open positions yet"
            : `${count} active ${count === 1 ? "holding" : "holdings"} in your portfolio`,
        ),
      ).toBeTruthy();
      expect(screen.getByText("Insufficient performance history")).toBeTruthy();
      expect(screen.queryByText("Your portfolio is a blank canvas")).toBeNull();
      expect(
        screen.queryByRole("img", { name: /Current virtual portfolio/ }),
      ).toBeNull();
    },
  );
  it("keeps closed-portfolio realized returns visible without implying the user has never traded", () => {
    render(
      <Dashboard
        initialView="Portfolio"
        account={{
          ...account,
          cashBalanceFils: 10000218,
          portfolioValueFils: 10000218,
          realizedProfitLossFils: 218,
          unrealizedProfitLossFils: 0,
          profitLossFils: 218,
          cashAdjustmentFils: 0,
          trades: [
            {
              id: "closed",
              symbol: "EMAAR",
              side: "SELL",
              quantity: 3,
              totalValueFils: 420,
              createdAt: "2026-11-09T00:00:00.000Z",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No open positions right now." }),
    ).toBeTruthy();
    expect(screen.getAllByText(/Gain \+AED 2.18/).length).toBeGreaterThan(0);
  });
});
