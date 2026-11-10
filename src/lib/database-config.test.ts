import { afterEach, expect, it, vi } from "vitest";
import { databaseConfig, migrationUrl } from "./database-config";
afterEach(() => vi.unstubAllEnvs());
const connection =
  "postgresql://example:example@db.example.test:6543/postgres?sslmode=no-verify&schema=tradesim";
it("accepts an inline deployment CA without reading a missing local file and always verifies TLS", () => {
  vi.stubEnv(
    "DATABASE_CA_CERT",
    "-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----",
  );
  vi.stubEnv("DATABASE_CA_CERT_PATH", "missing-file.crt");
  const config = databaseConfig(connection);
  expect(config.ssl).toEqual({
    rejectUnauthorized: true,
    ca: "-----BEGIN CERTIFICATE-----\nexample\n-----END CERTIFICATE-----",
  });
  expect(config.connectionString).not.toContain("sslmode");
  expect(config.connectionString).not.toContain("schema=");
  expect(config.max).toBe(5);
});
it("uses system trust when no custom CA is configured, without permitting insecure URL options", () => {
  vi.stubEnv("DATABASE_CA_CERT", "");
  vi.stubEnv("DATABASE_CA_CERT_PATH", "");
  expect(databaseConfig(connection).ssl).toEqual({ rejectUnauthorized: true });
});
it("fails closed when a configured local certificate is missing", () => {
  vi.stubEnv("DATABASE_CA_CERT", "");
  vi.stubEnv("DATABASE_CA_CERT_PATH", "missing-file.crt");
  expect(() => databaseConfig(connection)).toThrow();
});
it("continues rejecting transaction-pooler connections for migrations", () => {
  vi.stubEnv("DIRECT_URL", connection);
  expect(() => migrationUrl()).toThrow("Migrations require");
});
