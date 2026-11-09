export const workspaceRoutes = {
  Overview: "/dashboard",
  Markets: "/markets",
  Portfolio: "/portfolio",
  Activity: "/activity",
} as const;
export type WorkspaceView = keyof typeof workspaceRoutes;
const destinations = new Set<string>(Object.values(workspaceRoutes));
/** Explicit same-origin route allowlist prevents open redirects and auth loops. */
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/dashboard";
  try {
    const url = new URL(value, "https://tradesim.invalid");
    if (
      url.origin !== "https://tradesim.invalid" ||
      !destinations.has(url.pathname)
    )
      return "/dashboard";
    return url.pathname + url.search;
  } catch {
    return "/dashboard";
  }
}
export function loginDestination(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
