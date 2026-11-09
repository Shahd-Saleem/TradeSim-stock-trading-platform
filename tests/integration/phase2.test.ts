import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { databaseConfig } from "@/lib/database-config";
import { createPrisma } from "@/lib/prisma-client";
import { createAuth } from "@/lib/auth-core";
import { readAccount } from "@/lib/account-service";
import { accountResponse } from "@/lib/account-http";
import { consumeAuthAttempt } from "@/lib/auth-throttle";
import { createAuthHttp } from "@/lib/auth-http";

config({ path: ".env.local", quiet: true });
const suffix = randomBytes(12).toString("hex");
const schema = `tradesim_test_${suffix}`;
const baseURL = "http://localhost:3000";
const password = randomBytes(24).toString("base64url");
const email = `alice-${suffix}@example.test`;
const runtimeConnection =
  process.env.TEST_RUNTIME_DATABASE_URL ||
  (process.env.TEST_DATABASE_URL ? undefined : process.env.DATABASE_URL);
let admin: pg.Client;
let db: ReturnType<typeof createPrisma>;
let ownerDb: ReturnType<typeof createPrisma>;
let auth: ReturnType<typeof createAuth>;
let http: ReturnType<typeof createAuthHttp>;
let aliceCookie: string;
let bobCookie: string;
let userId: string;
let created = false;
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
function request(
  path: string,
  body: object,
  sessionCookie = "",
  origin = baseURL,
) {
  return http.POST(
    new Request(`${baseURL}/api/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: sessionCookie,
      },
      body: JSON.stringify(body),
    }),
  );
}
function headers(sessionCookie: string) {
  return new Headers({ Cookie: sessionCookie });
}

beforeAll(async () => {
  try {
    const connection =
      process.env.TEST_DATABASE_URL ||
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL;
    admin = new pg.Client(databaseConfig(connection));
    await admin.connect();
    const migration = readFileSync(
      "prisma/migrations/20261110000100_phase2/migration.sql",
      "utf8",
    ).replaceAll("tradesim", schema);
    await admin.query("BEGIN");
    await admin.query(migration);
    await admin.query("COMMIT");
    created = true;
    await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO tradesim_runtime`);
    await admin.query(
      `GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO tradesim_runtime`,
    );
    await admin.query(
      `GRANT INSERT, UPDATE, DELETE ON "${schema}"."User", "${schema}"."Account", "${schema}"."Session", "${schema}"."Verification", "${schema}"."RateLimit", "${schema}"."AuthThrottle", "${schema}"."Watchlist" TO tradesim_runtime`,
    );
    ownerDb = createPrisma(connection, schema);
    if (!runtimeConnection)
      throw new Error("Test runtime database URL required");
    db = createPrisma(runtimeConnection, schema);
    const secret = randomBytes(48).toString("base64url");
    auth = createAuth(db, baseURL, secret);
    http = createAuthHttp(auth, db, baseURL, secret, schema);
    const alice = await request("sign-up/email", {
      name: "Alice",
      email,
      password,
    });
    expect(alice.status).toBe(200);
    aliceCookie = cookie(alice);
    userId = (await alice.json()).user.id;
    const bob = await request("sign-up/email", {
      name: "Bob",
      email: `bob-${suffix}@example.test`,
      password,
    });
    expect(bob.status).toBe(200);
    bobCookie = cookie(bob);
  } catch {
    throw new Error(
      "Isolated PostgreSQL/auth integration setup failed. No connection details logged.",
    );
  }
});
afterAll(async () => {
  await db?.$disconnect();
  await ownerDb?.$disconnect();
  if (admin) {
    await admin.query("ROLLBACK").catch(() => {});
    // Only the random schema created by this test run may be removed.
    if (created && /^tradesim_test_[a-f0-9]{24}$/.test(schema))
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});

describe("Phase 2 verified-TLS PostgreSQL integration", () => {
  it("atomically provisions exactly AED 100,000 and stores a password hash", async () => {
    const account = await db.virtualAccount.findUniqueOrThrow({
      where: { userId },
    });
    expect(account.cashBalanceFils).toBe(10000000n);
    expect(account.startingCapitalFils).toBe(10000000n);
    expect(account.currency).toBe("AED");
    const credential = await db.account.findFirstOrThrow({ where: { userId } });
    expect(credential.password).not.toBe(password);
    expect(credential.password?.length).toBeGreaterThan(64);
    expect(aliceCookie).toContain("session_token");
  });
  it("preserves a saved balance across reads, client recreation and re-login", async () => {
    await ownerDb.virtualAccount.update({
      where: { userId },
      data: { cashBalanceFils: 9876543n },
    });
    const refreshed = createPrisma(runtimeConnection, schema);
    try {
      expect((await readAccount(refreshed, userId)).cashBalanceFils).toBe(
        9876543,
      );
    } finally {
      await refreshed.$disconnect();
    }
    const login = await request("sign-in/email", {
      email: email.toUpperCase(),
      password,
    });
    // Normalize the public form's email on the server path; Better Auth also handles casing.
    expect(login.status).toBe(200);
    const response = await accountResponse(auth, db, headers(cookie(login)));
    expect(response.status).toBe(200);
    expect((await response.json()).cashBalanceFils).toBe(9876543);
  });
  it("isolates different users and ignores client-supplied identity hints", async () => {
    const alice = await accountResponse(
      auth,
      db,
      new Headers({ Cookie: aliceCookie, "x-user-id": "someone-else" }),
    );
    const bob = await accountResponse(
      auth,
      db,
      new Headers({ Cookie: bobCookie, "x-user-id": userId }),
    );
    expect((await alice.json()).cashBalanceFils).toBe(9876543);
    const body = await bob.json();
    expect(body.cashBalanceFils).toBe(10000000);
    expect(body.user.name).toBe("Bob");
    expect(bob.headers.get("Cache-Control")).toContain("no-store");
  });
  it("rejects missing/tampered sessions, wrong passwords and untrusted origins", async () => {
    expect((await accountResponse(auth, db, new Headers())).status).toBe(401);
    expect(
      (
        await accountResponse(
          auth,
          db,
          headers("better-auth.session_token=tampered"),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request("sign-in/email", {
          email,
          password: "incorrect-password-1234",
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await request(
          "sign-in/email",
          { email, password },
          "",
          "https://evil.invalid",
        )
      ).status,
    ).toBe(403);
  });
  it("prevents duplicate accounts and never resets balances on repeated initialization", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        ownerDb.virtualAccount.upsert({
          where: { userId },
          create: { userId },
          update: {},
        }),
      ),
    );
    expect(await db.virtualAccount.count({ where: { userId } })).toBe(1);
    expect((await readAccount(db, userId)).cashBalanceFils).toBe(9876543);
    await expect(
      ownerDb.virtualAccount.create({ data: { userId } }),
    ).rejects.toThrow();
    await expect(
      ownerDb.virtualAccount.delete({ where: { userId } }),
    ).rejects.toThrow();
    await expect(
      ownerDb.virtualAccount.update({
        where: { userId },
        data: { cashBalanceFils: -1n },
      }),
    ).rejects.toThrow();
  });
  it("has an atomic durable limit on simultaneous authentication attempts", async () => {
    const before = await db.authThrottle.count();
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () =>
        consumeAuthAttempt(db, "throttle@example.test", "test-secret", schema),
      ),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(8);
    expect(await db.authThrottle.count()).toBe(before + 1);
  });
  it("denies financial writes to the runtime role and rolls back user/account creation together", async () => {
    await expect(
      db.virtualAccount.update({
        where: { userId },
        data: { cashBalanceFils: 1n },
      }),
    ).rejects.toThrow();
    const id = `rollback-${suffix}`;
    await expect(
      ownerDb.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id,
            name: "Rollback",
            email: `rollback-${suffix}@example.test`,
          },
        });
        throw new Error("Deliberate transaction rollback");
      }),
    ).rejects.toThrow("Deliberate transaction rollback");
    expect(await db.user.count({ where: { id } })).toBe(0);
    expect(await db.virtualAccount.count({ where: { userId: id } })).toBe(0);
  });
  it("rejects database-expired sessions even when the browser retains its cookie", async () => {
    await ownerDb.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(0) },
    });
    expect((await accountResponse(auth, db, headers(aliceCookie))).status).toBe(
      401,
    );
  });
  it("revokes the database session on logout", async () => {
    const response = await request("sign-out", {}, bobCookie);
    expect(response.status).toBe(200);
    expect((await accountResponse(auth, db, headers(bobCookie))).status).toBe(
      401,
    );
  });
});
