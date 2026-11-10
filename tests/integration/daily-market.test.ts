import { afterAll, beforeAll, expect, it } from "vitest";
import { config } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { createPrisma } from "@/lib/prisma-client";
import { databaseConfig } from "@/lib/database-config";
import { advanceMarket, dailyPrice } from "@/lib/daily-market";
import { backfillMarket } from "@/lib/market-backfill";
import { syncMarket, MAX_CATCHUP_SESSIONS } from "@/lib/market-sync";
import { closedDates } from "@/lib/market-calendar";
import { readMarket } from "@/lib/market-data";
import { readAccount } from "@/lib/account-service";
import { executeOrder } from "@/lib/order-service";
import { readOrderQuote } from "@/lib/order-quote";
import { stocks, SNAPSHOT_DATE } from "@/lib/market";
config({ path: ".env.local", quiet: true });
const schema = `tradesim_test_${randomBytes(12).toString("hex")}`;
let admin: pg.Client;
let owner: ReturnType<typeof createPrisma>;
let runtime: ReturnType<typeof createPrisma>;
let created = false;
const userId = randomUUID();
const held = stocks.find(
  (stock) =>
    dailyPrice(BigInt(stock.priceFils), "2026-11-10", stock).priceFils !==
    BigInt(stock.priceFils),
)!;
const secret = randomBytes(48).toString("hex");
let originalToken: string;
let originalTrade: Awaited<ReturnType<typeof executeOrder>>;
const buy = (quantity: number) => ({
  symbol: held.symbol,
  exchange: held.exchange,
  side: "BUY" as const,
  quantity,
  idempotencyKey: randomUUID(),
});
beforeAll(async () => {
  try {
    const connection =
      process.env.TEST_DATABASE_URL ||
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL;
    const runtimeConnection =
      process.env.TEST_RUNTIME_DATABASE_URL ||
      (process.env.TEST_DATABASE_URL ? undefined : process.env.DATABASE_URL);
    if (!runtimeConnection)
      throw new Error("Restricted runtime test connection required");
    admin = new pg.Client(databaseConfig(connection));
    await admin.connect();
    await admin.query("BEGIN");
    for (const directory of readdirSync("prisma/migrations")
      .filter((value) => /^\d/.test(value))
      .sort()) {
      const sql = readFileSync(
        `prisma/migrations/${directory}/migration.sql`,
        "utf8",
      )
        .replaceAll("tradesim_runtime", "RUNTIME_PLACEHOLDER")
        .replaceAll("tradesim", schema)
        .replaceAll("RUNTIME_PLACEHOLDER", "tradesim_runtime");
      await admin.query(sql);
    }
    await admin.query("COMMIT");
    created = true;
    await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO tradesim_runtime`);
    await admin.query(
      `GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO tradesim_runtime`,
    );
    owner = createPrisma(connection, schema);
    runtime = createPrisma(runtimeConnection, schema);
    for (const stock of stocks) {
      await owner.security.create({
        data: {
          symbol: stock.symbol,
          exchange: stock.exchange,
          name: stock.name,
          sector: stock.sector,
          color: stock.color,
          quotes: {
            create: {
              priceFils: BigInt(stock.priceFils),
              previousCloseFils: BigInt(stock.previousFils),
              volume: stock.volume,
              snapshotAt: new Date(`${SNAPSHOT_DATE}T00:00:00Z`),
            },
          },
        },
      });
    }
    await owner.user.create({
      data: {
        id: userId,
        name: "Market test",
        email: `${userId}@example.test`,
      },
    });
    originalToken = (
      await readOrderQuote(runtime, held.exchange, held.symbol, secret)
    ).token;
    originalTrade = await executeOrder(
      runtime,
      userId,
      buy(10),
      schema,
      secret,
    );
  } catch {
    throw new Error(
      "Daily market PostgreSQL setup failed; connection details withheld.",
    );
  }
});
afterAll(async () => {
  await runtime?.$disconnect();
  await owner?.$disconnect();
  if (admin) {
    await admin.query("ROLLBACK").catch(() => {});
    if (created && /^tradesim_test_[a-f0-9]{24}$/.test(schema))
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
it("reads persisted bootstrap quotes with one honest historical point", async () => {
  const market = await readMarket(runtime);
  expect(market.sessionDate).toBe(SNAPSHOT_DATE);
  expect(market.stocks).toHaveLength(8);
  expect(
    market.stocks.every(
      (stock) =>
        stock.history.length === 1 &&
        stock.history[0].priceFils === stock.priceFils,
    ),
  ).toBe(true);
});
it("publishes all eight exactly once under concurrent dated retries without mutating financial records", async () => {
  const accountBefore = await owner.virtualAccount.findMany();
  const holdingsBefore = await owner.holding.findMany();
  const tradesBefore = await owner.trade.findMany();
  const legacyBefore = await owner.simulatedQuote.findMany({
    orderBy: { securityId: "asc" },
  });
  const before = await readAccount(runtime, userId);
  const results = await Promise.all(
    Array.from({ length: 3 }, () => advanceMarket(owner, "2026-11-10", schema)),
  );
  expect(results.filter((result) => result.created)).toHaveLength(1);
  expect(await owner.simulatedQuote.count()).toBe(16);
  expect(await owner.virtualAccount.findMany()).toEqual(accountBefore);
  expect(await owner.holding.findMany()).toEqual(holdingsBefore);
  expect(await owner.trade.findMany()).toEqual(tradesBefore);
  for (const quote of legacyBefore)
    expect(
      await owner.simulatedQuote.findUnique({ where: { id: quote.id } }),
    ).toEqual(quote);
  const market = await readMarket(runtime);
  expect(await readMarket(runtime)).toEqual(market);
  expect(
    market.stocks.every(
      (stock) =>
        stock.sessionDate === "2026-11-10" && stock.history.length === 2,
    ),
  ).toBe(true);
  const current = market.stocks.find((stock) => stock.symbol === held.symbol)!;
  const after = await readAccount(runtime, userId);
  expect(after.cashBalanceFils).toBe(before.cashBalanceFils);
  expect(after.portfolioValueFils! - before.portfolioValueFils!).toBe(
    (current.priceFils - held.priceFils) * 10,
  );
  expect(after.unrealizedProfitLossFils).toBe(
    (current.priceFils - held.priceFils) * 10,
  );
  expect(after.holdings[0].costBasisFils).toBe(
    before.holdings[0].costBasisFils,
  );
}, 120000);
it("rolls back a failed historical batch without altering published prices", async () => {
  const before = await owner.simulatedQuote.findMany({
    orderBy: { id: "asc" },
  });
  await admin.query(
    `CREATE FUNCTION "${schema}".fail_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."snapshotAt" < '2026-11-09' THEN RAISE EXCEPTION 'Injected failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    `CREATE TRIGGER fail_history BEFORE INSERT ON "${schema}"."SimulatedQuote" FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_history()`,
  );
  try {
    await expect(backfillMarket(owner, schema)).rejects.toThrow();
    expect(
      await owner.simulatedQuote.findMany({ orderBy: { id: "asc" } }),
    ).toEqual(before);
  } finally {
    await admin.query(
      `DROP TRIGGER fail_history ON "${schema}"."SimulatedQuote"`,
    );
  }
}, 120000);
it("executes at saved daily prices, rejects stale confirmations and preserves original trade prices", async () => {
  await expect(
    executeOrder(
      runtime,
      userId,
      { ...buy(1), quoteToken: originalToken },
      schema,
      secret,
    ),
  ).rejects.toMatchObject({ code: "QUOTE_CHANGED" });
  const market = await readMarket(runtime);
  const current = market.stocks.find((stock) => stock.symbol === held.symbol)!;
  const quote = await readOrderQuote(
    runtime,
    held.exchange,
    held.symbol,
    secret,
  );
  expect(quote.priceFils).toBe(current.priceFils);
  const input = { ...buy(1), quoteToken: quote.token };
  const result = await executeOrder(runtime, userId, input, schema, secret);
  expect(result.trade.priceFils).toBe(String(current.priceFils));
  expect(
    (await executeOrder(runtime, userId, input, schema, secret)).trade,
  ).toEqual(result.trade);
  expect(
    (
      await owner.trade.findUniqueOrThrow({
        where: { id: originalTrade.trade.id },
      })
    ).priceFils,
  ).toBe(BigInt(held.priceFils));
  await expect(
    runtime.simulatedQuote.create({
      data: {
        securityId: (await owner.security.findFirstOrThrow()).id,
        priceFils: 1n,
        previousCloseFils: 1n,
        volume: "1M",
        snapshotAt: new Date("2030-01-01"),
      },
    }),
  ).rejects.toThrow();
});
it("rolls back the complete market if the last security insert fails", async () => {
  const security = await owner.security.findUniqueOrThrow({
    where: { exchange_symbol: { exchange: "DFM", symbol: "SALIK" } },
  });
  const before = await readMarket(runtime);
  await admin.query(
    `CREATE FUNCTION "${schema}".fail_quote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."securityId" = '${security.id}' THEN RAISE EXCEPTION 'Injected failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    `CREATE TRIGGER fail_quote BEFORE INSERT ON "${schema}"."SimulatedQuote" FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_quote()`,
  );
  await expect(advanceMarket(owner, "2026-11-11", schema)).rejects.toThrow();
  expect(await owner.simulatedQuote.count()).toBe(16);
  expect(await readMarket(runtime)).toEqual(before);
  await admin.query(`DROP TRIGGER fail_quote ON "${schema}"."SimulatedQuote"`);
  expect((await advanceMarket(owner, undefined, schema)).date).toBe(
    "2026-11-11",
  );
}, 120000);
it("skips weekends, rejects date gaps, and permits trades racing with an atomic publication", async () => {
  await expect(advanceMarket(owner, "2026-11-14", schema)).rejects.toThrow(
    "Monday to Friday",
  );
  await expect(advanceMarket(owner, "2026-11-13", schema)).rejects.toThrow(
    "one eligible weekday",
  );
  const before = await readMarket(runtime);
  const old = before.stocks.find(
    (stock) => stock.symbol === held.symbol,
  )!.priceFils;
  const [trade] = await Promise.all([
    executeOrder(runtime, userId, buy(1), schema, secret),
    advanceMarket(owner, undefined, schema),
  ]);
  const current = (await readMarket(runtime)).stocks.find(
    (stock) => stock.symbol === held.symbol,
  )!.priceFils;
  expect([String(old), String(current)]).toContain(trade.trade.priceFils);
  expect((await advanceMarket(owner, undefined, schema)).date).toBe(
    "2026-11-13",
  );
  expect((await advanceMarket(owner, undefined, schema)).date).toBe(
    "2026-11-16",
  );
  const market = await readMarket(runtime);
  expect(
    market.stocks.every(
      (stock) =>
        stock.history.map((point) => point.time).join(",") ===
        "2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13,2026-11-16",
    ),
  ).toBe(true);
}, 120000);
it("backfills all eight once under concurrent retries, preserving quotes, accounts, trades and current valuation", async () => {
  const quotes = await owner.simulatedQuote.findMany({
    orderBy: { id: "asc" },
  });
  const accounts = await owner.virtualAccount.findMany();
  const holdings = await owner.holding.findMany();
  const trades = await owner.trade.findMany();
  const valuation = await readAccount(runtime, userId);
  const currentQuote = await readOrderQuote(
    runtime,
    held.exchange,
    held.symbol,
    secret,
  );
  const results = await Promise.all([
    backfillMarket(owner, schema),
    backfillMarket(owner, schema),
  ]);
  expect(results.filter((result) => result.count > 0)).toHaveLength(1);
  expect(results.find((result) => result.count > 0)!.count).toBeGreaterThan(
    900,
  );
  expect(
    await owner.simulatedQuote.findMany({
      where: { id: { in: quotes.map((q) => q.id) } },
      orderBy: { id: "asc" },
    }),
  ).toEqual(quotes);
  expect(await owner.virtualAccount.findMany()).toEqual(accounts);
  expect(await owner.holding.findMany()).toEqual(holdings);
  expect(await owner.trade.findMany()).toEqual(trades);
  expect(await readAccount(runtime, userId)).toEqual(valuation);
  expect(
    (await readOrderQuote(runtime, held.exchange, held.symbol, secret))
      .priceFils,
  ).toBe(currentQuote.priceFils);
  expect((await backfillMarket(owner, schema)).count).toBe(0);
  const market = await readMarket(runtime);
  const identities = await owner.security.findMany();
  for (const stock of market.stocks) {
    expect(stock.history.length).toBeGreaterThan(120);
    const counts = [30, 90, 180].map((days) => {
      const start = new Date(
        new Date(`${stock.sessionDate}T00:00:00Z`).getTime() -
          (days - 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      return stock.history.filter((point) => point.time >= start).length;
    });
    expect(counts[0]).toBeGreaterThan(15);
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    const identity = identities.find(
      (s) => s.symbol === stock.symbol && s.exchange === stock.exchange,
    )!;
    const anchor = quotes
      .filter((q) => q.securityId === identity.id)
      .sort((a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime())[0];
    const preceding = stock.history
      .filter(
        (point) => point.time < anchor.snapshotAt.toISOString().slice(0, 10),
      )
      .at(-1)!;
    expect(preceding.priceFils).toBe(Number(anchor.previousCloseFils));
  }
}, 120000);
it("rolls back a failed scheduled catch-up batch completely", async () => {
  const count = await owner.simulatedQuote.count();
  await admin.query(
    `CREATE FUNCTION "${schema}".fail_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."snapshotAt" >= '2026-11-18' THEN RAISE EXCEPTION 'Injected failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    `CREATE TRIGGER fail_sync BEFORE INSERT ON "${schema}"."SimulatedQuote" FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_sync()`,
  );
  try {
    await expect(
      syncMarket(owner, new Date("2026-11-20T12:00:00Z"), new Set(), schema),
    ).rejects.toThrow();
    expect(await owner.simulatedQuote.count()).toBe(count);
    expect((await readMarket(runtime)).sessionDate).toBe("2026-11-16");
  } finally {
    await admin.query(`DROP TRIGGER fail_sync ON "${schema}"."SimulatedQuote"`);
  }
}, 120000);
it("catches up missed sessions exactly once under concurrent scheduled requests, skipping closures and preserving financial records", async () => {
  const accounts = await owner.virtualAccount.findMany();
  const holdings = await owner.holding.findMany();
  const trades = await owner.trade.findMany();
  const before = await owner.simulatedQuote.findMany({
    orderBy: { id: "asc" },
  });
  const closures = closedDates("2026-11-19,2026-11-20");
  const now = new Date("2026-11-23T12:00:00Z");
  await admin.query(
    `GRANT INSERT ON "${schema}"."SimulatedQuote" TO tradesim_runtime`,
  );
  try {
    const results = await Promise.all([
      syncMarket(runtime, now, closures, schema),
      syncMarket(runtime, now, closures, schema),
    ]);
    expect(results.map((r) => r.sessionsPublished).sort()).toEqual([0, 3]);
    expect(
      results.every(
        (r) => r.latestSession === "2026-11-23" && !r.moreSessionsPending,
      ),
    ).toBe(true);
    expect(await owner.simulatedQuote.count()).toBe(before.length + 24);
    expect(
      await owner.simulatedQuote.findMany({
        where: { id: { in: before.map((q) => q.id) } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
    expect(await owner.virtualAccount.findMany()).toEqual(accounts);
    expect(await owner.holding.findMany()).toEqual(holdings);
    expect(await owner.trade.findMany()).toEqual(trades);
    const market = await readMarket(runtime);
    for (const stock of market.stocks) {
      const points = stock.history.filter((p) => p.time > "2026-11-16");
      expect(points.map((p) => p.time)).toEqual([
        "2026-11-17",
        "2026-11-18",
        "2026-11-23",
      ]);
      let price = BigInt(
        stock.history.find((p) => p.time === "2026-11-16")!.priceFils,
      );
      for (const point of points) {
        price = dailyPrice(price, point.time, stock).priceFils;
        expect(point.priceFils).toBe(Number(price));
      }
    }
    const account = await readAccount(runtime, userId);
    expect(account.portfolioValueFils).toBe(
      account.cashBalanceFils +
        account.holdings.reduce((sum, h) => sum + h.valueFils!, 0),
    );
    const quote = await readOrderQuote(
      runtime,
      held.exchange,
      held.symbol,
      secret,
    );
    expect(quote.priceFils).toBe(
      market.stocks.find((s) => s.symbol === held.symbol)!.priceFils,
    );
    expect(
      (await syncMarket(runtime, now, closures, schema)).quotesPublished,
    ).toBe(0);
  } finally {
    await admin.query(
      `REVOKE INSERT ON "${schema}"."SimulatedQuote" FROM tradesim_runtime`,
    );
  }
}, 120000);
it("never publishes future sessions and bounds long catch-ups for the function timeout", async () => {
  const count = await owner.simulatedQuote.count();
  const ahead = await syncMarket(
    owner,
    new Date("2026-11-20T12:00:00Z"),
    new Set(),
    schema,
  );
  expect(ahead.aheadOfClock).toBe(true);
  expect(ahead.quotesPublished).toBe(0);
  expect(await owner.simulatedQuote.count()).toBe(count);
  const result = await syncMarket(
    owner,
    new Date("2027-04-01T12:00:00Z"),
    new Set(),
    schema,
  );
  expect(result.sessionsPublished).toBe(MAX_CATCHUP_SESSIONS);
  expect(result.moreSessionsPending).toBe(true);
  expect(await owner.simulatedQuote.count()).toBe(
    count + MAX_CATCHUP_SESSIONS * 8,
  );
}, 120000);
