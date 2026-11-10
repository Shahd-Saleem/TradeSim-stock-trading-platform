import { expect, it } from "vitest";
import {
  closedDates,
  latestCompletedSession,
  nextSession,
} from "./market-calendar";
const closures = closedDates("2026-12-02, 2026-12-03");
it.each([
  ["2026-11-10T10:59:59Z", "2026-11-09"],
  ["2026-11-10T11:00:00Z", "2026-11-10"],
  ["2026-11-14T12:00:00Z", "2026-11-13"],
  ["2026-11-15T20:01:00Z", "2026-11-13"],
  ["2026-11-16T11:00:00Z", "2026-11-16"],
  ["2026-12-03T12:00:00Z", "2026-12-01"],
  ["2026-12-04T11:00:00Z", "2026-12-04"],
])("maps %s to latest completed Dubai session %s", (time, expected) => {
  expect(latestCompletedSession(new Date(time), closures)).toBe(expected);
});
it("skips explicit fictional closures, deduplicates and rejects invalid dates", () => {
  expect(nextSession("2026-12-01", closures)).toBe("2026-12-04");
  expect(closedDates("2026-12-02,2026-12-02").size).toBe(1);
  expect(() => closedDates("2026-02-30")).toThrow();
  expect(closedDates().size).toBe(0);
});
