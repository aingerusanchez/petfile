import { expect, test } from "@playwright/test";
import { seedSession } from "./auth";

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
