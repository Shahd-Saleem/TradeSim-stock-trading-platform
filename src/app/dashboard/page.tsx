import { Dashboard } from "@/components/Dashboard";
import { requireAccount } from "@/lib/account";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  return (
    <Dashboard
      account={await requireAccount("/dashboard")}
      initialView="Overview"
    />
  );
}
