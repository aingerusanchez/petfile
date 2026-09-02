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

  await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 15_000 });
});
