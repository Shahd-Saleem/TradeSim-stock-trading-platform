import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import pg from "pg";

// This helper never loads .env.local. Every connection must point at the CI DB.
const container = process.env.CI_POSTGRES_CONTAINER;
const certificate = process.env.DATABASE_CA_CERT_PATH;
function connection(name, username) {
  const url = new URL(process.env[name] || "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/tradesim_ci" ||
    url.username !== username
  )
    throw new Error("CI requires explicit loopback test-database connections");
  return url;
}
function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8" });
  if (result.error || result.status !== 0)
    throw new Error("CI PostgreSQL setup command failed");
  return result.stdout;
}

let client;
try {
  if (
    process.env.CI !== "true" ||
    !container ||
    !/^[a-zA-Z0-9_.-]+$/.test(container) ||
    !certificate
  )
    throw new Error("Explicit CI service configuration required");
  const owner = connection("TEST_DATABASE_URL", "postgres");
  const runtime = connection("TEST_RUNTIME_DATABASE_URL", "tradesim_runtime");
  if (
    connection("DIRECT_URL", "postgres").href !== owner.href ||
    connection("DATABASE_URL", "tradesim_runtime").href !== runtime.href ||
    owner.host !== runtime.host ||
    runtime.password !== "ci_runtime_only"
  )
    throw new Error("CI connections must use the same disposable service");
  const [service] = JSON.parse(command("docker", ["inspect", container]));
  if (!service.Config.Env.includes("POSTGRES_DB=tradesim_ci"))
    throw new Error("Refusing to configure a non-CI container");

  mkdirSync(dirname(certificate), { recursive: true });
  const key = join(dirname(certificate), "server.key");
  command(process.env.CI_OPENSSL_BIN || "openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-noenc",
    "-days",
    "1",
    "-keyout",
    key,
    "-out",
    certificate,
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
  ]);
  command("docker", ["cp", certificate, `${container}:/tmp/tradesim-ci.crt`]);
  command("docker", ["cp", key, `${container}:/tmp/tradesim-ci.key`]);
  command("docker", [
    "exec",
    "--user",
    "root",
    container,
    "chown",
    "postgres:postgres",
    "/tmp/tradesim-ci.crt",
    "/tmp/tradesim-ci.key",
  ]);
  command("docker", [
    "exec",
    "--user",
    "root",
    container,
    "chmod",
    "600",
    "/tmp/tradesim-ci.key",
  ]);
  for (const sql of [
    "ALTER SYSTEM SET ssl_cert_file = '/tmp/tradesim-ci.crt'",
    "ALTER SYSTEM SET ssl_key_file = '/tmp/tradesim-ci.key'",
    "ALTER SYSTEM SET ssl = 'on'",
    "SELECT pg_reload_conf()",
  ])
    command("docker", [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "tradesim_ci",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ]);

  // Reload is asynchronous; retry verified connections, never disable TLS.
  for (let attempt = 0; attempt < 10; attempt++) {
    client = new pg.Client({
      connectionString: owner.href,
      ssl: { rejectUnauthorized: true, ca: readFileSync(certificate, "utf8") },
      connectionTimeoutMillis: 3000,
    });
    try {
      await client.connect();
      break;
    } catch {
      await client.end().catch(() => {});
      client = undefined;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!client) throw new Error("Verified CI TLS connection failed");
  await client.query(
    "CREATE ROLE tradesim_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'ci_runtime_only'",
  );
  console.log("Disposable PostgreSQL TLS and restricted test role configured.");
} catch {
  console.error(
    "CI database setup failed. Check the disposable service, OpenSSL and explicit CI environment; no connection details logged.",
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
