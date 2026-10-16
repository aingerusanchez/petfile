import { expect, test, type Page } from "@playwright/test";
import {
  eventsTableExists,
  resetE2EPets,
  seedE2EEvents,
  seedE2EPet,
  seedE2ETreatments,
  seedSession,
} from "./auth";

/**
 * What Salud records, read back on the day it happened.
 *
 * **Every clock time here is derived from a "now" this file owns, and the
 * fixed hours sit on yesterday** — a treatment has no hour, but the timed
 * entries it is read next to do, and a morning time typed onto today is a test
 * that fails half the day. See `e2e/home.spec.ts`.
 */

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (day: Date) =>
  `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

function daysFromNow(offset: number, hour = 12): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset,
    hour,
  );
}

const yesterday = daysFromNow(-1);

let ready = false;

test.beforeAll(async () => {
  ready = await eventsTableExists();
});

test.beforeEach(async ({ page }) => {
  await resetE2EPets();
  await seedSession(page);
});

test.afterAll(async () => {
  await resetE2EPets();
});

/** The diary on yesterday, where a seeded day lives. */
async function openYesterday(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");
}

test("a treatment recorded in Salud shows at the foot of its day, and only that day", async ({
  page,
}) => {
  await seedE2EPet();

  // The diary is open first and stays mounted: it is a tab, so this is the
  // case where a read at mount would keep showing the day as it was.
  await page.goto("/");
  await expect(page.getByTestId("home-empty")).toBeVisible();

  await page.getByRole("tab", { name: /Salud/ }).click();
  await page.getByTestId("health-add").click();
  await page.getByTestId("health-add-treatment").click();
  await page.getByTestId("treatment-kind-deworming").click();
  await page.getByTestId("treatment-name").fill("Milbemax 125mg");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText(
    "Milbemax 125mg",
  );

  await page.getByRole("tab", { name: /Diario/ }).click();

  const foot = page.getByTestId("home-treatments");
  await expect(foot).toContainText("Milbemax 125mg");
  // The kind and the next date, from the three-month proposal the form made.
  await expect(foot).toContainText("Desparasitación (Int.) · próxima");
  // No hour: nobody wrote one down, and a clock here would be invented.
  await expect(foot).not.toContainText(/\d{1,2}:\d{2}/);
  // The day is not empty any more, and says so by not claiming it.
  await expect(page.getByTestId("home-empty")).toBeHidden();
  await expect(page.getByTestId("home-log")).toBeVisible();

  // Another day has nothing at its foot — and is still empty.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");
  await expect(page.getByTestId("home-treatments")).toHaveCount(0);
  await expect(page.getByTestId("home-empty")).toContainText(
    "Ese día no se apuntó nada",
  );
});

test("a day with timed entries puts the treatment after them, under a hairline", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  const at = (hour: number) => daysFromNow(-1, hour);
  const ids = await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: at(9), durationMinutes: 30 },
    { kind: "meal", occurredAt: at(13), what: "Pienso" },
    { kind: "medication", occurredAt: at(20), what: "Apoquel" },
  ]);
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
      nextDueOn: iso(daysFromNow(89)),
    },
  ]);

  await openYesterday(page);

  const lastEntry = page.getByTestId(`home-entry-${ids[2]}`);
  const foot = page.getByTestId("home-treatments");
  await expect(lastEntry).toBeVisible();
  await expect(foot).toContainText("Milbemax 125mg");

  const entryBox = await lastEntry.boundingBox();
  const footBox = await foot.boundingBox();
  expect(footBox?.y ?? 0).toBeGreaterThan(
    (entryBox?.y ?? 0) + (entryBox?.height ?? 0),
  );

  // Separated from them by a hairline: only because there is something above
  // it to separate from.
  await expect(foot).toHaveCSS("border-top-width", "1px");
});

test("a day with a treatment and nothing else is not empty, and has no hairline", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  // No next date: a one-off says only its kind.
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  await openYesterday(page);

  await expect(page.getByTestId("home-empty")).toBeHidden();
  await expect(page.getByTestId("home-log")).toContainText("Milbemax 125mg");
  const foot = page.getByTestId("home-treatments");
  await expect(foot).toContainText("Desparasitación (Int.)");
  await expect(foot).not.toContainText("próxima");
  // Nothing above it, so nothing to separate it from.
  await expect(foot).toHaveCSS("border-top-width", "0px");
});

test("two treatments on one day are two rows, in the order they were written", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  // Two calls, so two transactions and two distinct `created_at`s: one insert
  // gives both the same timestamp and leaves the order to the id.
  await seedE2ETreatments(petId, [
    { kind: "vaccine", name: "Rabia", administeredOn: iso(yesterday) },
  ]);
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  await openYesterday(page);

  const rows = page.getByTestId(/^home-treatment-[0-9a-f]/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Rabia");
  await expect(rows.nth(1)).toContainText("Milbemax 125mg");
});

test("tapping a treatment opens its own sheet in Salud, once", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    { kind: "vaccine", name: "Rabia", administeredOn: iso(yesterday) },
  ]);
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  await openYesterday(page);
  await page
    .getByTestId(/^home-treatment-[0-9a-f]/)
    .filter({ hasText: "Milbemax 125mg" })
    .click();

  // Not the tab: the treatment. And the one tapped, not the first one.
  await expect(page.getByTestId("treatment-sheet")).toBeVisible();
  await expect(page.getByTestId("treatment-name")).toHaveValue(
    "Milbemax 125mg",
  );
  // The parameter was let go of once it had been used.
  await expect(page).not.toHaveURL(/treatment=/);

  // Close it without changing anything, leave, and come back: the sheet must
  // not reopen — that is what clearing the parameter is for.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByTestId("treatment-sheet")).toBeHidden();
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-treatments")).toBeVisible();
  await page.getByRole("tab", { name: /Salud/ }).click();
  await expect(page.getByTestId("health-title")).toBeVisible();
  await expect(page.getByTestId("treatment-sheet")).toBeHidden();

  // And asking for the same treatment again works as well as the first time.
  await page.getByRole("tab", { name: /Diario/ }).click();
  await page
    .getByTestId(/^home-treatment-[0-9a-f]/)
    .filter({ hasText: "Milbemax 125mg" })
    .click();
  await expect(page.getByTestId("treatment-sheet")).toBeVisible();
});

test("a dose corrected in Salud is corrected in the diary", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  await openYesterday(page);
  await page.getByTestId(/^home-treatment-[0-9a-f]/).click();
  await expect(page.getByTestId("treatment-sheet")).toBeVisible();
  await page.getByTestId("treatment-name").fill("Milbemax 250mg");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("treatment-sheet")).toBeHidden();

  // The row was a read, so there was never a second copy to leave behind.
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-treatments")).toContainText(
    "Milbemax 250mg",
  );
  await expect(page.getByTestId("home-treatments")).not.toContainText(
    "Milbemax 125mg",
  );
});

test("the calendar marks the day a treatment was given, as medication", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  // Opened from yesterday, so the grid is on the month that carries it even
  // when today is the first.
  await openYesterday(page);
  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();

  // The medication ring, and no new mark: one mark, one meaning.
  await expect(page.getByTestId("calendar-mark-medication")).toHaveCount(1);
  await expect(page.getByTestId("calendar-mark-incident")).toHaveCount(0);
  // A deworming is not a vaccine, so the watermark stays out of it.
  await expect(page.getByTestId("calendar-mark-vaccine")).toHaveCount(0);
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel(
        `${yesterday.getDate()}, objetivo sin conseguir, con medicación`,
      )
      .first(),
  ).toBeVisible();
});

test("a day with events and no treatments reads as it always did", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: daysFromNow(-1, 9), durationMinutes: 30 },
  ]);
  // A treatment on another day must not leak into this one.
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(daysFromNow(-3)),
    },
  ]);

  await openYesterday(page);

  await expect(page.getByTestId("home-log")).toBeVisible();
  await expect(page.getByTestId("home-treatments")).toHaveCount(0);
  await expect(page.getByTestId("home-log")).not.toContainText("Milbemax");
});
