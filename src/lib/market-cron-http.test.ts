import { expect, it, vi } from "vitest";
import { createMarketCronHttp } from "./market-cron-http";
const secret = "x".repeat(48);
const request = (authorization?: string, query = "") =>
  new Request(`https://example.test/api/cron/market${query}`, {
    headers: authorization ? { authorization } : {},
  });
it.each([undefined, "Bearer wrong", `Bearer ${secret}extra`, secret])(
  "rejects invalid authorization %s before accessing the database",
  async (value) => {
    const run = vi.fn();
    const response = await createMarketCronHttp(
      run,
      () => secret,
      () => true,
    )(request(value));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(run).not.toHaveBeenCalled();
  },
);
it("fails closed when disabled or the secret is absent/invalid", async () => {
  const run = vi.fn();
  for (const [configured, enabled] of [
    [undefined, true],
    ["short", true],
    [secret, false],
  ] as const) {
    expect(
      (
        await createMarketCronHttp(
          run,
          () => configured,
          () => enabled,
        )(request(`Bearer ${secret}`))
      ).status,
    ).toBe(503);
  }
  expect(run).not.toHaveBeenCalled();
});
it("does not accept caller-supplied target dates", async () => {
  const run = vi.fn();
  expect(
    (
      await createMarketCronHttp(
        run,
        () => secret,
        () => true,
      )(request(`Bearer ${secret}`, "?date=2099-01-01"))
    ).status,
  ).toBe(400);
  expect(run).not.toHaveBeenCalled();
});
it("returns safe structured success and sanitized errors", async () => {
  const result = { latestSession: "2026-11-10", sessionsPublished: 1 };
  const run = vi.fn().mockResolvedValue(result);
  const handler = createMarketCronHttp(
    run,
    () => secret,
    () => true,
  );
  expect(await (await handler(request(`Bearer ${secret}`))).json()).toEqual({
    ok: true,
    ...result,
  });
  run.mockRejectedValue(new Error("private database diagnostics"));
  const failed = await handler(request(`Bearer ${secret}`));
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("private database");
});
