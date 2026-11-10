import "server-only";
import { createPrisma } from "./prisma-client";
let writer: ReturnType<typeof createPrisma> | undefined;
export function marketWriter() {
  if (writer) return writer;
  const connection = process.env.MARKET_DATABASE_URL;
  if (!connection) throw new Error("Market writer configuration required");
  if (
    decodeURIComponent(new URL(connection).username).split(".")[0] !==
    "tradesim_market_writer"
  )
    throw new Error("A dedicated market writer role is required");
  writer = createPrisma(connection);
  return writer;
}
