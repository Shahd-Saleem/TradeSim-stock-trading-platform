import { Dashboard } from "@/components/Dashboard";
import { currentAccount } from "@/lib/account";
import { currentMarket } from "@/lib/current-market";
export const dynamic = "force-dynamic";
export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; exchange?: string }>;
}) {
  const params = await searchParams;
  return (
    <Dashboard
      account={await currentAccount()}
      market={await currentMarket()}
      initialView="Markets"
      initialSymbol={params.symbol}
      initialExchange={params.exchange}
    />
  );
}
