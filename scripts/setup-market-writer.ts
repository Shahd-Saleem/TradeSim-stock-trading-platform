import nextEnv from "@next/env";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { databaseConfig } from "../src/lib/database-config";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const role = "tradesim_market_writer";
let client: pg.Client | undefined;
try {
  if (!process.env.DIRECT_URL)
    throw new Error("Administrative connection required");
  client = new pg.Client(databaseConfig(process.env.DIRECT_URL));
  const content = readFileSync(".env.local", "utf8");
  const url = new URL(process.env.DATABASE_URL!);
  if (!url.hostname.endsWith(".pooler.supabase.com"))
    throw new Error("Supabase pooler configuration required");
  await client.connect();
  if (
    (await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
      .rowCount
  ) {
    console.log(
      "Market writer role already exists. Use its saved private credentials; no role or password was changed.",
    );
  } else {
    const password = randomBytes(48).toString("hex");
    const username = decodeURIComponent(url.username).split(".");
    url.username = [role, ...username.slice(1)].join(".");
    url.password = password;
    url.port = "6543";
    await client.query("BEGIN");
    await client.query(
      `CREATE ROLE ${role} LOGIN NOINHERIT PASSWORD '${password}'`,
    );
    await client.query(`GRANT USAGE ON SCHEMA tradesim TO ${role}`);
    await client.query(
      `GRANT SELECT ON tradesim."Security", tradesim."SimulatedQuote" TO ${role}`,
    );
    await client.query(`GRANT INSERT ON tradesim."SimulatedQuote" TO ${role}`);
    await client.query("COMMIT");
    const line = `MARKET_DATABASE_URL=${JSON.stringify(url.toString())}`;
    const updated = /^MARKET_DATABASE_URL=.*$/m.test(content)
      ? content.replace(/^MARKET_DATABASE_URL=.*$/m, () => line)
      : `${content}\n${line}\n`;
    writeFileSync(".env.local", updated);
    console.log(
      "Created quote-only writer and saved MARKET_DATABASE_URL privately in .env.local. No financial records changed.",
    );
  }
} catch {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(
    "Writer setup failed; credentials withheld. Check local administrative permissions and .env.local. If the role exists without saved credentials, rotate its password manually.",
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
