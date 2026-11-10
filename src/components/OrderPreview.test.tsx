// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { OrderPreview } from "./OrderPreview";
import { stocks } from "@/lib/market";
import type { AccountData } from "@/lib/account-types";
const account: AccountData = {
  user: { name: "Trader", email: "trader@example.test" },
  cashBalanceFils: 10000000,
  startingCapitalFils: 10000000,
  portfolioValueFils: 10000000,
  profitLossFils: 0,
  valuationComplete: true,
  realizedProfitLossFils: 0,
  unrealizedProfitLossFils: 0,
  returnBasisPoints: 0,
  cashAdjustmentFils: 0,
  holdings: [
    {
      symbol: "EMAAR",
      exchange: "DFM",
      quantity: 10,
      costBasisFils: 10000,
      valueFils: 10000,
      name: "Emaar Properties",
      averagePriceFils: 1000,
      priceFils: 1000,
      quoteSnapshotAt: "2026-11-09T00:00:00.000Z",
      unrealizedProfitLossFils: 0,
      unrealizedReturnBasisPoints: 0,
      estimatedSaleProceedsFils: 10000,
      estimatedSaleProfitLossFils: 0,
    },
  ],
  trades: [],
};
let fetcher: ReturnType<
  typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>
>;
let post: ReturnType<
  typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>
