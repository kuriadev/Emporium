import { expect, type Page } from "@playwright/test";

export const ACCOUNTS = {
  customer: { email: "alex.rivera@example.com", password: "Customer#2026" },
  superAdmin: { email: "admin@emporium.test", password: "Admin#Emporium2026" },
  catalog: { email: "catalog@emporium.test", password: "Catalog#Emporium2026" },
  support: { email: "support@emporium.test", password: "Support#Emporium2026" },
} as const;

export async function signIn(page: Page, scope: "customer" | "admin", account: { email: string; password: string }) {
  // Wait for hydration: the sandbox quick-fill pre-populates the form once React is live.
  await page.goto(scope === "admin" ? "/admin/login" : "/login", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /email/i }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: scope === "admin" ? /enter staff portal/i : /^sign in/i }).click();
}

/** Fails if the document is wider than the viewport (the zero-horizontal-overflow rule). */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `page is ${scrollWidth}px wide in a ${innerWidth}px viewport`).toBeLessThanOrEqual(innerWidth);
}
