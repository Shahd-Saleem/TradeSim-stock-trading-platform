import { Dashboard } from "@/components/Dashboard";
import { requireAccount } from "@/lib/account";
export const dynamic = "force-dynamic";
export default async function PortfolioPage() {
  return (
    <Dashboard
      account={await requireAccount("/portfolio")}
      initialView="Portfolio"
    />
  );
}
