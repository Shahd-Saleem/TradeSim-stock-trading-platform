import { Landing } from "@/components/Landing";
import { currentSession } from "@/lib/session";
import { currentMarket } from "@/lib/current-market";
export const dynamic = "force-dynamic";
export default async function Home() {
  return (
    <Landing
      authenticated={Boolean(await currentSession())}
      market={await currentMarket()}
    />
  );
}
