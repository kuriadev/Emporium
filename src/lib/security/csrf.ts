/**
 * Double-submit CSRF token for fetch-based mutations (route handlers such as uploads and CSV
 * imports). The proxy sets a random, SameSite=Strict cookie; same-origin scripts echo it in a
 * header that a cross-site page can neither read nor forge. Server Actions are additionally
 * covered by Next's own Origin check and our same-origin assertion.
 */
export const CSRF_COOKIE = "em_csrf";
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/** Browser-only: the token to send with same-origin fetch mutations. */
export function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

/** Constant-time comparison of the cookie and header copies. */
export function csrfMatches(cookie: string | undefined | null, header: string | undefined | null): boolean {
  if (!cookie || !header || !CSRF_PATTERN.test(cookie) || cookie.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < cookie.length; i++) diff |= cookie.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}
