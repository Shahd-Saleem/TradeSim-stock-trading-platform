import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { createAuth } from "./auth-core";
import { createAuthHttp } from "./auth-http";
import { consumeAuthAttempt } from "./auth-throttle";
vi.mock("./auth-throttle", () => ({ consumeAuthAttempt: vi.fn() }));
const handler = vi.fn();
const auth = { handler } as unknown as ReturnType<typeof createAuth>;
const http = createAuthHttp(
  auth,
  {} as PrismaClient,
  "http://localhost:3000",
  "fake-test-secret",
);
function request(body: string, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body,
  });
}
beforeEach(() => vi.clearAllMocks());
describe("authentication HTTP boundary", () => {
  it("rejects an untrusted origin before any database or auth work", async () => {
    expect(
      (await http.POST(request("{}", "https://evil.invalid"))).status,
    ).toBe(403);
    expect(consumeAuthAttempt).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects malformed, invalid and excessive payloads", async () => {
    expect((await http.POST(request("not json"))).status).toBe(400);
    expect((await http.POST(request("{}"))).status).toBe(400);
    expect((await http.POST(request("x".repeat(8193)))).status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });
  it("enforces the shared limiter before password hashing", async () => {
    vi.mocked(consumeAuthAttempt).mockResolvedValue(false);
    const response = await http.POST(
      request(
        JSON.stringify({
          email: "user@example.test",
          password: "test-password-1234",
        }),
      ),
    );
    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });
  it("normalizes inputs and preserves session cookies on success", async () => {
    vi.mocked(consumeAuthAttempt).mockResolvedValue(true);
    handler.mockResolvedValue(
      Response.json(
        { ok: true },
        { headers: { "Set-Cookie": "test-cookie=test-value; HttpOnly" } },
      ),
    );
    const response = await http.POST(
      request(
        JSON.stringify({
          email: " USER@EXAMPLE.TEST ",
          password: "test-password-1234",
          userId: "untrusted",
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(await handler.mock.calls[0][0].json()).toEqual({
      email: "user@example.test",
      password: "test-password-1234",
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
