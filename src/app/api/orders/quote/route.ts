import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderQuoteResponse } from "@/lib/order-quote-http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return orderQuoteResponse(auth, db, request);
}
