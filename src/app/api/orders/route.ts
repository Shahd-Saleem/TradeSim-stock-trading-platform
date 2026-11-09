import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrderHttp } from "@/lib/order-http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const handler = createOrderHttp(auth, db, process.env.BETTER_AUTH_URL!);
export const POST = handler.POST;
export const GET = handler.GET;
