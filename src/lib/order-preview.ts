import { positionValue, STARTING_CAPITAL } from "./money";

export type OrderSide = "buy" | "sell";
export type OrderPreviewResult = {
  quantity: number | null;
  valueFils: number | null;
  error: string | null;
};

/** Read-only estimate, never an authorization to execute an order. */
export function previewOrder(
  input: string,
  priceFils: number,
  side: OrderSide,
  balanceFils = STARTING_CAPITAL,
  ownedShares = 0,
): OrderPreviewResult {
  const invalid = (error: string): OrderPreviewResult => ({
    quantity: null,
    valueFils: null,
    error,
  });
  const normalized = input.trim();
  if (!normalized) return invalid("Enter a quantity to preview an order.");
  if (!/^\d+$/.test(normalized))
    return invalid("Use a positive whole number of shares.");
  const quantity = Number(normalized);
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    return invalid("Enter a positive whole number within the supported range.");
  let valueFils: number;
  try {
    valueFils = positionValue(priceFils, quantity);
  } catch {
    return invalid("This order value exceeds the supported range.");
  }
  const error =
    side === "buy" && valueFils > balanceFils
      ? "Estimated value exceeds your available virtual balance."
      : side === "sell" && quantity > ownedShares
        ? "You do not hold enough shares to sell this quantity."
        : null;
  return { quantity, valueFils, error };
}
