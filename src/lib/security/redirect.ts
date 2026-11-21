/**
 * Validates a post-login redirect target. Only same-origin relative paths are allowed:
 * rejects absolute URLs, protocol-relative `//host`, backslash tricks, control characters,
 * and encoded variants of those. Admin paths are only allowed when `allowAdmin` is set.
 */
export function safeRedirect(raw: unknown, fallback = "/", opts: { allowAdmin?: boolean } = {}): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;

  let decoded = raw;
  try {
    for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(decoded); i++) decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  if (/[\u0000-\u001f\u007f\\]/.test(decoded)) return fallback;
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\t")) return fallback;

  let url: URL;
  try {
    url = new URL(decoded, "https://emporium.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://emporium.invalid") return fallback;

  const path = url.pathname;
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  if (isAdmin) return opts.allowAdmin && path !== "/admin/login" ? path + url.search : fallback;
  if (opts.allowAdmin) return fallback;
  if (path === "/login" || path === "/register") return fallback;
  if (path.startsWith("/api/")) return fallback;

  return path + url.search + url.hash;
}
