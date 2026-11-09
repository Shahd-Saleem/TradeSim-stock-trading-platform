import { describe, expect, it } from "vitest";
import { loginSchema, registrationSchema } from "./auth-validation";
import { safeInteger } from "./account-service";
describe("authentication validation", () => {
  it("normalizes email but preserves the password verbatim", () => {
    const password = "  test-password-1234  ";
    expect(
      loginSchema.parse({ email: " USER@EXAMPLE.TEST ", password }),
    ).toEqual({ email: "user@example.test", password });
  });
  it("rejects short passwords, invalid emails and missing registration names", () => {
    expect(
      loginSchema.safeParse({ email: "bad-email", password: "short" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "user@example.test", password: "short" })
        .success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        email: "user@example.test",
        password: "test-password-1234",
        name: " ",
      }).success,
    ).toBe(false);
  });
  it("refuses lossy bigint serialization at the UI boundary", () => {
    expect(safeInteger(10000000n)).toBe(10000000);
    expect(() => safeInteger(9007199254740992n)).toThrow(RangeError);
  });
});
