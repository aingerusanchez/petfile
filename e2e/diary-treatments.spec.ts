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
 * What Salud records, read back on the day it happened — in a TRATAMIENTOS
 * section between the day's goal block and its log. A treatment is context for
 * reading the day, not an entry in it, so these specs pin the arrangement: the
 * section is above the log, absent on a day without treatments, and the log
 * under it is the log it always was.
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

test("a treatment recorded in Salud shows in the section of its day, and only that day", async ({
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

  const section = page.getByTestId("home-treatments");
  await expect(section).toContainText("Milbemax 125mg");
  // The kind and the next date, from the three-month proposal the form made.
  await expect(section).toContainText("Desparasitación (Int.)");
  await expect(section).toContainText("Próxima");
  // No hour: nobody wrote one down, and a clock here would be invented.
  await expect(section).not.toContainText(/\d{1,2}:\d{2}/);
  // The log is the log: nothing was written in the diary, and it says so. The
  // treatment is visibly another section, above it.
  await expect(page.getByTestId("home-empty")).toBeVisible();
  await expect(page.getByTestId("home-log")).toHaveCount(0);

  // Another day has no section at all — and is empty in the same way.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");
  await expect(page.getByTestId("home-treatments")).toHaveCount(0);
  await expect(page.getByTestId("home-empty")).toContainText(
    "Ese día no se apuntó nada",
  );
});

test("the section sits between the goal block and the log, not inside it", async ({
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

  const goal = page.getByTestId("home-goal");
  const section = page.getByTestId("home-treatments");
  const log = page.getByTestId("home-log");
  await expect(page.getByTestId(`home-entry-${ids[2]}`)).toBeVisible();
  await expect(section).toContainText("Milbemax 125mg");

  const goalBox = await goal.boundingBox();
  const sectionBox = await section.boundingBox();
  const logBox = await log.boundingBox();
  const bottom = (box: typeof goalBox) => (box?.y ?? 0) + (box?.height ?? 0);
  // Measure, then its context, then the stream — in that order.
  expect(sectionBox?.y ?? 0).toBeGreaterThanOrEqual(bottom(goalBox));
  expect(logBox?.y ?? 0).toBeGreaterThanOrEqual(bottom(sectionBox));

  // A sibling of the log rather than a row in it: the log holds the three
  // timed entries and no treatment, and the section is its own outlined group
  // with no hairline of its own to separate anything from anything.
  await expect(log).not.toContainText("Milbemax");
  await expect(log.getByTestId(/^home-entry-/)).toHaveCount(3);
  await expect(section.getByTestId(/^home-entry-/)).toHaveCount(0);
  await expect(section.getByTestId(/^home-treatment-[0-9a-f]/)).toHaveCount(1);
  await expect(page.getByTestId("home-empty")).toHaveCount(0);
});

test("a day with a treatment and no events shows the log's own empty state under the section", async ({
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

  const section = page.getByTestId("home-treatments");
  const empty = page.getByTestId("home-empty");
  await expect(section).toContainText("Milbemax 125mg");
  // True: nothing was logged in the diary that day. The treatment is a
  // different section, visibly above it.
  await expect(empty).toContainText("Ese día no se apuntó nada");
  await expect(page.getByTestId("home-log")).toHaveCount(0);
  const sectionBox = await section.boundingBox();
  const emptyBox = await empty.boundingBox();
  expect(emptyBox?.y ?? 0).toBeGreaterThanOrEqual(
    (sectionBox?.y ?? 0) + (sectionBox?.height ?? 0),
  );
});

test("a treatment reads as three lines: the name, the kind, the next date", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
      // More than a year on, so it is another year whatever today is — the
      // case that used to leave "2027" alone on a second line.
      nextDueOn: iso(daysFromNow(400)),
    },
  ]);

  await openYesterday(page);

  const row = page.getByTestId(/^home-treatment-[0-9a-f]/);
  const name = row.getByText("Milbemax 125mg", { exact: true });
  const kind = row.getByText("Desparasitación (Int.)", { exact: true });
  const next = row.getByText(/^Próxima \d{1,2} [a-zñ]{3,4} \d{4}$/);
  await expect(name).toBeVisible();
  await expect(kind).toBeVisible();
  await expect(next).toBeVisible();

  const [nameBox, kindBox, nextBox] = await Promise.all([
    name.boundingBox(),
    kind.boundingBox(),
    next.boundingBox(),
  ]);
  // Each on its own line, in that order, and each a single line tall: the
  // date is not wrapped over two.
  const lineHeight = nameBox?.height ?? 0;
  expect(kindBox?.y ?? 0).toBeGreaterThanOrEqual(
    (nameBox?.y ?? 0) + lineHeight - 1,
  );
  expect(nextBox?.y ?? 0).toBeGreaterThanOrEqual(
    (kindBox?.y ?? 0) + (kindBox?.height ?? 0) - 1,
  );
  expect(nextBox?.height ?? 0).toBeLessThan((lineHeight || 1) * 1.5);
  expect(kindBox?.height ?? 0).toBeLessThan((lineHeight || 1) * 1.5);
});

