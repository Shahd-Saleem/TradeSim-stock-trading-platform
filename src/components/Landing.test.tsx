// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Landing } from "./Landing";
import { marketFixture } from "../../tests/fixtures/market";
afterEach(cleanup);
describe("public landing page", () => {
  it("shows saved prices and short history rather than a fabricated chart", () => {
    render(
      <Landing
        authenticated={false}
        market={{
          ...marketFixture,
          stocks: marketFixture.stocks.map((stock, index) =>
            index === 0 ? { ...stock, priceFils: 1500 } : stock,
          ),
        }}
      />,
    );
    expect(screen.getByText("AED 15.00")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /price history/ })).toBeNull();
    expect(screen.getByText(/Only saved quotes will be charted/)).toBeTruthy();
  });
  it("explains the simulated product and links guests to registration and markets", () => {
    render(<Landing authenticated={false} market={marketFixture} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Learn the market.",
    );
    for (const link of screen.getAllByRole("link", { name: "Start Trading" }))
      expect(link.getAttribute("href")).toBe("/register");
    expect(
      screen.getByRole("link", { name: "Sign In" }).getAttribute("href"),
    ).toBe("/login");
    expect(
      screen.getByText("Virtual starting capital per new account"),
    ).toBeTruthy();
    expect(screen.queryByText("Available balance")).toBeNull();
  });
  it("sends authenticated users to their dashboard without exposing private account data", () => {
    render(<Landing authenticated market={marketFixture} />);
    for (const link of screen.getAllByRole("link", { name: "Start Trading" }))
      expect(link.getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
  });
});
