import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoHorizontalOverflow, signIn } from "./helpers";

test.describe("access control", () => {
  test("anonymous visitors are sent to the right sign-in page", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("off-site redirect targets are ignored after sign-in", async ({ page }) => {
    await page.goto("/login?next=//evil.example", { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: /email/i }).fill(ACCOUNTS.customer.email);
    await page.locator('input[name="password"]').fill(ACCOUNTS.customer.password);
    await page.getByRole("button", { name: /^sign in/i }).click();
    await page.waitForURL((u) => u.hostname === "localhost");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("customers cannot use the staff portal", async ({ page }) => {
    await signIn(page, "admin", ACCOUNTS.customer);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("admin APIs reject anonymous and cross-site requests", async ({ request }) => {
    expect((await request.get("/api/admin/export/orders")).status()).toBeGreaterThanOrEqual(401);
    const upload = await request.post("/api/admin/upload", { headers: { origin: "https://evil.example" }, multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect([401, 403]).toContain(upload.status());
  });
});

test.describe("staff roles", () => {
  test("super admin sees every area", async ({ page }) => {
    await signIn(page, "admin", ACCOUNTS.superAdmin);
    await page.waitForURL(/\/admin(\?|$)/);
    for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/customers", "/admin/promotions", "/admin/audit"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("catalog managers are kept out of customer data", async ({ page }) => {
    await signIn(page, "admin", ACCOUNTS.catalog);
    await page.waitForURL(/\/admin(\?|$)/);
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/denied=customers%3Aview/);
    await expect(page.getByRole("alert").filter({ hasText: /can't open that page/i })).toBeVisible();
  });

  test("fulfillment support cannot edit the catalog", async ({ page }) => {
    await signIn(page, "admin", ACCOUNTS.support);
    await page.waitForURL(/\/admin(\?|$)/);
    await page.goto("/admin/products/new");
    await expect(page).toHaveURL(/denied=catalog%3Awrite/);
  });
});
