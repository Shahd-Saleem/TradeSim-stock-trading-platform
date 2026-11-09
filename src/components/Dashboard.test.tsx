// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import type { AccountData } from "@/lib/account-types";
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
  holdings: [],
  trades: [],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("public and private workspace", () => {
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
  it("uses the saved balance for authenticated previews and keeps execution disabled", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Dashboard account={account} initialView="Markets" />);
    const panel = within(
      screen.getByRole("region", { name: "Plan your next move." }),
    );
    const quantity = panel.getByRole("textbox", { name: /Quantity/ });
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
        .getByRole("button", { name: "Trading available in Phase 3" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "View Dubai Electricity & Water chart and order preview",
      }),
    );
    expect(panel.getByText("AED 5.68")).toBeTruthy();
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
});
