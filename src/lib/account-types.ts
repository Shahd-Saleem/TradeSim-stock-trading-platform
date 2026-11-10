export type AccountData = {
  user: { name: string; email: string };
  cashBalanceFils: number;
  startingCapitalFils: number;
  portfolioValueFils: number | null;
  profitLossFils: number | null;
  valuationComplete: boolean;
  realizedProfitLossFils: number;
  unrealizedProfitLossFils: number | null;
  returnBasisPoints: number | null;
  cashAdjustmentFils: number;
  holdings: {
    symbol: string;
    name: string;
    exchange: string;
    quantity: number;
    costBasisFils: number;
    averagePriceFils: number;
    priceFils: number | null;
    valueFils: number | null;
    quoteSnapshotAt: string | null;
    unrealizedProfitLossFils: number | null;
    unrealizedReturnBasisPoints: number | null;
    estimatedSaleProceedsFils: number | null;
    estimatedSaleProfitLossFils: number | null;
  }[];
  trades: {
    id: string;
    symbol: string;
    side: string;
    quantity: number;
    totalValueFils: number;
    createdAt: string;
  }[];
};
