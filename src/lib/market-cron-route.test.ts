import { afterEach, expect, it, vi } from "vitest";
const sync = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ sessionsPublished: 0 }),
);
vi.mock("./market-writer", () => ({ marketWriter: () => ({}) }));
vi.mock("./market-sync", () => ({ syncMarket: sync }));
import { GET } from "@/app/api/cron/market/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it.each(["preview", "development"])(
  "blocks the handler on Vercel %s even with valid credentials",
  async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("MARKET_CRON_ENABLED", "true");
    vi.stubEnv("CRON_SECRET", "s".repeat(48));
    expect(
      (
        await GET(
          new Request("https://example.test/api/cron/market", {
            headers: { authorization: `Bearer ${"s".repeat(48)}` },
          }),
        )
      ).status,
    ).toBe(503);
    expect(sync).not.toHaveBeenCalled();
  },
);
it("wires server time and configured closures into production synchronization", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("MARKET_CRON_ENABLED", "true");
  vi.stubEnv("CRON_SECRET", "s".repeat(48));
  vi.stubEnv("MARKET_CLOSED_DATES", "2026-12-02");
  expect(
    (
      await GET(
        new Request("https://example.test/api/cron/market", {
          headers: { authorization: `Bearer ${"s".repeat(48)}` },
        }),
      )
    ).status,
  ).toBe(200);
  expect(sync).toHaveBeenCalledWith(
    {},
    expect.any(Date),
    new Set(["2026-12-02"]),
  );
});
