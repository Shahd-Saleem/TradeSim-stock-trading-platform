import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
// Prisma logs database hostnames on deploy. Capture its output instead of leaking
// connection details (including on errors) into developer/CI logs.
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { encoding: "utf8", env: process.env },
);
if (result.status !== 0) {
  console.error(
    "Migration failed. Verify migration permissions, session-pooler connectivity and the configured CA certificate. No connection details logged.",
  );
  process.exit(1);
}
console.log("Prisma migrations applied successfully.");
