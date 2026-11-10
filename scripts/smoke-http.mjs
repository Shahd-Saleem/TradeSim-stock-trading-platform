const base = process.argv[2] || "http://localhost:3000";
const checks = [];
for (const path of ["/", "/markets", "/login", "/register"]) {
  const response = await fetch(`${base}${path}`);
  const html = await response.text();
  checks.push({
    path,
    passed: response.status === 200 && html.includes("TradeSim"),
  });
}
const markets = await fetch(`${base}/markets`);
const marketHtml = await markets.text();
checks.push({
  path: "/markets (production security headers)",
  passed:
    markets.headers.get("X-Content-Type-Options") === "nosniff" &&
    markets.headers.get("X-Frame-Options") === "DENY" &&
    markets.headers.get("Referrer-Policy") ===
      "strict-origin-when-cross-origin",
});
checks.push({
  path: "/markets (no guest account data)",
  passed:
    !marketHtml.includes("Available balance") &&
    !marketHtml.includes("Available virtual balance") &&
    !marketHtml.includes("Portfolio value") &&
    !marketHtml.includes("cashBalanceFils"),
});
for (const path of ["/dashboard", "/portfolio", "/activity"]) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  const location = response.headers.get("Location");
  const destination = location ? new URL(location, base) : null;
  const body = await response.text();
  const expected = `/login?returnTo=${encodeURIComponent(path)}`;
  const httpRedirect =
    [303, 307].includes(response.status) &&
    destination?.pathname === "/login" &&
    destination.searchParams.get("returnTo") === path;
  // An App Router loading boundary may have already committed the response.
  // Verify both the streamed redirect digest and its HTML fallback target.
  const streamedRedirect =
    response.status === 200 &&
    body.includes(`NEXT_REDIRECT;replace;${expected};307;`) &&
    body.includes(`url=${expected}`);
  checks.push({
    path: `${path} (requires login)`,
    passed:
      (httpRedirect || streamedRedirect) &&
      !body.includes("cashBalanceFils") &&
      !body.includes("Available balance"),
  });
}
const account = await fetch(`${base}/api/account?userId=untrusted`);
checks.push({
  path: "/api/account (unauthenticated)",
  passed:
    account.status === 401 &&
    account.headers.get("Cache-Control").includes("no-store"),
});
const forbidden = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: {
    Origin: "https://untrusted.invalid",
    "Content-Type": "application/json",
  },
  body: "{}",
});
checks.push({
  path: "/api/auth/sign-in/email (untrusted origin)",
  passed: forbidden.status === 403,
});
for (const check of checks)
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.path}`);
if (checks.some((check) => !check.passed)) process.exitCode = 1;
