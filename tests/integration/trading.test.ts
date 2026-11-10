import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { databaseConfig } from "@/lib/database-config";
import { createPrisma } from "@/lib/prisma-client";
import { createAuth } from "@/lib/auth-core";
import { createOrderHttp } from "@/lib/order-http";
import { executeOrder } from "@/lib/order-service";
import type { OrderInput } from "@/lib/trading";
import { readOrderQuote } from "@/lib/order-quote";
import { orderQuoteResponse } from "@/lib/order-quote-http";
import { readAccount } from "@/lib/account-service";

config({ path: ".env.local", quiet: true });
const quoteSecret = process.env.BETTER_AUTH_SECRET!;
const schema = `tradesim_test_${randomBytes(12).toString("hex")}`;
const baseURL = "http://localhost:3000";
let admin: pg.Client;
let owner: ReturnType<typeof createPrisma>;
let db: ReturnType<typeof createPrisma>;
let http: ReturnType<typeof createOrderHttp>;
let auth: ReturnType<typeof createAuth>;
let cookie = "";
let alice: string;
let bob: string;
let created = false;
const order = (side: "BUY" | "SELL", quantity: number): OrderInput => ({
  exchange: "DFM",
  symbol: "EMAAR",
  side,
  quantity,
  idempotencyKey: randomUUID(),
});
const account = (userId: string) =>
  db.virtualAccount.findUniqueOrThrow({
    where: { userId },
    include: { holdings: true, trades: true },
  });
const execute = (input: OrderInput, user = alice) =>
  executeOrder(db, user, input, schema);
