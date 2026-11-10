import "server-only";
import { cache } from "react";
import { db } from "./db";
import { readMarket } from "./market-data";
export const currentMarket = cache(async () => {
  try {
    return await readMarket(db);
  } catch {
    throw new Error("Simulated market temporarily unavailable.");
  }
});