test("a treatment with no name leads with its kind, and one with no next date has two lines", async ({
  page,
}) => {
  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    {
      kind: "vaccine",
      administeredOn: iso(yesterday),
      nextDueOn: iso(daysFromNow(300)),
    },
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
  // No name: the kind is the title and is not said twice, so the date follows
  // it directly.
  const unnamed = rows.nth(0);
  await expect(unnamed.getByText("Vacuna", { exact: true })).toHaveCount(1);
  await expect(unnamed).toContainText(/Próxima \d{1,2} [a-zñ]{3,4} \d{4}/);
  // No next date: the name and the kind, and nothing after them.
  const oneOff = rows.nth(1);
  await expect(oneOff).toContainText("Milbemax 125mg");
  await expect(oneOff).toContainText("Desparasitación (Int.)");
  await expect(oneOff).not.toContainText("Próxima");
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

/**
 * Park the treatments read, so "while they are on their way" is a state the
 * test can stand in rather than a frame it has to catch.
 */
async function parkTreatments(page: Page): Promise<() => void> {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/pet_treatments*", async (route) => {
    if (route.request().method() === "GET") await held;
    await route.continue();
  });
  return release;
}

test("the log paints as soon as the events land, treatments or no treatments", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: daysFromNow(-1, 9), durationMinutes: 30 },
  ]);
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  // The treatments are a second request on a timeout of its own: a day whose
  // entries landed must not sit behind twelve seconds of it.
  const release = await parkTreatments(page);
  await openYesterday(page);

  await expect(page.getByTestId("home-log")).toBeVisible();
  await expect(page.getByTestId("home-log-skeleton")).toBeHidden();
  await expect(page.getByTestId("home-log")).toContainText("Paseo");
  // The section is not there yet, and nothing claims it is.
  await expect(page.getByTestId("home-treatments")).toHaveCount(0);

  release();
  await expect(page.getByTestId("home-treatments")).toContainText(
    "Milbemax 125mg",
  );
});

test("a day with nothing in the diary says so at once; the section joins when its read lands", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  const release = await parkTreatments(page);
  await openYesterday(page);

  // The empty state no longer knows about treatments: nothing was logged in
  // the diary, which is true whether or not the other read has come back.
  await expect(page.getByTestId("home-empty")).toContainText(
    "Ese día no se apuntó nada",
  );
  await expect(page.getByTestId("home-treatments")).toHaveCount(0);

  release();
  // The section appears above it, and the empty state stays what it was.
  await expect(page.getByTestId("home-treatments")).toContainText(
    "Milbemax 125mg",
  );
  await expect(page.getByTestId("home-empty")).toContainText(
    "Ese día no se apuntó nada",
  );
});

