import { Landing } from "@/components/Landing";
import { currentSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <Landing authenticated={Boolean(await currentSession())} />;
}
