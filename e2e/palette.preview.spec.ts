import { expect, test, type Page } from "@playwright/test";
import { resetE2EPets, seedE2EPet, seedSession } from "./auth";

/**
 * Not a test — a camera.
 *
 * The palette experiment moves two hues between roles, and every surface
 * follows, so the only way to judge it is to look at the surfaces. This seeds
 * a fixture shaped to show each one — a met goal, a birthday a week out, a
 * filled clinic — and writes four screenshots per variant. It asserts nothing
 * beyond what it needs to wait for.
 *
 * Delete it when the palette is settled.
 */

const variant = process.env.PALETTE ?? "x";
const OUT =
  "/private/tmp/claude-501/-Users-mikel-workspace-petfile/85078444-bed0-4667-9c98-ada6f824c6c8/scratchpad";

// A phone, because that is the only place this palette is ever seen.
test.use({ viewport: { width: 412, height: 915 } });

/** A birthday a week out: the countdown shows, and the cake is in this month. */
function birthdayInAWeek(): string {
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `2021-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`;
}

test.beforeEach(async ({ page }) => {
  await resetE2EPets();
  await seedE2EPet({
    exercise_goal_minutes: 60,
    birth_date: birthdayInAWeek(),
  });
  await seedSession(page);
});

test.afterEach(async () => {
  await resetE2EPets();
});

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${variant}-${name}.png` });
}

test("every surface the two accents land on", async ({ page }) => {
  // Salud: headings and links, the segmented track, the floating action.
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

  // The diary: the goal bar once it is met, and the floating action.
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

  // The calendar: today's ring, the selected day, the birthday's cake and the
  // goal's own mark, all in one grid.
  await page.getByTestId("home-date").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();
  await page.waitForTimeout(600);
  await shoot(page, "calendario");
  const box = await page.getByTestId("home-calendar-scrim").boundingBox();
  await page
    .getByTestId("home-calendar-scrim")
    .click({ position: { x: 8, y: (box?.height ?? 900) - 8 } });

  // The profile: the birthday countdown, and the buttons under it.
  await page.goto("/profile");
  await expect(page.getByTestId("profile-countdown")).toBeVisible();
  await page.waitForTimeout(400);
  await shoot(page, "perfil");
});
