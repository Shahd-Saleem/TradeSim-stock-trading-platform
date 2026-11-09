import { Dashboard } from "@/components/Dashboard";
import { requireAccount } from "@/lib/account";
export const dynamic = "force-dynamic";
export default async function ActivityPage() {
  return (
    <Dashboard
      account={await requireAccount("/activity")}
      initialView="Activity"
    />
  );
}
