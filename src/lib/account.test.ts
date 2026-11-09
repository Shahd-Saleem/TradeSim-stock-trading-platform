import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAccount } from "./account";
import { currentSession } from "./session";
import { readAccount } from "./account-service";
import { redirect } from "next/navigation";
vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({ currentSession: vi.fn() }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./account-service", () => ({ readAccount: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
beforeEach(() => vi.clearAllMocks());
describe("server-side personal route protection", () => {
  it.each(["/dashboard", "/portfolio", "/activity"])(
    "redirects anonymous requests for %s before reading financial data",
    async (path) => {
      vi.mocked(currentSession).mockResolvedValue(null);
      await expect(requireAccount(path)).rejects.toThrow("REDIRECT");
      expect(redirect).toHaveBeenCalledWith(
        "/login?returnTo=" + encodeURIComponent(path),
      );
      expect(readAccount).not.toHaveBeenCalled();
    },
  );
  it("does not replace a failed account read with a sample balance", async () => {
    vi.mocked(currentSession).mockRejectedValue(new Error("Unavailable"));
    await expect(requireAccount("/dashboard")).rejects.toThrow(
      "Account temporarily unavailable",
    );
    expect(redirect).not.toHaveBeenCalled();
    expect(readAccount).not.toHaveBeenCalled();
  });
  it("loads account data only for the verified session user", async () => {
    const now = new Date();
    vi.mocked(currentSession).mockResolvedValue({
      user: {
        id: "verified-user",
        name: "Amal",
        email: "amal@example.test",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      },
      session: {
        id: "session-id",
        userId: "verified-user",
        token: "test-token",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    const account = {
      user: { name: "Amal", email: "amal@example.test" },
      cashBalanceFils: 5000,
      startingCapitalFils: 10000000,
      portfolioValueFils: 5000,
      profitLossFils: -9995000,
      holdings: [],
      trades: [],
    };
    vi.mocked(readAccount).mockResolvedValue(account);
    expect(await requireAccount("/dashboard")).toEqual(account);
    expect(readAccount).toHaveBeenCalledWith(
      expect.anything(),
      "verified-user",
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
