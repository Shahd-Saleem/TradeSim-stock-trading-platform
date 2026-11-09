"use client";
import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart } from "lightweight-charts";
import { history, type Stock } from "@/lib/market";
export function PriceChart({ stock, days }: { stock: Stock; days: number }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: "#11161f" },
        textColor: "#7d899d",
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#202734" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: {
        priceFormatter: (price: number) => `AED ${price.toFixed(2)}`,
      },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#53d6b0",
      topColor: "rgba(83,214,176,0.22)",
      bottomColor: "rgba(83,214,176,0)",
      lineWidth: 2,
      priceLineVisible: false,
    });
    series.setData(history(stock, days));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [stock, days]);
  return (
    <div
      role="img"
      aria-label={`${stock.name} simulated price chart, ${days} days, ending at AED ${(stock.priceFils / 100).toFixed(2)}`}
      ref={container}
      style={{ height: 280, width: "100%" }}
    />
  );
}
