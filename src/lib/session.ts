import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
export const currentSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    throw new Error("Session temporarily unavailable");
  }
});
