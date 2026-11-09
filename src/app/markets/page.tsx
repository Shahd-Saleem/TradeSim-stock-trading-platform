import { Dashboard } from "@/components/Dashboard";
import { currentAccount } from "@/lib/account";
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
      initialView="Markets"
      initialSymbol={params.symbol}
      initialExchange={params.exchange}
    />
  );
}
