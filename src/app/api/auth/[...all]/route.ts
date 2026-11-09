import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuthHttp } from "@/lib/auth-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = createAuthHttp(
  auth,
  db,
  process.env.BETTER_AUTH_URL!,
  process.env.BETTER_AUTH_SECRET!,
);
