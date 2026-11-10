import { Dashboard } from "@/components/Dashboard";
import { requireAccount } from "@/lib/account";
import { currentMarket } from "@/lib/current-market";
export const dynamic = "force-dynamic";
export default async function ActivityPage() {
  return (
    <Dashboard
      account={await requireAccount("/activity")}
      market={await currentMarket()}
      initialView="Activity"
    />
  );
}