const post = (body: unknown, session = cookie, origin = baseURL) =>
  http.POST(
    new Request(`${baseURL}/api/orders`, {
      method: "POST",
      headers: { origin, cookie: session, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

it("serves authenticated quotes and rejects expired, tampered or changed quotes without mutating accounts", async () => {
  const url = `${baseURL}/api/orders/quote?exchange=DFM&symbol=EMAAR`;
  expect(
    (await orderQuoteResponse(auth, db, new Request(url), quoteSecret)).status,
  ).toBe(401);
  const quoteResponse = await orderQuoteResponse(
    auth,
    db,
    new Request(url, { headers: { cookie } }),
    quoteSecret,
  );
  expect(quoteResponse.status).toBe(200);
  expect(quoteResponse.headers.get("Cache-Control")).toContain("no-store");
  const quote = await quoteResponse.json();
  const before = await account(alice);
  const invalid = await post({
    ...order("BUY", 1),
    quoteToken: `${quote.token}x`,
  });
  expect(invalid.status).toBe(409);
  let expiredToken: string;
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() - 360000);
  try {
    expiredToken = (await readOrderQuote(db, "DFM", "EMAAR", quoteSecret))
      .token;
  } finally {
    clock.mockRestore();
  }
  expect(
    (await post({ ...order("BUY", 1), quoteToken: expiredToken! })).status,
  ).toBe(409);
  const security = await owner.security.findFirstOrThrow({
    where: { symbol: "EMAAR" },
  });
  await owner.simulatedQuote.create({
    data: {
      securityId: security.id,
      priceFils: 99n,
      previousCloseFils: 100n,
      volume: "1M",
      snapshotAt: new Date("2026-11-08"),
    },
  });
  // Editing the current quote in place must also invalidate the preview.
  const latest = await owner.simulatedQuote.findFirstOrThrow({
    where: { securityId: security.id },
    orderBy: { snapshotAt: "desc" },
  });
  await owner.simulatedQuote.update({
    where: { id: latest.id },
    data: { priceFils: latest.priceFils + 1n },
  });
  expect(
    (await post({ ...order("BUY", 1), quoteToken: quote.token })).status,
  ).toBe(409);
  expect(await account(alice)).toEqual(before);
  await owner.simulatedQuote.update({
    where: { id: latest.id },
    data: { priceFils: latest.priceFils },
  });
  const input = { ...order("BUY", 1), quoteToken: quote.token };
  expect((await post(input)).status).toBe(201);
  await owner.simulatedQuote.update({
    where: { id: latest.id },
    data: { priceFils: latest.priceFils + 1n },
  });
  expect((await post(input)).status).toBe(200);
  await owner.simulatedQuote.update({
    where: { id: latest.id },
    data: { priceFils: latest.priceFils },
  });
  await execute(order("SELL", 1));
});

it("persists exact portfolio analytics through weighted buys, partial sales, missing quotes and closure", async () => {
  const userId = randomUUID();
  await owner.user.create({
    data: { id: userId, name: "Analytics", email: `${userId}@example.test` },
  });
  const security = await owner.security.create({
    data: {
      symbol: "ANALYTICS",
      exchange: "DFM",
      name: "Analytics test",
      sector: "Test",
      color: "#fff",
    },
  });
  const setPrice = (price: bigint, date: string) =>
    owner.simulatedQuote.create({
      data: {
        securityId: security.id,
        priceFils: price,
        previousCloseFils: 100n,
        volume: "1M",
        snapshotAt: new Date(date),
      },
    });
  const trade = (side: "BUY" | "SELL", quantity: number) =>
    execute({ ...order(side, quantity), symbol: "ANALYTICS" }, userId);
  const otherBefore = await readAccount(db, alice);
  expect((await readAccount(db, userId)).portfolioValueFils).toBe(10000000);
  await setPrice(100n, "2026-11-09");
  await trade("BUY", 3);
  expect((await readAccount(db, userId)).profitLossFils).toBe(0);
  await setPrice(101n, "2026-11-10");
  await trade("BUY", 2);
  await setPrice(150n, "2026-11-11");
  await trade("SELL", 2);
  const saved = await readAccount(db, userId);
  expect(saved).toMatchObject({
    cashBalanceFils: 9999798,
    portfolioValueFils: 10000248,
    realizedProfitLossFils: 100,
    unrealizedProfitLossFils: 148,
    profitLossFils: 248,
  });
  expect(saved.holdings[0]).toMatchObject({
    quantity: 3,
    averagePriceFils: 101,
    costBasisFils: 302,
    priceFils: 150,
    valueFils: 450,
    estimatedSaleProceedsFils: 450,
    estimatedSaleProfitLossFils: 148,
  });
  const refreshed = createPrisma(
    process.env.TEST_RUNTIME_DATABASE_URL || process.env.DATABASE_URL,
    schema,
  );
  try {
    expect(await readAccount(refreshed, userId)).toEqual(saved);
  } finally {
    await refreshed.$disconnect();
  }
  await owner.simulatedQuote.deleteMany({ where: { securityId: security.id } });
  expect(await readAccount(db, userId)).toMatchObject({
    valuationComplete: false,
    portfolioValueFils: null,
    profitLossFils: null,
    realizedProfitLossFils: 100,
    unrealizedProfitLossFils: null,
  });
  await setPrice(140n, "2026-11-12");
  await trade("SELL", 3);
  expect(await readAccount(db, userId)).toMatchObject({
    portfolioValueFils: 10000218,
    profitLossFils: 218,
    realizedProfitLossFils: 218,
    unrealizedProfitLossFils: 0,
    holdings: [],
  });
  expect(await readAccount(db, alice)).toEqual(otherBefore);
  await expect(readAccount(db, randomUUID())).rejects.toThrow(
    "Virtual account unavailable",
  );
}, 120000);

it("aggregates the full ledger beyond the 100 displayed trades", async () => {
  const userId = randomUUID();
  await owner.user.create({
    data: { id: userId, name: "Long ledger", email: `${userId}@example.test` },
  });
  const security = await owner.security.create({
    data: {
      symbol: "BULK",
      exchange: "ADX",
      name: "Ledger test",
      sector: "Test",
      color: "#fff",
      quotes: {
        create: {
          priceFils: 110n,
          previousCloseFils: 100n,
          volume: "1M",
          snapshotAt: new Date("2026-11-09"),
        },
      },
    },
  });
  const virtual = await account(userId);
  await owner.$transaction(async (tx) => {
    await tx.trade.createMany({
      data: Array.from({ length: 110 }, () => ({
        accountId: virtual.id,
        securityId: security.id,
        side: "BUY",
        quantity: 1n,
        priceFils: 100n,
        totalValueFils: 100n,
        idempotencyKey: randomUUID(),
      })),
    });
    await tx.holding.create({
      data: {
        accountId: virtual.id,
        securityId: security.id,
        quantity: 110n,
        costBasisFils: 11000n,
      },
    });
    await tx.virtualAccount.update({
      where: { id: virtual.id },
      data: { cashBalanceFils: 9989000n },
    });
  });
  await execute(
    { ...order("SELL", 10), symbol: "BULK", exchange: "ADX" },
    userId,
  );
  const result = await readAccount(db, userId);
  expect(result.trades).toHaveLength(100);
  expect(result).toMatchObject({
    portfolioValueFils: 10001100,
    realizedProfitLossFils: 100,
    unrealizedProfitLossFils: 1000,
    profitLossFils: 1100,
    cashAdjustmentFils: 0,
  });
}, 120000);

it("requires a fresh confirmation after cash changes and preserves idempotent replay", async () => {
  const userId = randomUUID();
  await owner.user.create({
    data: { id: userId, name: "Confirmation", email: `${userId}@example.test` },
  });
  const input = {
    ...order("BUY", 1),
    expectedCashBalanceFils: "10000000",
    quoteToken: (await readOrderQuote(db, "DFM", "EMAAR", quoteSecret)).token,
  };
  const original = await execute(input, userId);
  const before = await account(userId);
  await expect(
    execute({ ...input, idempotencyKey: randomUUID() }, userId),
  ).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
  expect(await account(userId)).toEqual(before);
  expect((await execute(input, userId)).trade).toEqual(original.trade);
});

beforeAll(async () => {
  try {
    const connection =
      process.env.TEST_DATABASE_URL ||
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL;
    const runtime =
      process.env.TEST_RUNTIME_DATABASE_URL ||
      (process.env.TEST_DATABASE_URL ? undefined : process.env.DATABASE_URL);
    if (!runtime) throw new Error("Restricted test runtime required");
    admin = new pg.Client(databaseConfig(connection));
    await admin.connect();
    // Apply the complete migration chain, preserving the shared runtime role name.
    await admin.query("BEGIN");
    for (const directory of readdirSync("prisma/migrations")
      .filter((value) => /^\d/.test(value))
      .sort()) {
      const sql = readFileSync(
        `prisma/migrations/${directory}/migration.sql`,
        "utf8",
      )
        .replaceAll("tradesim_runtime", "RUNTIME_ROLE_PLACEHOLDER")
        .replaceAll("tradesim", schema)
        .replaceAll("RUNTIME_ROLE_PLACEHOLDER", "tradesim_runtime");
      await admin.query(sql);
    }
    await admin.query("COMMIT");
    created = true;
    await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO tradesim_runtime`);
    await admin.query(
      `GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO tradesim_runtime`,
    );
    await admin.query(
      `GRANT INSERT, UPDATE, DELETE ON "${schema}"."User", "${schema}"."Account", "${schema}"."Session", "${schema}"."RateLimit" TO tradesim_runtime`,
    );
    owner = createPrisma(connection, schema);
    db = createPrisma(runtime, schema);
    auth = createAuth(db, baseURL, randomBytes(48).toString("hex"));
    http = createOrderHttp(auth, db, baseURL, schema);
    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { origin: baseURL, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Trader",
          email: `${randomUUID()}@example.test`,
          password: randomBytes(24).toString("hex"),
        }),
      }),
    );
    expect(response.status).toBe(200);
    alice = (await response.json()).user.id;
    cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    bob = randomUUID();
    await owner.user.create({
      data: { id: bob, name: "Other", email: `${bob}@example.test` },
    });
    await owner.security.create({
      data: {
        symbol: "EMAAR",
        exchange: "DFM",
        name: "Emaar",
        sector: "Property",
        color: "#fff",
        quotes: {
          create: {
            priceFils: 100n,
            previousCloseFils: 100n,
            volume: "1M",
            snapshotAt: new Date("2026-11-09"),
          },
        },
      },
    });
  } catch {
    throw new Error(
      "Trading integration setup failed; connection details withheld.",
    );
  }
});
afterAll(async () => {
  await db?.$disconnect();
  await owner?.$disconnect();
  if (admin) {
    await admin.query("ROLLBACK").catch(() => {});
    if (created && /^tradesim_test_[a-f0-9]{24}$/.test(schema))
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});

it("authenticates orders, rejects identity/price injection and protects history", async () => {
  expect((await post(order("BUY", 1), "")).status).toBe(401);
  expect(
    (await post(order("BUY", 1), "better-auth.session_token=forged")).status,
  ).toBe(401);
  expect(
    (await post(order("BUY", 1), cookie, "https://evil.invalid")).status,
  ).toBe(403);
  expect(
    (await post({ ...order("BUY", 1), userId: bob, priceFils: 1 })).status,
  ).toBe(400);
  expect((await http.GET(new Request(`${baseURL}/api/orders`))).status).toBe(
    401,
  );
});
it("executes at server quotes and persists cash, weighted basis and immutable history", async () => {
  const response = await post(order("BUY", 3));
  expect(response.status).toBe(201);
  expect((await response.json()).trade.priceFils).toBe("100");
  let saved = await account(alice);
  expect(saved.cashBalanceFils).toBe(9999700n);
  expect(saved.holdings[0].costBasisFils).toBe(300n);
  const security = await owner.security.findFirstOrThrow({
    where: { symbol: "EMAAR" },
  });
  await owner.simulatedQuote.create({
    data: {
      securityId: security.id,
      priceFils: 101n,
      previousCloseFils: 100n,
      volume: "1M",
      snapshotAt: new Date("2026-11-10"),
    },
  });
  await execute(order("BUY", 2));
  await execute(order("SELL", 2));
  saved = await account(alice);
  expect(saved.cashBalanceFils).toBe(9999700n);
  expect(saved.holdings[0].quantity).toBe(3n);
  expect(saved.holdings[0].costBasisFils).toBe(302n);
  await expect(
    db.trade.delete({ where: { id: saved.trades[0].id } }),
  ).rejects.toThrow();
  await expect(
    owner.trade.update({
      where: { id: saved.trades[0].id },
      data: { idempotencyKey: randomUUID() },
    }),
  ).rejects.toThrow();
  await execute(order("SELL", 3));
  expect((await account(alice)).holdings).toHaveLength(0);
});
it("rejects insufficient cash, shares, unsupported securities and invalid quantities without writes", async () => {
  const before = await account(alice);
  await expect(execute(order("BUY", 1000000))).rejects.toMatchObject({
    code: "INSUFFICIENT_FUNDS",
  });
  await expect(execute(order("SELL", 1))).rejects.toMatchObject({
    code: "INSUFFICIENT_SHARES",
  });
  await expect(
    execute({ ...order("BUY", 1), symbol: "UNKNOWN" }),
  ).rejects.toMatchObject({ code: "UNSUPPORTED_SECURITY" });
  for (const quantity of [0, -1, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1])
    expect((await post({ ...order("BUY", 1), quantity })).status).toBe(400);
  expect(await account(alice)).toEqual(before);
});
it("serializes concurrent buys and sells to prevent overspending and overselling", async () => {
  const buys = await Promise.allSettled([
    execute(order("BUY", 60000)),
    execute(order("BUY", 60000)),
  ]);
  expect(buys.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  expect(
    (buys.find((value) => value.status === "rejected") as PromiseRejectedResult)
      .reason.code,
  ).toBe("INSUFFICIENT_FUNDS");
  const sells = await Promise.allSettled([
    execute(order("SELL", 40000)),
    execute(order("SELL", 40000)),
  ]);
  expect(sells.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      sells.find(
        (value) => value.status === "rejected",
      ) as PromiseRejectedResult
    ).reason.code,
  ).toBe("INSUFFICIENT_SHARES");
  expect((await account(alice)).holdings[0].quantity).toBe(20000n);
});
it("replays concurrent duplicates exactly once, conflicts on altered payload and isolates key namespaces", async () => {
  const input = order("BUY", 1);
  const before = await account(alice);
  const outcomes = await Promise.all(
    Array.from({ length: 5 }, () => execute(input)),
  );
  expect(new Set(outcomes.map((value) => value.trade.id)).size).toBe(1);
  expect(outcomes.filter((value) => !value.replayed)).toHaveLength(1);
  expect((await account(alice)).cashBalanceFils).toBe(
    before.cashBalanceFils - 101n,
  );
  await expect(execute({ ...input, quantity: 2 })).rejects.toMatchObject({
    code: "IDEMPOTENCY_CONFLICT",
  });
  expect((await post(input)).status).toBe(200);
  const bobTrade = await execute(input, bob);
  expect(bobTrade.trade.id).not.toBe(outcomes[0].trade.id);
  const history = await http.GET(
    new Request(`${baseURL}/api/orders?userId=${bob}`, {
      headers: { cookie, "x-user-id": bob },
    }),
  );
  expect(
    (await history.json()).trades.some(
      (trade: { id: string }) => trade.id === bobTrade.trade.id,
    ),
  ).toBe(false);
});
it("rolls cash and holding changes back when the final history insert fails", async () => {
  const input = order("BUY", 7);
  const before = await account(alice);
  // Test-only failure after cash and holdings have been written inside the transaction.
  await admin.query(
    `CREATE FUNCTION "${schema}".fail_test_trade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."idempotencyKey" = '${input.idempotencyKey}' THEN RAISE EXCEPTION 'Injected test failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    `CREATE TRIGGER fail_test_trade BEFORE INSERT ON "${schema}"."Trade" FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_test_trade()`,
  );
  expect((await post(input)).status).toBe(503);
  expect(await account(alice)).toEqual(before);
  await admin.query(`DROP TRIGGER fail_test_trade ON "${schema}"."Trade"`);
  expect((await post(input)).status).toBe(201);
});

it("replays the original receipt after a quote change and supports ADX orders", async () => {
  const input = order("BUY", 1);
  const original = await execute(input);
  const security = await owner.security.findFirstOrThrow({
    where: { symbol: "EMAAR" },
  });
  await owner.simulatedQuote.create({
    data: {
      securityId: security.id,
      priceFils: 200n,
      previousCloseFils: 101n,
      volume: "1M",
      snapshotAt: new Date("2026-11-11"),
    },
  });
  expect((await execute(input)).trade).toEqual(original.trade);
  await owner.security.create({
    data: {
      symbol: "FAB",
      exchange: "ADX",
      name: "FAB",
      sector: "Banking",
      color: "#fff",
      quotes: {
        create: {
          priceFils: 1678n,
          previousCloseFils: 1678n,
          volume: "1M",
          snapshotAt: new Date("2026-11-09"),
        },
      },
    },
  });
  const before = await account(bob);
  const result = await execute(
    { ...order("BUY", 2), symbol: "FAB", exchange: "ADX" },
    bob,
  );
  expect(result.trade.totalValueFils).toBe("3356");
  expect((await account(bob)).cashBalanceFils).toBe(
    before.cashBalanceFils - 3356n,
  );
});

it("fails safely on missing quotes, oversized bodies, malformed JSON and incorrect media types", async () => {
  await owner.security.create({
    data: {
      symbol: "NOQUOTE",
      exchange: "DFM",
      name: "No quote",
      sector: "Test",
      color: "#fff",
    },
  });
  const before = await account(alice);
  const missing = await post({ ...order("BUY", 1), symbol: "NOQUOTE" });
  expect(missing.status).toBe(503);
  expect((await missing.json()).error.code).toBe("QUOTE_UNAVAILABLE");
  expect((await post({ padding: "x".repeat(9000) })).status).toBe(413);
  for (const [body, contentType, status] of [
    ["{", "application/json", 400],
    ["{}", "text/plain", 415],
  ] as const) {
    expect(
      (
        await http.POST(
          new Request(`${baseURL}/api/orders`, {
            method: "POST",
            headers: { origin: baseURL, cookie, "content-type": contentType },
            body,
          }),
        )
      ).status,
    ).toBe(status);
  }
  expect(await account(alice)).toEqual(before);
});
