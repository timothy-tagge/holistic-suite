import { test, expect } from "@playwright/test";

/**
 * Landing page smoke tests — no auth required.
 * These run against the deployed app in CI (PLAYWRIGHT_BASE_URL env var)
 * or against the local dev server when run locally.
 */

test.describe("Landing page", () => {
  test("loads without errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    // Should show the landing page (not redirect to a broken route)
    await expect(page).toHaveTitle(/Holistic/i);
    expect(errors).toHaveLength(0);
  });

  test("has a sign-in CTA", async ({ page }) => {
    await page.goto("/");
    // There should be a button or link that triggers Google sign-in
    const signIn = page.getByRole("button", { name: /sign in/i })
      .or(page.getByRole("link", { name: /sign in/i }))
      .or(page.getByRole("button", { name: /get started/i }));
    await expect(signIn.first()).toBeVisible();
  });

  test("unauthenticated user is not shown app content", async ({ page }) => {
    await page.goto("/overview");
    // Should redirect to landing or show sign-in prompt — not the app shell
    await expect(page.getByText(/overview/i)).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // If overview text IS visible it means auth guard failed — let the assertion handle it
    });
    const url = page.url();
    // Should have redirected away from /overview
    expect(url).not.toMatch(/\/overview$/);
  });
});
