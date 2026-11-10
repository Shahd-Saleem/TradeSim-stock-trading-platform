import { Dashboard } from "@/components/Dashboard";
import { requireAccount } from "@/lib/account";
import { currentMarket } from "@/lib/current-market";
export const dynamic = "force-dynamic";
export default async function PortfolioPage() {
  return (
    <Dashboard
      account={await requireAccount("/portfolio")}
      market={await currentMarket()}
      initialView="Portfolio"
    />
  );
}
