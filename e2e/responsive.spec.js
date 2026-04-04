import { test, expect, devices } from "@playwright/test";

/**
 * Responsive / mobile usability tests.
 *
 * These run on every build across three viewports (desktop, mobile, tablet)
 * via the project configs in playwright.config.js. Tests here are scoped to
 * unauthenticated pages (landing + header) so they work in CI without Google auth.
 *
 * Coverage:
 *  - No horizontal scroll on landing page at any viewport
 *  - AppHeader hamburger visible on mobile, hidden on tablet/desktop
 *  - Mobile menu opens and exposes nav links with adequate touch targets
 *  - Key CTA buttons meet minimum touch target height (40px)
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the page body overflows horizontally. */
async function hasHorizontalScroll(page) {
  return page.evaluate(() => document.body.scrollWidth > window.innerWidth);
}

/** Returns the bounding box of the first matching locator, or null. */
async function boundingBox(locator) {
  return locator.first().boundingBox();
}

// ── Mobile (Pixel 5 — 393×851px, below sm: 640px breakpoint) ─────────────────

test.describe("Mobile viewport (Pixel 5)", () => {
  test.use({ ...devices["Pixel 5"] });

  test("landing page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("hamburger menu button is visible", async ({ page }) => {
    await page.goto("/");
    const menuBtn = page.getByRole("button", { name: /open menu/i });
    await expect(menuBtn).toBeVisible();
  });

  test("desktop nav tabs are hidden on mobile", async ({ page }) => {
    await page.goto("/");
    // The desktop nav has aria-label="Module navigation" and is hidden via CSS
    // Check that the visible navigation text links are not present directly (hamburger is instead)
    const desktopNav = page.getByRole("navigation", { name: "Module navigation" });
    // It exists in DOM but should not be visible (hidden sm:flex)
    await expect(desktopNav).not.toBeVisible();
  });

  test("mobile menu opens and shows nav links", async ({ page }) => {
    await page.goto("/");
    const menuBtn = page.getByRole("button", { name: /open menu/i });
    await menuBtn.click();

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNav).toBeVisible();

    // Built nav items should be present as links
    await expect(mobileNav.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Dividends" })).toBeVisible();
  });

  test("mobile menu closes when a nav link is clicked", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNav).toBeVisible();

    // Click a nav link — menu should close (redirects to auth guard, menu state clears)
    await mobileNav.getByRole("link", { name: "Overview" }).click();
    await expect(mobileNav).not.toBeVisible();
  });

  test("mobile menu nav links have adequate touch target height (≥44px)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    const overviewLink = mobileNav.getByRole("link", { name: "Overview" });
    const box = await boundingBox(overviewLink);
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("sign-in CTA meets minimum touch target height (≥40px)", async ({ page }) => {
    await page.goto("/");
    const signInBtn = page
      .getByRole("button", { name: /sign in/i })
      .or(page.getByRole("button", { name: /get started/i }));
    const box = await boundingBox(signInBtn);
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(40);
  });

  test("page loads without JS errors on mobile", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    expect(errors).toHaveLength(0);
  });
});

// ── Tablet (768×1024px — sm: breakpoint active) ───────────────────────────────

test.describe("Tablet viewport (768px)", () => {
  test.use({ browserName: "chromium", viewport: { width: 768, height: 1024 } });

  test("landing page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("desktop nav tabs are visible on tablet", async ({ page }) => {
    await page.goto("/");
    // At 768px the sm: breakpoint is active — desktop nav should show
    const desktopNav = page.getByRole("navigation", { name: "Module navigation" });
    await expect(desktopNav).toBeVisible();
  });

  test("hamburger button is hidden on tablet", async ({ page }) => {
    await page.goto("/");
    const menuBtn = page.getByRole("button", { name: /open menu/i });
    await expect(menuBtn).not.toBeVisible();
  });

  test("page loads without JS errors on tablet", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    expect(errors).toHaveLength(0);
  });
});

// ── Desktop ───────────────────────────────────────────────────────────────────

test.describe("Desktop viewport", () => {
  // Uses the default Desktop Chrome project (1280px)

  test("landing page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("desktop nav is visible and hamburger is hidden", async ({ page }) => {
    await page.goto("/");
    const desktopNav = page.getByRole("navigation", { name: "Module navigation" });
    await expect(desktopNav).toBeVisible();

    const menuBtn = page.getByRole("button", { name: /open menu/i });
    await expect(menuBtn).not.toBeVisible();
  });

  test("all nav tabs are present", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Module navigation" });
    await expect(nav.getByText("Overview")).toBeVisible();
    await expect(nav.getByText("College")).toBeVisible();
    await expect(nav.getByText("Alts")).toBeVisible();
    await expect(nav.getByText("Dividends")).toBeVisible();
    await expect(nav.getByText("Equity")).toBeVisible();
    await expect(nav.getByText("Property")).toBeVisible();
  });
});
