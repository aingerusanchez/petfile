import { expect, test } from "@playwright/test";
import { resetE2EPets, seedE2EPet, seedSession } from "./auth";

test.beforeEach(async () => {
  await resetE2EPets();
  await seedE2EPet({ exercise_goal_minutes: 90 });
});

test.afterAll(async () => {
  await resetE2EPets();
});

test("opens from the profile and says what it is for", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-settings").click();
  await expect(page.getByTestId("settings-title")).toHaveText("Ajustes");

  // Every option shows its own answer rather than naming it.
  await expect(page.getByTestId("settings-time-24h")).toHaveText("15:30");
  await expect(page.getByTestId("settings-time-12h")).toHaveText("3:30 p.m.");
  await expect(page.getByTestId("settings-duration-hours")).toHaveText(
    "1h 30m",
  );
  await expect(page.getByTestId("settings-duration-minutes")).toHaveText(
    "90 min",
  );

  // The build identifies itself here and on the login screen, which is what
  // a stale install could not do.
  await expect(page.getByTestId("settings-version")).toHaveText(
    /^v\d+\.\d+\.\d+$/,
  );

  await page.getByTestId("settings-back").click();
  await expect(page.getByTestId("profile-title")).toBeVisible();
});

test("carries the duration format into the day and the file", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");

  // The stored value is minutes either way; only the writing changes.
  await expect(page.getByTestId("profile-goal-value")).toHaveText("1h 30m");

  await page.getByTestId("profile-settings").click();
  await page.getByTestId("settings-duration-minutes").click();
  await page.getByTestId("settings-back").click();

  await expect(page.getByTestId("profile-goal-value")).toHaveText("90 min");

  await page.goto("/");
  await expect(page.getByTestId("home-goal")).toContainText("de 90 min");
});

test("keeps the preference across a reload", async ({ page }) => {
  await seedSession(page);
  await page.goto("/settings");

  await page.getByTestId("settings-duration-minutes").click();
  await expect(page.getByTestId("settings-duration-minutes")).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await page.reload();
  await expect(page.getByTestId("settings-duration-minutes")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("shows the build's version before anyone signs in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("login-version")).toHaveText(
    /^v\d+\.\d+\.\d+$/,
  );
});
