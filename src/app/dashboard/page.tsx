import { Dashboard } from "@/components/Dashboard";
import { requireAccount } from "@/lib/account";
import { currentMarket } from "@/lib/current-market";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  return (
    <Dashboard
      account={await requireAccount("/dashboard")}
      market={await currentMarket()}
      initialView="Overview"
    />
  );
}
