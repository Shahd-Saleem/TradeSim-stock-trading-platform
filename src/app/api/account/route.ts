import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountResponse } from "@/lib/account-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return accountResponse(auth, db, request.headers);
}
