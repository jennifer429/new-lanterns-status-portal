/**
 * Cross-login "return to" handling for deep links.
 *
 * When a logged-out user opens an in-app deep link (e.g. a status-update email
 * link to /org/.../intake?q=...), the global 401 handler bounces them to login.
 * We stash the intended destination here first, then navigate back to it once
 * they're authenticated — works for both the email/password and OAuth flows
 * since sessionStorage survives the same-origin round trip.
 */
const KEY = "nl_return_to";

/** Save an in-app destination (only org deep links) before redirecting to login. */
export function saveReturnTo(path: string) {
  try {
    if (path && path.startsWith("/org/") && !path.includes("/admin")) {
      sessionStorage.setItem(KEY, path);
    }
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

/** Read and clear the saved destination (one-shot). */
export function takeReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
