import nextEnv from "@next/env";
import pg from "pg";
import { readFileSync } from "node:fs";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Database check failed: DATABASE_URL is missing.");
  process.exit(1);
}
let client;
try {
  const url = new URL(connectionString);
  const certificatePath =
    process.env.DATABASE_CA_CERT_PATH || url.searchParams.get("sslrootcert");
  const ca =
    process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n") ||
    (certificatePath ? readFileSync(certificatePath, "utf8") : undefined);
  // pg URL SSL parameters override explicit options. Apply a single verified TLS
  // configuration instead, including hostname verification and the supplied CA.
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  client = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  });
  await client.connect();
  const result = await client.query(
    "SELECT 1 AS connected, has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema",
  );
  console.log(
    JSON.stringify({
      connected: result.rows[0].connected === 1,
      canCreateSchema: result.rows[0].can_create_schema,
    }),
  );
} catch (error) {
  // Driver messages can contain hostnames and credentials; report only known codes.
  const allowed = [
    "28P01",
    "42501",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ENOENT",
    "EACCES",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ];
  console.error(
    "Database connectivity check failed. Code: " +
      (allowed.includes(error.code) ? error.code : "CONNECTION_FAILED"),
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
