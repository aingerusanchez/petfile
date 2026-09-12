import { expect, test, type Page } from "@playwright/test";
import { resetE2EPets, seedE2EPet, seedSession } from "./auth";

/**
 * Not a test — a camera.
 *
 * The palette experiment swaps two token values and every surface follows by
 * role, so the only way to judge it is to look at the surfaces. This seeds the
 * same fixture the health suite uses, fills in the things that actually wear
 * the accents, and writes four screenshots. It asserts nothing.
 *
 * Delete it when the palette is settled.
 */

const variant = process.env.PALETTE ?? "x";

// A phone, because that is the only place this palette is ever seen.
test.use({ viewport: { width: 412, height: 915 } });

test.beforeEach(async ({ page }) => {
  await resetE2EPets();
  await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedSession(page);
});

test.afterEach(async () => {
  await resetE2EPets();
});

async function shoot(page: Page, name: string) {
  await page.screenshot({
    path: `/private/tmp/claude-501/-Users-mikel-workspace-petfile/85078444-bed0-4667-9c98-ada6f824c6c8/scratchpad/${variant}-${name}.png`,
    fullPage: false,
  });
}

test("the surfaces that wear the two accents", async ({ page }) => {
  // Salud: section headings and links in the secondary, the floating action
  // and the segmented track in the primary.
  await page.goto("/health");
  await expect(page.getByTestId("health-title")).toBeVisible();

  await page.getByTestId("vet-primary-edit").click();
  await page.getByTestId("vet-primary-clinic").fill("Clínica Los Burros");
  await page.getByTestId("vet-primary-vet").fill("Espe");
  await page.getByTestId("vet-primary-phone").fill("944 26 00 51");
  await page
    .getByTestId("vet-primary-address")
    .fill("Aguirre Lehendakaria 7, Basauri");
  await page
    .getByTestId("vet-primary-hours")
    .fill("L-V 10:30-14:00 y 17:00-20:00\nS 10:00-13:00");
  await page.getByTestId("vet-primary-save").click();
  await expect(page.getByTestId("vet-primary-call")).toBeVisible();

  // The toast sits over the card it is about; it goes on its own.
  await page.waitForTimeout(4500);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(500);
  await shoot(page, "salud");

  // The diary: the goal bar in the secondary once it is met, the floating
  // action and today's ring in the primary.
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toBeVisible();
  await page.getByTestId("home-prev-day").click();

  await page.getByTestId("home-add").click();
  await page.getByTestId("home-add-walk").click();
  await page.getByTestId("entry-from").fill("0900");
  await page.getByTestId("entry-to").fill("1030");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("Objetivo");
  await page.waitForTimeout(4500);
  await shoot(page, "diario");

  // And the clock face, which is the newest thing wearing the primary.
  await page.getByTestId("home-add").click();
  await page.getByTestId("home-add-meal").click();
  await page.getByTestId("entry-time").fill("0915");
  await page.getByTestId("entry-time-picker").click();
  await expect(page.getByTestId("timepicker-preview")).toBeVisible();
  await shoot(page, "reloj");
});
