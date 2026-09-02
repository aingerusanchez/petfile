import { expect, test } from "@playwright/test";
import { resetE2EPets, seedSession } from "./auth";

test.beforeAll(async () => {
  // Onboarding tests create a real pet against the live database. Reset
  // first so repeated runs don't accumulate duplicate rows for the e2e
  // account, and so "registers a pet" starts from a known no-pet state.
  await resetE2EPets();
});

test("blocks submission until the required fields are filled", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-submit").click();

  await expect(page.getByTestId("onboarding-error")).toBeVisible();
});

test("registers a pet and lands on the day view", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-name").fill("Loki");
  await page.getByTestId("onboarding-sex-male").click();
  await page.getByTestId("onboarding-breed").fill("Husky Siberiano");
  await page.getByTestId("onboarding-birthdate").fill("2025-09-14");
  await page.getByTestId("onboarding-submit").click();

  await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 15_000 });
});
