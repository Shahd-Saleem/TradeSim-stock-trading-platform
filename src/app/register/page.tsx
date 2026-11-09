import { AuthForm } from "@/components/AuthForm";
import { currentSession } from "@/lib/session";
import { safeReturnTo } from "@/lib/navigation";
import { redirect } from "next/navigation";
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const destination = safeReturnTo((await searchParams).returnTo);
  if (await currentSession()) redirect(destination);
  return <AuthForm mode="register" returnTo={destination} />;
}
