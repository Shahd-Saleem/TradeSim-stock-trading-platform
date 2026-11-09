import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
const file = ".env.local";
let content = readFileSync(file, "utf8");
const env = parse(content);
function set(key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  content = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content}\n${line}\n`;
}
if (
  !env.BETTER_AUTH_SECRET ||
  env.BETTER_AUTH_SECRET.startsWith("REPLACE_") ||
  env.BETTER_AUTH_SECRET.length < 32
)
  set("BETTER_AUTH_SECRET", randomBytes(48).toString("base64url"));
if (!env.BETTER_AUTH_URL) set("BETTER_AUTH_URL", "http://localhost:3000");
writeFileSync(file, content);
console.log(
  "Local authentication environment configured. No secrets displayed.",
);
