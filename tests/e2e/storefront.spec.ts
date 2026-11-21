import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers";

const ROUTES = ["/", "/products", "/products/iphone-15-pro", "/cart", "/login", "/register", "/support"];

test.describe("storefront layout", () => {
  for (const route of ROUTES) {
    test(`${route} renders without horizontal overflow`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("320px phones still fit", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const route of ["/", "/products", "/products/iphone-15-pro"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("ships security headers", async ({ page }) => {
    const res = await page.goto("/");
    const h = res!.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
  });

  test("unknown pages offer search instead of a dead end", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("searchbox", { name: /search products/i })).toBeVisible();
  });

  test("search with a typo still finds products", async ({ page }) => {
    await page.goto("/products?q=iphnoe");
    await expect(page.getByText(/iphone/i).first()).toBeVisible();
  });
});

test.describe("bag", () => {
  test("adding a product updates the bag with server-calculated prices", async ({ page }) => {
    await page.goto("/products/iphone-15-pro", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /add to bag/i }).first().click();
    await page.goto("/cart");
    await expect(page.getByText(/iphone 15 pro/i).first()).toBeVisible();
    await expect(page.getByText(/₱/).first()).toBeVisible();
  });
});
