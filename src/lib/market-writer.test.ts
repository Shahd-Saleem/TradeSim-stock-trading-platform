import { afterEach, expect, it, vi } from "vitest";
const factory = vi.hoisted(() => vi.fn(() => ({ writer: true })));
vi.mock("server-only", () => ({}));
vi.mock("./prisma-client", () => ({ createPrisma: factory }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
it("requires separate quote-only credentials and never falls back to runtime/admin connections", async () => {
  const { marketWriter } = await import("./market-writer");
  vi.stubEnv("MARKET_DATABASE_URL", "");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://tradesim_runtime:example@db.example.test/postgres",
  );
  vi.stubEnv(
    "DIRECT_URL",
    "postgresql://postgres:example@db.example.test/postgres",
  );
  expect(() => marketWriter()).toThrow();
  vi.stubEnv(
    "MARKET_DATABASE_URL",
    "postgresql://postgres:example@db.example.test/postgres",
  );
  expect(() => marketWriter()).toThrow("dedicated market writer");
  expect(factory).not.toHaveBeenCalled();
});
it("creates a lazy shared writer pool only for the dedicated role", async () => {
  const { marketWriter } = await import("./market-writer");
  const url =
    "postgresql://tradesim_market_writer.project:example@db.example.test:6543/postgres";
  vi.stubEnv("MARKET_DATABASE_URL", url);
  expect(marketWriter()).toBe(marketWriter());
  expect(factory).toHaveBeenCalledExactlyOnceWith(url);
});
