"use client";
import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type Time,
} from "lightweight-charts";
import type { MarketStock } from "@/lib/market-data";
import s from "./PriceChart.module.css";
const dateLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function readableDate(time: Time): string {
  const date =
    typeof time === "string"
      ? new Date(`${time}T00:00:00Z`)
      : typeof time === "number"
        ? new Date(time * 1000)
        : new Date(Date.UTC(time.year, time.month - 1, time.day));
  return dateLabel.format(date);
}
export function PriceChart({
  stock,
  days,
}: {
  stock: MarketStock;
  days: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const points = useMemo(() => {
    const end = new Date(`${stock.sessionDate}T00:00:00Z`).getTime();
    const cutoff = new Date(end - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    return stock.history.filter(
      (point) => point.time >= cutoff && point.time <= stock.sessionDate,
    );
  }, [stock, days]);
  const limited =
    !stock.history.length ||
    new Date(`${stock.sessionDate}T00:00:00Z`).getTime() -
      new Date(`${stock.history[0].time}T00:00:00Z`).getTime() <
      (days - 1) * 86400000;
  useEffect(() => {
    if (!container.current || points.length < 2) return;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#11161f" },
        textColor: "#7d899d",
        attributionLogo: true,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#202734" } },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        tickMarkFormatter: readableDate,
      },
      localization: {
        timeFormatter: readableDate,
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
    series.setData(
      points.map((point) => ({
        time: point.time,
        value: point.priceFils / 100,
      })),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points]);
  return (
    <div>
      {points.length < 2 ? (
        <div className={`${s.container} ${s.empty}`} role="status">
          {points.length === 1
            ? `Price history in this window contains one saved quote, for ${readableDate(points[0].time)}.`
            : "No saved prices in this window."}{" "}
          More saved daily prices are needed to show a trend.
        </div>
      ) : (
        <div
          role="img"
          aria-label={`${stock.name} stored simulated price chart, up to ${days} calendar days, ending at AED ${(stock.priceFils / 100).toFixed(2)}`}
          ref={container}
          className={s.container}
        />
      )}
      <p className={s.historyNote}>
        <strong>
          {points.length} recorded{" "}
          {points.length === 1 ? "session" : "sessions"}
        </strong>
        {points.length > 0 && (
          <>
            {" "}
            · {readableDate(points[0].time)}
            {points.length > 1 && (
              <> – {readableDate(points[points.length - 1].time)}</>
            )}
          </>
        )}
        <span>
          Stored simulated prices · Asia/Dubai session dates. Timeframes show up
          to {days} calendar days.
        </span>
        <span>
          Includes generated fictional historical prices for chart exploration,
          not real market data or past portfolio performance.
        </span>
        {limited && (
          <span>
            Limited history: longer timeframes may show the same sessions.
            History will accumulate as new simulated daily prices are generated;
            only saved simulated prices are shown.
          </span>
        )}
      </p>
    </div>
  );
}
