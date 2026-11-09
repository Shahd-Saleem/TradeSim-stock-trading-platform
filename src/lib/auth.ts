import "server-only";
import { db } from "./db";
import { createAuth } from "./auth-core";
export const auth = createAuth(
  db,
  process.env.BETTER_AUTH_URL ?? "",
  process.env.BETTER_AUTH_SECRET ?? "",
);
