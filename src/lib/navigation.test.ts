import { describe, expect, it } from "vitest";
import { safeReturnTo, loginDestination } from "./navigation";
describe("safe authentication return destinations", () => {
  it.each([
    "/dashboard",
    "/portfolio",
    "/activity",
    "/markets",
    "/markets?symbol=FAB&exchange=ADX",
  ])("preserves %s", (path) => expect(safeReturnTo(path)).toBe(path));
  it.each([
    undefined,
    null,
    ["//evil.invalid"],
    "//evil.invalid",
    "https://evil.invalid",
    "javascript:alert(1)",
    "/\\evil.invalid",
    "/login",
    "/register",
    "/api/account",
    "/%2f%2fevil.invalid",
    "/dashboard\n",
    "/dashboard/../login",
  ])("rejects unsafe or looping destination %j", (path) =>
    expect(safeReturnTo(path)).toBe("/dashboard"),
  );
  it("encodes the entire nested destination", () =>
    expect(loginDestination("/markets?symbol=FAB&exchange=ADX")).toBe(
      "/login?returnTo=%2Fmarkets%3Fsymbol%3DFAB%26exchange%3DADX",
    ));
});