test("a failed treatments read draws no section, and the log is unaffected", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: daysFromNow(-1, 9), durationMinutes: 30 },
  ]);
  // A treatment on the day, so the section would be drawn if the read had
  // worked: its absence below is the failure's doing and nothing else's.
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);
  // Refused rather than aborted: a 500 is an answer, so the read fails at once.
  await page.route("**/rest/v1/pet_treatments*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "e2e: the treatments cannot be read" }),
    });
  });
  // An absent section is also what a read still in flight looks like, so the
  // assertions wait for the refusal to come back and for the app a beat to
  // take it in. A section drawn on failure would still be there after that.
  const refused = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/rest/v1/pet_treatments") &&
      response.status() === 500,
  );

  await openYesterday(page);
  await refused;
  await page.waitForTimeout(600);

  // Nothing of the section: no heading, no line, no retry.
  await expect(page.getByTestId("home-treatments")).toHaveCount(0);
  await expect(page.getByTestId("home-treatments-retry")).toHaveCount(0);
  await expect(page.getByText("Milbemax 125mg")).toHaveCount(0);
  // The log is the log: its rows, no error of its own.
  await expect(page.getByTestId("home-log")).toContainText("Paseo");
  await expect(page.getByTestId("home-log-error")).toHaveCount(0);
});

test("a failed log says so straight away, treatments or no treatments", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  const release = await parkTreatments(page);
  // Refused rather than aborted: a 500 is an answer, so the read fails at
  // once instead of waiting out the twelve-second ceiling, and the branch
  // under test is the same one either way.
  await page.route("**/rest/v1/pet_events*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "e2e: the log cannot be read" }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("home-title")).toHaveText("Hoy");

  // The log's own error and its own Reintentar, not held behind an unrelated
  // request: the vaccines ride along, and their failure does not.
  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-log-retry")).toBeVisible();

  release();
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

test("the calendar marks nothing until the events for the window arrive", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: daysFromNow(-1, 9), durationMinutes: 90 },
  ]);
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  await openYesterday(page);
  await expect(page.getByTestId("home-treatments")).toBeVisible();

  // The treatments are in hand before the calendar is opened — so park the
  // window's read, which is the only thing that can say what was walked.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/pet_events*", async (route) => {
    if (route.request().method() === "GET") await held;
    await route.continue();
  });

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();

  // Nothing is marked yet. Drawing the ring now would also draw the day as
  // "objetivo sin conseguir" — a claim about a 90-minute walk the grid has
  // not read.
  await expect(page.getByTestId("calendar-mark-medication")).toHaveCount(0);
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel(`${yesterday.getDate()}, sin registros`)
      .first(),
  ).toBeVisible();

  release();
  await expect(page.getByTestId("calendar-mark-medication")).toHaveCount(1);
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel(`${yesterday.getDate()}, día cumplido, con medicación`)
      .first(),
  ).toBeVisible();
});

test("a calendar whose window could not be read marks nothing, and says so", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Milbemax 125mg",
      administeredOn: iso(yesterday),
    },
  ]);

  await openYesterday(page);
  await expect(page.getByTestId("home-treatments")).toBeVisible();

  // Only the calendar's read fails: the day was read before this route
  // existed. A 500 is an answer, so it fails at once.
  await page.route("**/rest/v1/pet_events*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "e2e: the window cannot be read" }),
    });
  });

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();
  await expect(page.getByTestId("calendar-marks-error")).toBeVisible();

  // The treatments are in hand, and the grid has not read a single walk, so
  // drawing the ring would also say "objetivo sin conseguir" about a window
  // nobody looked at — beneath the line saying it could not look.
  await expect(page.getByTestId("calendar-mark-medication")).toHaveCount(0);
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel(`${yesterday.getDate()}, sin registros`)
      .first(),
  ).toBeVisible();
});

test("a vaccine day wears the watermark and the ring", async ({ page }) => {
  const petId = await seedE2EPet();
  // No next date, so the only cell in play is the day it was given.
  await seedE2ETreatments(petId, [
    { kind: "vaccine", name: "Rabia", administeredOn: iso(yesterday) },
  ]);

  await openYesterday(page);
  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();

  // Both, on purpose: the watermark is the day's ground — what the date is —
  // and the ring is something somebody logged. The same two registers the
  // birthday cake already layers with, so a vaccine needs no exception to
  // keep it out of "something medical happened here".
  await expect(page.getByTestId("calendar-mark-vaccine")).toHaveCount(1);
  await expect(page.getByTestId("calendar-mark-medication")).toHaveCount(1);
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel(
        `${yesterday.getDate()}, vacuna puesta, objetivo sin conseguir, con medicación`,
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