>;
const changed = vi.fn();
const locked = vi.fn();
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  sessionStorage.clear();
  changed.mockReset();
  locked.mockReset();
  post = vi.fn(async () =>
    Response.json(
      { ok: true, trade: { quantity: "2", totalValueFils: "2000" } },
      { status: 201 },
    ),
  );
  fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return post(url, init);
    return Response.json(
      url === "/api/account"
        ? account
        : {
            priceFils: 1000,
            token: "signed-quote",
            expiresAt: Date.now() + 300000,
            snapshotAt: "2026-11-09",
          },
    );
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
async function setup(side = "Buy") {
  render(
    <OrderPreview
      stock={stocks[0]}
      account={account}
      onAccountChange={changed}
      onLockChange={locked}
    />,
  );
  await waitFor(() =>
    expect(screen.queryByText(/Loading your account/)).toBeNull(),
  );
  if (side === "Sell")
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Quantity/ }), {
    target: { value: "2" },
  });
}
it.each(["Buy", "Sell"])(
  "requires explicit Confirm %s and refreshes account data after success",
  async (side) => {
    await setup(side);
    expect(screen.getByText("AED 10.00")).toBeTruthy(); // Server quote differs from fixture.
    fireEvent.click(screen.getByRole("button", { name: `Review ${side}` }));
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByText("Number of shares").nextElementSibling?.textContent,
    ).toBe("2");
    expect(
      dialog.getByText("Simulated price per share").nextElementSibling
        ?.textContent,
    ).toBe("AED 10.00");
    expect(
      dialog.getByText("Virtual cash before trade").nextElementSibling
        ?.textContent,
    ).toBe("AED 100,000.00");
    expect(
      dialog.getByText("Estimated virtual cash after trade").nextElementSibling
        ?.textContent,
    ).toBe(side === "Buy" ? "AED 99,980.00" : "AED 100,020.00");
    expect(dialog.getByText(/Virtual funds only/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: `Confirm ${side}` }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("confirmed"),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String(post.mock.calls[0][1]!.body));
    expect(body).toMatchObject({
      side: side.toUpperCase(),
      quantity: 2,
      quoteToken: "signed-quote",
    });
    expect(body).not.toHaveProperty("priceFils");
  },
);
it("blocks duplicate clicks while pending and reuses the exact request after a network failure", async () => {
  await setup();
  let rejectRequest!: (reason: Error) => void;
  post.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  const confirm = screen.getByRole("button", { name: "Confirm Buy" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(post).toHaveBeenCalledTimes(1);
  expect(
    screen
      .getByRole("button", { name: "Submitting…" })
      .hasAttribute("disabled"),
  ).toBe(true);
  rejectRequest(new Error("Connection interrupted"));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Retry same order" }),
    ).toBeTruthy(),
  );
  expect(
    screen.getByRole("textbox", { name: /Quantity/ }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry same order" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(post.mock.calls[0][1]!.body).toBe(post.mock.calls[1][1]!.body);
});
it.each([
  "INSUFFICIENT_FUNDS",
  "INSUFFICIENT_SHARES",
  "INVALID_ORDER",
  "QUOTE_CHANGED",
  "ACCOUNT_CHANGED",
])("shows a friendly %s failure and requires fresh review", async (code) => {
  await setup();
  post.mockResolvedValueOnce(
    Response.json(
      { ok: false, error: { code } },
      { status: code === "QUOTE_CHANGED" ? 409 : 422 },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Buy" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Review Buy" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByRole("button", { name: /Refresh quote/ })).toBeNull();
});

it("cancels a confirmation without placing a trade and removes routine refresh controls", async () => {
  await setup();
  expect(screen.queryByRole("button", { name: /Refresh quote/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.getByRole("textbox", { name: /Quantity/ }).hasAttribute("disabled"),
  ).toBe(false);
  expect(post).not.toHaveBeenCalled();
  expect(locked).toHaveBeenLastCalledWith(false);
});
it("disables invalid quantities, insufficient cash and overselling", async () => {
  await setup();
  for (const quantity of ["0", "-1", "1.5", "abc", "10001"]) {
    fireEvent.change(screen.getByRole("textbox", { name: /Quantity/ }), {
      target: { value: quantity },
    });
    expect(
      screen
        .getByRole("button", { name: "Review Buy" })
        .hasAttribute("disabled"),
    ).toBe(true);
  }
  fireEvent.click(screen.getByRole("button", { name: "Sell" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Quantity/ }), {
    target: { value: "11" },
  });
  expect(
    screen
      .getByRole("button", { name: "Review Sell" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
it("blocks trading after session expiry", async () => {
  await setup();
  post.mockResolvedValueOnce(
    Response.json(
      { ok: false, error: { code: "UNAUTHENTICATED" } },
      { status: 401 },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Buy" }));
  await waitFor(() =>
    expect(screen.getByRole("link", { name: "Sign in again" })).toBeTruthy(),
  );
  expect(
    screen
      .getByRole("button", { name: "Retry same order" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("recovers an unconfirmed order after remount and retains its key", async () => {
  await setup();
  post.mockRejectedValueOnce(new Error("Connection interrupted"));
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Buy" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Retry same order" }),
    ).toBeTruthy(),
  );
  const original = post.mock.calls[0][1]!.body;
  cleanup();
  render(
    <OrderPreview
      stock={stocks[0]}
      account={account}
      onAccountChange={changed}
      onLockChange={locked}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Retry same order" }),
    ).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry same order" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("confirmed"),
  );
  expect(post.mock.calls[1][1]!.body).toBe(original);
});

it("closes and reopens an uncertain dialog without abandoning its idempotency key", async () => {
  await setup();
  post.mockRejectedValueOnce(new Error("Connection interrupted"));
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Buy" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Retry same order" }),
    ).toBeTruthy(),
  );
  const original = post.mock.calls[0][1]!.body;
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Resolve pending order" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry same order" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("confirmed"),
  );
  expect(post.mock.calls[1][1]!.body).toBe(original);
});

it("keeps confirmation visible and disables new orders when account refresh fails after execution", async () => {
  await setup();
  fetcher.mockImplementation(async (url, init) =>
    init?.method === "POST"
      ? post(url, init)
      : Response.json({}, { status: 503 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Review Buy" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Buy" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Trade confirmed."),
  );
  expect(screen.getByRole("status").textContent).toContain("confirmed");
  expect(
    screen.getByRole("button", { name: "Review Buy" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(post).toHaveBeenCalledTimes(1);
});
