// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Landing } from "./Landing";
afterEach(cleanup);
describe("public landing page", () => {
  it("explains the simulated product and links guests to registration and markets", () => {
    render(<Landing authenticated={false} />);
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
    render(<Landing authenticated />);
    for (const link of screen.getAllByRole("link", { name: "Start Trading" }))
      expect(link.getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
  });
});
