import { describe, expect, it } from "vitest";
import { csrfMatches } from "@/lib/security/csrf";
import { csvCell, parseCsv, toCsv } from "@/lib/security/csv";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { safeRedirect } from "@/lib/security/redirect";
import { escapeHtml, maskEmail, renderSafeMarkdown, sanitizeText } from "@/lib/security/sanitize";
import { redact } from "@/server/security/logger";

describe("safeRedirect", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "%2F%2Fevil.test", "javascript:alert(1)", "/%0d%0aSet-Cookie:x", "\\\\evil.test", "/api/session"])("rejects %s", (raw) => {
    expect(safeRedirect(raw, "/")).toBe("/");
  });

  it("keeps same-origin paths with their query", () => {
    expect(safeRedirect("/orders/abc?tab=items")).toBe("/orders/abc?tab=items");
  });

  it("keeps shoppers out of /admin and staff inside it", () => {
    expect(safeRedirect("/admin/orders", "/")).toBe("/");
    expect(safeRedirect("/admin/orders", "/admin", { allowAdmin: true })).toBe("/admin/orders");
    expect(safeRedirect("/account", "/admin", { allowAdmin: true })).toBe("/admin");
  });
});

describe("sanitising", () => {
  it("strips tags and control characters from plain text", () => {
    expect(sanitizeText("  <b>Hi</b>\u0000 there\n ")).toBe("Hi there");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).not.toMatch(/[<>"']/);
  });

  it.each([
    ["<script>alert(1)</script>", /<script/i],
    ["[x](javascript:alert(1))", /javascript:/i],
    ['<img src=x onerror=alert(1)>', /<img/i],
    ["[x](data:text/html;base64,PHNjcmlwdD4=)", /data:/i],
  ])("markdown neutralises %s", (input, bad) => {
    expect(renderSafeMarkdown(input)).not.toMatch(bad);
  });

  it("renders the allowed markdown subset", () => {
    const html = renderSafeMarkdown("**bold** and [docs](https://example.com)");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toMatch(/href="https:\/\/example\.com\/?"[^>]*rel="[^"]*noopener/);
  });

  it("masks emails", () => {
    expect(maskEmail("alex.rivera@example.com")).not.toContain("alex.rivera");
  });
});

describe("CSV", () => {
  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toMatch(/^"'=/);
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("round-trips quotes, commas and newlines", () => {
    const csv = toCsv(["a", "b"], [["x, y", 'say "hi"\nnext']]);
    expect(parseCsv(csv)).toEqual([["a", "b"], ["x, y", 'say "hi"\nnext']]);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers when the window slides", () => {
    let t = 0;
    const rl = createRateLimiter(3, 1000, () => t);
    expect([rl.hit("k").ok, rl.hit("k").ok, rl.hit("k").ok]).toEqual([true, true, true]);
    const blocked = rl.hit("k");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(rl.hit("other").ok).toBe(true);
    t = 1001;
    expect(rl.hit("k").ok).toBe(true);
  });
});

describe("CSRF double-submit", () => {
  const token = "a".repeat(43);
  it("accepts only an exact, well-formed match", () => {
    expect(csrfMatches(token, token)).toBe(true);
    expect(csrfMatches(token, "b".repeat(43))).toBe(false);
    expect(csrfMatches(token, null)).toBe(false);
    expect(csrfMatches(undefined, token)).toBe(false);
    expect(csrfMatches("short", "short")).toBe(false);
  });
});

describe("log redaction", () => {
  it("removes secrets and masks contact details at any depth", () => {
    const out = JSON.stringify(redact({ password: "hunter2", nested: { token: "t", email: "alex.rivera@example.com", phone: "+63 917 555 0142" } }));
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain('"t"');
    expect(out).not.toContain("alex.rivera@");
    expect(out).not.toContain("555 0142");
  });
});
