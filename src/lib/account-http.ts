import type { PrismaClient } from "@/generated/prisma/client";
import type { createAuth } from "./auth-core";
import { readAccount } from "./account-service";
export async function accountResponse(
  auth: ReturnType<typeof createAuth>,
  db: PrismaClient,
  requestHeaders: Headers,
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session)
      return Response.json(
        { message: "Authentication required." },
        { status: 401, headers },
      );
    return Response.json(await readAccount(db, session.user.id), { headers });
  } catch {
    return Response.json(
      { message: "Account temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
