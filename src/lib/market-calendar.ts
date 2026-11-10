import { dubaiDate, validDate, nextTradingDay } from "./daily-market";

/** Explicit fictional closures, not a claimed official DFM/ADX holiday calendar. */
export function closedDates(value = ""): Set<string> {
  const dates = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (dates.length > 730) throw new Error("Too many simulated closure dates");
  for (const date of dates) validDate(date);
  return new Set(dates);
}
export function isSession(day: string, closures: ReadonlySet<string>) {
  return ![0, 6].includes(validDate(day).getUTCDay()) && !closures.has(day);
}
export function nextSession(day: string, closures: ReadonlySet<string>) {
  let next = nextTradingDay(day);
  while (closures.has(next)) next = nextTradingDay(next);
  return next;
}
export function latestCompletedSession(
  now: Date,
  closures: ReadonlySet<string>,
) {
  let day = dubaiDate(now);
  let date = validDate(day);
  if (now.getTime() < new Date(`${day}T15:00:00+04:00`).getTime())
    date = new Date(date.getTime() - 86400000);
  day = date.toISOString().slice(0, 10);
  while (!isSession(day, closures)) {
    date = new Date(date.getTime() - 86400000);
    day = date.toISOString().slice(0, 10);
  }
  return day;
}
