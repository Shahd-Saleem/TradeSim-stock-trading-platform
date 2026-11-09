/** Financial values are integer fils. Floating point is used only for display/chart coordinates. */
export const STARTING_CAPITAL = 10_000_000;
export function positionValue(priceFils: number, quantity: number): number {
  if (
    !Number.isSafeInteger(priceFils) ||
    priceFils < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 0
  )
    throw new RangeError("Expected non-negative integer fils and shares");
  const result = priceFils * quantity;
  if (!Number.isSafeInteger(result))
    throw new RangeError("Amount exceeds safe integer range");
  return result;
}
export function aed(fils: number): string {
  if (!Number.isSafeInteger(fils))
    throw new RangeError("Expected integer fils");
  return `AED ${(fils / 100).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function changePercent(current: number, previous: number): number {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}
