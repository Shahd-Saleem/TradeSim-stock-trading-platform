import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolConfig } from "pg";

export function databaseConfig(
  connectionString = process.env.DATABASE_URL,
): PoolConfig {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const url = new URL(connectionString);
  const certificatePath =
    process.env.DATABASE_CA_CERT_PATH || url.searchParams.get("sslrootcert");
  const ca =
    process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n") ||
    (certificatePath
      ? readFileSync(resolve(certificatePath), "utf8")
      : undefined);
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
    "schema",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };
}

/** Prisma CLI uses the Rust migration engine; require full certificate/hostname verification there too. */
export function migrationUrl() {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL or DIRECT_URL is required");
  const url = new URL(raw);
  if (url.port === "6543")
    throw new Error(
      "Migrations require a direct or session-pooler URL in DIRECT_URL",
    );
  url.searchParams.set("schema", "tradesim");
  url.searchParams.set("sslmode", "verify-full");
  const certificatePath = process.env.DATABASE_CA_CERT_PATH;
  if (certificatePath)
    url.searchParams.set("sslrootcert", resolve(certificatePath));
  return url.toString();
}
