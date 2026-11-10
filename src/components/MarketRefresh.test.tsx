// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MarketRefresh } from "./MarketRefresh";
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("refreshes visible workspaces periodically and on focus, throttling duplicate events and cleaning up", () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const view = render(<MarketRefresh />);
  expect(router.refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(300000);
  expect(router.refresh).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("focus"));
  expect(router.refresh).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(31000);
  window.dispatchEvent(new Event("focus"));
  expect(router.refresh).toHaveBeenCalledTimes(2);
  view.unmount();
  vi.advanceTimersByTime(300000);
  window.dispatchEvent(new Event("focus"));
  expect(router.refresh).toHaveBeenCalledTimes(2);
});
it("does no hidden-tab polling and refreshes when the tab becomes visible", () => {
  vi.useFakeTimers();
  const state = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  render(<MarketRefresh />);
  vi.advanceTimersByTime(600000);
  expect(router.refresh).not.toHaveBeenCalled();
  state.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(router.refresh).toHaveBeenCalledTimes(1);
});
