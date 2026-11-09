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

// Canvas rendering belongs to Lightweight Charts; test our selection/range contract here.
vi.mock("./PriceChart", () => ({
  PriceChart: ({
    stock,
    days,
  }: {
    stock: { symbol: string };
    days: number;
  }) => <div role="img" aria-label={`${stock.symbol} chart ${days} days`} />,
}));
afterEach(cleanup);

describe("Phase 1 workspace", () => {
  it("separates the account overview from stock discovery and keeps navigation named", () => {
    render(<Dashboard />);
    expect(
      screen.getByRole("heading", { name: "Portfolio performance" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Sample watchlist" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Market highlights" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    for (const name of ["Overview", "Markets", "Portfolio", "Activity"])
      expect(screen.getByRole("button", { name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Markets" }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Portfolio performance" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Markets" })
        .getAttribute("aria-current"),
    ).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Portfolio" }));
    expect(
      screen.getByRole("heading", {
        name: "Your first position is still ahead.",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));
    expect(
      screen.getByRole("heading", { name: "No transactions yet." }),
    ).toBeTruthy();
  });

  it("opens a watchlist stock in Markets, filters the table and updates chart details", () => {
    render(<Dashboard />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Explore First Abu Dhabi Bank in Markets",
      }),
    );
    expect(screen.getByRole("img", { name: "FAB chart 90 days" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1M" }));
    expect(screen.getByRole("img", { name: "FAB chart 30 days" })).toBeTruthy();
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search stocks by symbol, company or sector",
      }),
      { target: { value: "bank" } },
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "ADX" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search stocks by symbol, company or sector",
      }),
      { target: { value: "no-such-company" } },
    );
    expect(screen.getByText(/No companies match/)).toBeTruthy();
  });

  it("validates a read-only order preview and preserves virtual capital", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Markets" }));
    const panel = within(
      screen.getByRole("region", { name: "Plan your next move." }),
    );
    const quantity = panel.getByRole("textbox", { name: /Quantity/ });
    const submit = panel.getByRole("button", {
      name: "Trading available in Phase 3",
    });
    expect(submit.hasAttribute("disabled")).toBe(true);
    fireEvent.change(quantity, { target: { value: "3" } });
    expect(panel.getByText("AED 40.35")).toBeTruthy();
    fireEvent.change(quantity, { target: { value: "1.5" } });
    expect(quantity.getAttribute("aria-invalid")).toBe("true");
    expect(panel.getByText("AED —")).toBeTruthy();
    fireEvent.change(quantity, { target: { value: "1000000" } });
    expect(
      panel.getByText(/exceeds your available virtual balance/),
    ).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: "Sell" }));
    fireEvent.change(quantity, { target: { value: "1" } });
    expect(panel.getByText(/do not hold enough shares/)).toBeTruthy();
    expect(submit.hasAttribute("disabled")).toBe(true);
    expect(panel.getByText("AED 100,000.00")).toBeTruthy();
    fireEvent.change(quantity, { target: { value: "" } });
    expect(
      panel.getByText("Enter a quantity to preview an order."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(
      screen.getByRole("region", { name: "Portfolio summary" }).textContent,
    ).toContain("AED 100,000.00");
  });

  it("keeps the order estimate in sync when selecting a different stock", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Markets" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Quantity/ }), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "View Dubai Electricity & Water chart and order preview",
      }),
    );
    expect(
      screen.getByRole("img", { name: "DEWA chart 90 days" }),
    ).toBeTruthy();
    const panel = within(
      screen.getByRole("region", { name: "Plan your next move." }),
    );
    expect(panel.getByText("AED 5.68")).toBeTruthy();
    expect(
      panel
        .getByRole("button", { name: "Trading available in Phase 3" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
