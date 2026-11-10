import { stocks, SNAPSHOT_DATE } from "@/lib/market";
import type { MarketData } from "@/lib/market-data";
export const marketFixture: MarketData = {
  sessionDate: SNAPSHOT_DATE,
  stocks: stocks.map((stock) => ({
    ...stock,
    sessionDate: SNAPSHOT_DATE,
    snapshotAt: `${SNAPSHOT_DATE}T00:00:00.000Z`,
    history: [{ time: SNAPSHOT_DATE, priceFils: stock.priceFils }],
  })),
};
