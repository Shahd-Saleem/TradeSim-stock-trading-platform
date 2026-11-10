/** Exact aggregate accounting; only rounded presentation values cross into numbers. */
export function safeInteger(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new RangeError("Financial value exceeds display range");
  return result;
}
export function roundedRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("Expected positive denominator");
  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  return sign * ((magnitude + denominator / 2n) / denominator);
}
export function returnBasisPoints(
  profit: bigint,
  basis: bigint,
): number | null {
  return basis > 0n ? safeInteger(roundedRatio(profit * 10000n, basis)) : null;
}
export function holdingAnalytics(
  quantity: bigint,
  basis: bigint,
  price: bigint | null,
) {
  if (quantity <= 0n || basis < 0n || (price !== null && price <= 0n))
    throw new RangeError("Invalid holding");
  const value = price === null ? null : quantity * price;
  const profit = value === null ? null : value - basis;
  return {
    quantity: safeInteger(quantity),
    costBasisFils: safeInteger(basis),
    averagePriceFils: safeInteger(roundedRatio(basis, quantity)),
    priceFils: price === null ? null : safeInteger(price),
    valueFils: value === null ? null : safeInteger(value),
    unrealizedProfitLossFils: profit === null ? null : safeInteger(profit),
    unrealizedReturnBasisPoints:
      profit === null ? null : returnBasisPoints(profit, basis),
    estimatedSaleProceedsFils: value === null ? null : safeInteger(value),
    estimatedSaleProfitLossFils: profit === null ? null : safeInteger(profit),
  };
}
export function portfolioAnalytics(
  cash: bigint,
  startingCapital: bigint,
  purchases: bigint,
  sales: bigint,
  holdings: {
    quantity: bigint;
    costBasisFils: bigint;
    priceFils: bigint | null;
  }[],
) {
  let basis = 0n,
    marketValue = 0n;
  const complete = holdings.every((holding) => holding.priceFils !== null);
  for (const holding of holdings) {
    basis += holding.costBasisFils;
    if (holding.priceFils !== null)
      marketValue += holding.quantity * holding.priceFils;
  }
  // Acquisitions minus remaining basis equals cost basis released on all sales.
  const realized = sales - purchases + basis;
  const unrealized = marketValue - basis;
  const total = realized + unrealized;
  return {
    valuationComplete: complete,
    portfolioValueFils: complete ? safeInteger(cash + marketValue) : null,
    profitLossFils: complete ? safeInteger(total) : null,
    realizedProfitLossFils: safeInteger(realized),
    unrealizedProfitLossFils: complete ? safeInteger(unrealized) : null,
    returnBasisPoints: complete
      ? returnBasisPoints(total, startingCapital)
      : null,
    // Makes legacy/admin cash adjustments explicit rather than calling them returns.
    cashAdjustmentFils: safeInteger(cash - startingCapital - sales + purchases),
  };
}
export function percentLabel(basisPoints: number | null) {
  if (basisPoints === null) return "Unavailable";
  return `${basisPoints > 0 ? "+" : ""}${(basisPoints / 100).toFixed(2)}%`;
}
export function positionDescription(count: number) {
  return count === 0
    ? "No open positions yet"
    : `${count} active ${count === 1 ? "holding" : "holdings"} in your portfolio`;
}
