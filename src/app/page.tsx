import { Landing } from "@/components/Landing";
import { MarketRefresh } from "@/components/MarketRefresh";
import { currentSession } from "@/lib/session";
import { currentMarket } from "@/lib/current-market";
export const dynamic = "force-dynamic";
export default async function Home() {
  return (
    <>
      <MarketRefresh />
      <Landing
        authenticated={Boolean(await currentSession())}
        market={await currentMarket()}
      />
    </>
  );
}
