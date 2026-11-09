import { z } from "zod";
export const stockSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: z.enum(["DFM", "ADX"]),
  sector: z.string(),
  priceFils: z.number().int().positive(),
  previousFils: z.number().int().positive(),
  volume: z.string(),
  color: z.string(),
});
export type Stock = z.infer<typeof stockSchema>;
export const SNAPSHOT_DATE = "2026-11-09";
export const stocks: Stock[] = z.array(stockSchema).parse([
  {
    symbol: "EMAAR",
    name: "Emaar Properties",
    exchange: "DFM",
    sector: "Real estate",
    priceFils: 1345,
    previousFils: 1312,
    volume: "12.4M",
    color: "#669bff",
  },
  {
    symbol: "FAB",
    name: "First Abu Dhabi Bank",
    exchange: "ADX",
    sector: "Banking",
    priceFils: 1678,
    previousFils: 1660,
    volume: "8.2M",
    color: "#5ad4c0",
  },
  {
    symbol: "DEWA",
    name: "Dubai Electricity & Water",
    exchange: "DFM",
    sector: "Utilities",
    priceFils: 284,
    previousFils: 288,
    volume: "6.8M",
    color: "#a48aff",
  },
  {
    symbol: "IHC",
    name: "International Holding Co.",
    exchange: "ADX",
    sector: "Diversified",
    priceFils: 41020,
    previousFils: 40800,
    volume: "1.1M",
    color: "#ffbd69",
  },
  {
    symbol: "DIB",
    name: "Dubai Islamic Bank",
    exchange: "DFM",
    sector: "Banking",
    priceFils: 812,
    previousFils: 805,
    volume: "5.6M",
    color: "#7fbd91",
  },
  {
    symbol: "ALDAR",
    name: "Aldar Properties",
    exchange: "ADX",
    sector: "Real estate",
    priceFils: 923,
    previousFils: 938,
    volume: "9.3M",
    color: "#ef8da8",
  },
  {
    symbol: "EAND",
    name: "Emirates Telecommunications",
    exchange: "ADX",
    sector: "Telecom",
    priceFils: 1876,
    previousFils: 1852,
    volume: "3.7M",
    color: "#eb7c73",
  },
  {
    symbol: "SALIK",
    name: "Salik Company",
    exchange: "DFM",
    sector: "Transport",
    priceFils: 564,
    previousFils: 557,
    volume: "4.9M",
    color: "#d2b87b",
  },
]);
/** Fixed seed and UTC dates ensure identical server/client and repeatable chart data. */
export function history(stock: Stock, days: number) {
  let seed = [...stock.symbol].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const end = Date.UTC(2026, 10, 9);
  const full = Array.from({ length: 180 }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const progress = i / 179;
    const value = Math.round(
      stock.priceFils *
        (0.88 +
          progress * 0.12 +
          Math.sin(i / 9) * 0.014 +
          (seed / 4294967296 - 0.5) * 0.016),
    );
    return {
      time: new Date(end - (179 - i) * 86400000).toISOString().slice(0, 10),
      value: (i === 179 ? stock.priceFils : value) / 100,
    };
  });
  return full.slice(-days);
}
