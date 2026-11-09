export type AccountData = {
  user: { name: string; email: string };
  cashBalanceFils: number;
  startingCapitalFils: number;
  portfolioValueFils: number;
  profitLossFils: number;
  holdings: {
    symbol: string;
    exchange: string;
    quantity: number;
    costBasisFils: number;
    valueFils: number;
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
