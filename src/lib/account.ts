import "server-only";
import { redirect } from "next/navigation";
import { currentSession } from "./session";
import { loginDestination } from "./navigation";
import { db } from "./db";
import { readAccount } from "./account-service";
export async function currentAccount() {
  try {
    const session = await currentSession();
    return session ? await readAccount(db, session.user.id) : null;
  } catch {
    throw new Error("Account temporarily unavailable");
  }
}
export async function requireAccount(destination: string) {
  const account = await currentAccount();
  if (!account) redirect(loginDestination(destination));
  return account;
}
