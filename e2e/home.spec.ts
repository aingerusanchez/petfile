import { expect, test } from "@playwright/test";
import {
  eventsTableExists,
  resetE2EPets,
  seedE2EPet,
  seedSession,
} from "./auth";

/**
 * The day view's log needs `0006_events_weights_treatments.sql` applied.
 *
 * Until it is, these skip with a message that names the migration rather than
 * failing for a reason that has nothing to do with the app — and they start
 * running by themselves the moment it lands, which is the point of probing at
 * runtime instead of leaving a commented-out file behind.
 */
let ready = false;

test.beforeAll(async () => {
  ready = await eventsTableExists();
});

test.beforeEach(async () => {
  await resetE2EPets();
  await seedE2EPet({ exercise_goal_minutes: 60 });
});

test.afterAll(async () => {
  await resetE2EPets();
});

test("shows the day, the goal and a way to log each kind", async ({ page }) => {
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
  await expect(page.getByTestId("home-date")).not.toBeEmpty();

  // The goal only appears once the profile has set one.
  await expect(page.getByTestId("home-goal")).toContainText("de 60 min");

  for (const kind of ["walk", "meal", "medication", "incident"]) {
    await expect(page.getByTestId(`home-add-${kind}`)).toBeVisible();
  }
});

test("keeps the screen standing when the log cannot be read", async ({
  page,
}) => {
  test.skip(ready, "only reachable while 0006 is unapplied");

  await seedSession(page);
  await page.goto("/");

  // One component's failure must not block the whole interface: the header,
  // the goal and the four actions all come from the pet and stay.
  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(page.getByTestId("home-add-walk")).toBeVisible();
});

test("logs a walk and counts it toward the goal", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-empty")).toBeVisible();
  await expect(page.getByTestId("home-goal")).toContainText("0 de 60");

  await page.getByTestId("home-add-walk").click();

  // The time comes prefilled with now, so confirming is the common case.
  await expect(page.getByTestId("entry-time")).not.toBeEmpty();
  await page.getByTestId("entry-time").fill("09:15");
  await page.getByTestId("entry-value").fill("30");
  await page.getByTestId("entry-note").fill("Tranquilo, sin tirones");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-log")).toBeVisible();
  await expect(page.getByTestId("home-log")).toContainText("09:15");
  await expect(page.getByTestId("home-log")).toContainText("Paseo");
  await expect(page.getByTestId("home-log")).toContainText("30 min");
  await expect(page.getByTestId("home-log")).toContainText("sin tirones");

  // The walk's minutes are the one thing the day view computes from.
  await expect(page.getByTestId("home-goal")).toContainText("30 de 60");
});

test("logs the other three kinds without touching the goal", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  for (const [kind, what] of [
    ["meal", "Pienso"],
    ["medication", "Apoquel"],
    ["incident", "Cojea de la pata derecha"],
  ] as const) {
    await page.getByTestId(`home-add-${kind}`).click();
    await page.getByTestId("entry-value").fill(what);
    await page.getByTestId("entry-save").click();
    await expect(page.getByTestId("home-log")).toContainText(what);
  }

  // None of them has a duration, so the goal has not moved.
  await expect(page.getByTestId("home-goal")).toContainText("0 de 60");
});

test("refuses a time that is not one", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-add-walk").click();
  await page.getByTestId("entry-time").fill("99:99");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("entry-time-error")).toHaveText(
    "Escríbela como 09:15",
  );
});

test("marks the goal met, once", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-add-walk").click();
  await page.getByTestId("entry-value").fill("60");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-goal")).toContainText(
    "Objetivo cumplido",
  );
});
