import nextEnv from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { databaseConfig } from "../src/lib/database-config";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const original = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!original) throw new Error("Database configuration required");
const role = "tradesim_runtime";
const current = new URL(process.env.DATABASE_URL!);
if (decodeURIComponent(current.username).split(".")[0] === role) {
  console.log("Restricted runtime credentials already configured.");
  process.exit(0);
}
const admin = new pg.Client(databaseConfig(original));
let runtime: pg.Client | undefined;
try {
  await admin.connect();
  const exists = await admin.query(
    "SELECT 1 FROM pg_roles WHERE rolname = $1",
    [role],
  );
  if (exists.rowCount)
    throw new Error(
      "Runtime role already exists; manual credential setup required",
    );
  const password = randomBytes(48).toString("hex");
  await admin.query(
    `CREATE ROLE ${role} LOGIN NOINHERIT PASSWORD '${password}'`,
  );
  await admin.query(`GRANT USAGE ON SCHEMA tradesim TO ${role}`);
  await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA tradesim TO ${role}`);
  await admin.query(
    `GRANT INSERT, UPDATE, DELETE ON tradesim."User", tradesim."Account", tradesim."Session", tradesim."Verification", tradesim."RateLimit", tradesim."AuthThrottle", tradesim."Watchlist" TO ${role}`,
  );
  const url = new URL(original);
  const username = decodeURIComponent(url.username).split(".");
  url.username = [role, ...username.slice(1)].join(".");
  url.password = password;
  runtime = new pg.Client(databaseConfig(url.toString()));
  await runtime.connect();
  const permissions = await runtime.query(
    `SELECT has_table_privilege(current_user, 'tradesim."VirtualAccount"', 'SELECT') AS can_read, has_table_privilege(current_user, 'tradesim."VirtualAccount"', 'UPDATE') AS can_write`,
  );
  if (!permissions.rows[0].can_read || permissions.rows[0].can_write)
    throw new Error("Runtime permission verification failed");
  const file = ".env.local";
  let content = readFileSync(file, "utf8");
  const set = (key: string, value: string) => {
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : `${content}\n${line}\n`;
  };
  set("DIRECT_URL", original);
  set("DATABASE_URL", url.toString());
  writeFileSync(file, content);
  console.log(
    "Restricted runtime role verified. Runtime and migration credentials stored separately in ignored .env.local; no values logged.",
  );
} catch {
  console.error(
    "Runtime role setup failed. Manual role/credential review required; no credentials logged.",
  );
  process.exitCode = 1;
} finally {
  await runtime?.end();
  await admin.end();
}
