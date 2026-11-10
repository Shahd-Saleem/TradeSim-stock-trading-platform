// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PriceChart } from "./PriceChart";
import { marketFixture } from "../../tests/fixtures/market";
const chart = vi.hoisted(() => ({
  setData: vi.fn(),
  remove: vi.fn(),
  fitContent: vi.fn(),
  create: vi.fn(),
}));
vi.mock("lightweight-charts", () => ({
  AreaSeries: {},
  ColorType: { Solid: "solid" },
  createChart: (...args: unknown[]) => {
    chart.create(...args);
    return {
      addSeries: () => ({ setData: chart.setData }),
      timeScale: () => ({ fitContent: chart.fitContent }),
      remove: chart.remove,
    };
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("filters 1M, 3M and 6M by saved calendar dates and includes the cutoff", () => {
  const stock = {
    ...marketFixture.stocks[0],
    sessionDate: "2026-11-10",
    history: [
      { time: "2026-05-14", priceFils: 900 },
      { time: "2026-05-15", priceFils: 1000 },
      { time: "2026-08-12", priceFils: 1100 },
      { time: "2026-08-13", priceFils: 1200 },
      { time: "2026-10-11", priceFils: 1250 },
      { time: "2026-10-12", priceFils: 1300 },
      { time: "2026-11-10", priceFils: 1400 },
      { time: "2026-11-11", priceFils: 1500 },
    ],
  };
  const { rerender } = render(<PriceChart stock={stock} days={30} />);
  for (const [days, start] of [
    [30, 5],
    [90, 3],
    [180, 1],
  ]) {
    rerender(<PriceChart stock={stock} days={days} />);
    expect(chart.setData).toHaveBeenLastCalledWith(
      stock.history
        .slice(start, 7)
        .map((p) => ({ time: p.time, value: p.priceFils / 100 })),
    );
  }
});
it("explains identical two-session windows and formats dates readably", () => {
  const stock = {
    ...marketFixture.stocks[0],
    sessionDate: "2026-11-10",
    history: [
      { time: "2026-11-09", priceFils: 1345 },
      { time: "2026-11-10", priceFils: 1400 },
    ],
  };
  const { rerender } = render(<PriceChart stock={stock} days={30} />);
  for (const days of [30, 90, 180]) {
    rerender(<PriceChart stock={stock} days={days} />);
    expect(screen.getByText(/2 recorded sessions/)).toBeTruthy();
    expect(
      screen.getByText(/longer timeframes may show the same sessions/),
    ).toBeTruthy();
    expect(screen.getByText(/9 Nov 2026/)).toBeTruthy();
    expect(chart.setData).toHaveBeenLastCalledWith([
      { time: "2026-11-09", value: 13.45 },
      { time: "2026-11-10", value: 14 },
    ]);
  }
  const options = chart.create.mock.calls[0][1];
  expect(options.localization.timeFormatter("2026-11-10")).toBe("10 Nov 2026");
  expect(
    options.timeScale.tickMarkFormatter({ year: 2026, month: 11, day: 9 }),
  ).toBe("9 Nov 2026");
});
it("shows a short-history state when the chosen window contains only one point", () => {
  render(
    <PriceChart
      stock={{
        ...marketFixture.stocks[0],
        sessionDate: "2026-11-10",
        history: [
          { time: "2026-08-01", priceFils: 1200 },
          { time: "2026-11-10", priceFils: 1400 },
        ],
      }}
      days={30}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("10 Nov 2026");
  expect(chart.setData).not.toHaveBeenCalled();
});
it("shows short history honestly without constructing old prices", () => {
  render(<PriceChart stock={marketFixture.stocks[0]} days={90} />);
  expect(screen.getByRole("status").textContent).toContain("history");
  expect(chart.setData).not.toHaveBeenCalled();
});
it("charts only persisted points and updates when the selected quote changes", () => {
  const stock = {
    ...marketFixture.stocks[0],
    sessionDate: "2026-11-10",
    priceFils: 1400,
    history: [
      { time: "2026-08-01", priceFils: 1200 },
      { time: "2026-11-09", priceFils: 1345 },
      { time: "2026-11-10", priceFils: 1400 },
    ],
  };
  render(<PriceChart stock={stock} days={30} />);
  expect(chart.setData).toHaveBeenCalledWith([
    { time: "2026-11-09", value: 13.45 },
    { time: "2026-11-10", value: 14 },
  ]);
});
