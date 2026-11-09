// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AuthForm } from "./AuthForm";
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function submit(container: HTMLElement) {
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "user@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "test-password-1234" },
  });
  fireEvent.submit(container.querySelector("form")!);
}
describe("authentication navigation", () => {
  it("preserves the safe destination across auth modes and successful sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true })),
    );
    const { container } = render(
      <AuthForm mode="login" returnTo="/portfolio" />,
    );
    expect(
      screen
        .getByRole("link", { name: "Create an account" })
        .getAttribute("href"),
    ).toBe("/register?returnTo=%2Fportfolio");
    submit(container);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/portfolio"),
    );
    expect(router.refresh).toHaveBeenCalled();
  });
  it("revalidates unsafe return destinations on the client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true })),
    );
    const { container } = render(
      <AuthForm mode="login" returnTo="//evil.invalid" />,
    );
    submit(container);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/dashboard"),
    );
  });
  it("shows immediate pending feedback and restores the form on an authentication error", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
      ),
    );
    const { container } = render(<AuthForm mode="login" />);
    submit(container);
    expect(
      screen
        .getByRole("button", { name: "Please wait…" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(container.querySelector("form")!.getAttribute("aria-busy")).toBe(
      "true",
    );
    finish(Response.json({ message: "Invalid credentials" }, { status: 400 }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(
      screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled"),
    ).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
