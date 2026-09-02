import { expect, test } from "@playwright/test";
import { seedSession } from "./auth";

test("offers Google sign-in and starts the OAuth flow", async ({ page }) => {
  await page.goto("/login");

  const button = page.getByTestId("login-google");
  await expect(button).toBeVisible();

  await button.click();
  await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 });
});

test("sends an authenticated visitor past the login screen", async ({ page }) => {
  await seedSession(page);
  await page.goto("/");

  // Where a signed-in visitor lands next (onboarding vs. home) depends on
  // whether the e2e account already has a pet, which onboarding.spec.ts
  // changes across runs. This test only needs to prove the seeded session
  // is recognized and the visitor is moved past /login — not which
  // authenticated screen they land on.
  await expect(
    page.locator('[data-testid="onboarding-name"], [data-testid="home-title"]'),
  ).toBeVisible({ timeout: 15_000 });
});
