import { expect, test, type Page } from "@playwright/test";
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

/**
 * The four kinds live behind the floating action now, so every add is two
 * taps. One helper rather than the pair spelled out twenty times.
 */
async function add(page: Page, kind: string) {
  await page.getByTestId("home-add").click();
  await page.getByTestId(`home-add-${kind}`).click();
}

/**
 * Dismisses the month calendar by its scrim.
 *
 * Aimed near the bottom on purpose: the calendar is the app's one
 * top-anchored sheet, so the scrim's centre — where a plain `click()` lands —
 * is inside the panel, and the click goes to the month's own arrows instead.
 */
async function closeCalendar(page: Page) {
  const box = await page.getByTestId("home-calendar-scrim").boundingBox();
  await page
    .getByTestId("home-calendar-scrim")
    .click({ position: { x: 8, y: (box?.height ?? 900) - 8 } });
  await expect(page.getByTestId("home-calendar")).toBeHidden();
}

test.beforeAll(async () => {
  ready = await eventsTableExists();
});

test.beforeEach(async () => {
  await resetE2EPets();
  await seedE2EPet({ exercise_goal_minutes: 60 });
});

/**
 * **These specs assume a working day, and that is a defect in them.**
 *
 * Many fill real clock times — 08:30, 09:15, 10:45 — and the sheet refuses an
 * entry in the future, correctly. Run at 00:20 and ten of them fail with
 * "¿Todavía no habéis vuelto?", which says nothing about the code. The
 * quarter-hour steppers have the mirror problem: counting 45 minutes back
 * from 00:20 lands on yesterday, which the sheet also refuses, correctly.
 *
 * Playwright's clock is not the way out. `setFixedTime` stops Reanimated
 * dead — the button's status animation reads progress from `Date.now()` and
 * never finishes, so Playwright waits forever for a control that never stops
 * moving — and `install` + `resume` patches the timers the app captures at
 * module load, after which the day view never renders at all. Both were
 * measured here.
 *
 * The fix is to derive every time in this file from a "now" the test owns,
 * and to give the steppers a fixture whose day has time behind it. Until
 * then: this file is green from roughly 09:00 to midnight and red before it.
 */

test.afterAll(async () => {
  await resetE2EPets();
});

test("shows the day, the goal and a way to log each kind", async ({ page }) => {
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
  await expect(page.getByTestId("home-date")).not.toBeEmpty();

  // The goal only appears once the profile has set one.
  await expect(page.getByTestId("home-goal")).toContainText("de 1h");

  // The kinds are behind the floating action, near the thumb, and the page
  // shows none of them until it is asked.
  await expect(page.getByTestId("home-add-walk")).toBeHidden();
  await page.getByTestId("home-add").click();
  for (const kind of ["walk", "meal", "medication", "incident"]) {
    await expect(page.getByTestId(`home-add-${kind}`)).toBeVisible();
  }

  // Four ways out; the scrim is one of them.
  await page.getByTestId("home-add-scrim").click();
  await expect(page.getByTestId("home-add-walk")).toBeHidden();
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
  await expect(page.getByTestId("home-add")).toBeVisible();
});

test("logs a walk from its two ends and counts it toward the goal", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-empty")).toBeVisible();
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 1h");

  await add(page, "walk");

  // The END comes prefilled with now — the entry happens after getting home,
  // so "now" is when the walk finished. The other two open empty, because a
  // proposed duration would be a fabricated walk one tap away.
  await expect(page.getByTestId("entry-to")).not.toBeEmpty();
  await expect(page.getByTestId("entry-from")).toBeEmpty();
  await expect(page.getByTestId("entry-duration")).toBeEmpty();

  await page.getByTestId("entry-from").fill("09:15");
  await page.getByTestId("entry-to").fill("09:45");

  // The duration is derived, which is the whole point of asking for the ends.
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");

  await page.getByTestId("entry-note").fill("Tranquilo, sin tirones");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-log")).toBeVisible();
  await expect(page.getByTestId("home-log")).toContainText("09:15");
  await expect(page.getByTestId("home-log")).toContainText("Paseo");
  await expect(page.getByTestId("home-log")).toContainText("30 min");
  await expect(page.getByTestId("home-log")).toContainText("sin tirones");

  // The walk's minutes are the one thing the day view computes from.
  await expect(page.getByTestId("home-goal")).toContainText("30 min de 1h");
});

test("counts back from the end when the duration is what changed", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("10:45");
  await page.getByTestId("entry-duration").fill("45");

  // The end is the time the tutor actually knows, so it never shifts: the
  // duration counts backwards from it.
  await expect(page.getByTestId("entry-from")).toHaveValue("10:00");
  await expect(page.getByTestId("entry-to")).toHaveValue("10:45");

  // And correcting either time re-derives the duration from the two of them.
  await page.getByTestId("entry-to").fill("11:00");
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");
  await expect(page.getByTestId("entry-from")).toHaveValue("10:00");
});

test("counts a walk up in quarters of an hour", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("09:45");

  // Nothing to take away from yet.
  await expect(page.getByTestId("entry-duration-minus")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-duration-plus").click();

  await expect(page.getByTestId("entry-duration")).toHaveValue("45 min");
  // The steppers count backwards from the end, exactly as typing a duration
  // does — the end is what the tutor is sure of.
  await expect(page.getByTestId("entry-from")).toHaveValue("09:00");
  await expect(page.getByTestId("entry-to")).toHaveValue("09:45");

  // And once past the hour the field says so, which is the point of the
  // readable form.
  await page.getByTestId("entry-duration-plus").click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");
  await page.getByTestId("entry-duration-plus").click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h 15m");

  await page.getByTestId("entry-duration-minus").click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");
  await expect(page.getByTestId("entry-from")).toHaveValue("08:45");

  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("1h");
});

test("takes a duration written in hours", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("11:30");
  await page.getByTestId("entry-duration").fill("1h 30m");
  await expect(page.getByTestId("entry-from")).toHaveValue("10:00");

  // Bare minutes still work, because that is what the field meant before.
  await page.getByTestId("entry-duration").fill("90");
  await expect(page.getByTestId("entry-from")).toHaveValue("10:00");
  // Tidied on blur rather than on every keystroke, which would fight typing.
  await page.getByTestId("entry-note").click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h 30m");
});

test("reopens an entry to correct it", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "meal");
  await page.getByTestId("entry-time").fill("08:00");
  await page.getByTestId("entry-value").fill("Pienso, 200 g");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("Pienso, 200 g");

  // The row is the way back in, and the sheet says it is an edit.
  await page.getByTestId("home-log").getByRole("button").first().click();
  await expect(page.getByTestId("entry-title")).toHaveText("Editar comida");
  await expect(page.getByTestId("entry-value")).toHaveValue("Pienso, 200 g");
  await expect(page.getByTestId("entry-time")).toHaveValue("08:00");

  await page.getByTestId("entry-value").fill("Pienso, 250 g");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-log")).toContainText("Pienso, 250 g");
  // A correction, not a second entry.
  await expect(page.getByTestId("home-log")).not.toContainText("200 g");
});

test("deletes an entry from its own sheet, asking once", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "medication");
  await page.getByTestId("entry-value").fill("Apoquel");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("Apoquel");

  await page.getByTestId("home-log").getByRole("button").first().click();
  // Delete is in the sheet, never in the list: a row in a scrolling list is a
  // mis-tap waiting to happen.
  await page.getByTestId("entry-delete").click();
  await expect(page.getByTestId("entry-delete-confirm")).toBeVisible();

  // And backing out of the question leaves the entry alone.
  await page.getByTestId("entry-delete-cancel").click();
  await expect(page.getByTestId("entry-delete")).toBeVisible();

  await page.getByTestId("entry-delete").click();
  await page.getByTestId("entry-delete-confirm").click();

  await expect(page.getByTestId("home-empty")).toBeVisible();
});

test("takes a time typed without the colon a number pad has not got", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  const to = page.getByTestId("entry-to");

  // Android's number pad offers digits and nothing else, so "900" has to be
  // first-class input. The last two digits are the minutes.
  await to.fill("");
  await to.pressSequentially("900");
  await expect(to).toHaveValue("900");

  // The colon arrives when focus leaves — the one correction the platform
  // honours. Inserting it as the digits arrive does not work on the device:
  // a focused TextInput on Android ignores a value JS rewrites.
  await page.getByTestId("entry-note").click();
  await expect(to).toHaveValue("09:00");

  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("09:00");
});

test("refuses a duration longer than a day, at the field", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("10:00");
  await page.getByTestId("entry-duration").fill("99h");

  // Counting back from the end would put DESDE on a previous day and render it
  // as an ordinary time, so nothing moves and the field says why.
  await expect(page.getByTestId("entry-duration-error")).toHaveText(
    "Como mucho 24 horas",
  );
  await expect(page.getByTestId("entry-from")).toBeEmpty();

  // Blurring discards it: the times are the truth.
  await page.getByTestId("entry-note").click();
  await expect(page.getByTestId("entry-duration")).toBeEmpty();
  await expect(page.getByTestId("entry-duration-error")).toBeHidden();
});

test("refuses an end that comes before its start", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("09:00");
  await page.getByTestId("entry-from").fill("10:00");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("entry-from-error")).toHaveText(
    "Tiene que ser antes de la hora de vuelta",
  );
});

test("still logs a walk nobody timed", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("08:30");
  await page.getByTestId("entry-save").click();

  // A walk with only an end is a valid entry: it still happened, and the end
  // is the only time anybody wrote down.
  await expect(page.getByTestId("home-log")).toContainText("08:30");
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 1h");
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
    await add(page, kind);
    // Only a walk is asked for as a range; the rest happened at a moment.
    await expect(page.getByTestId("entry-time")).not.toBeEmpty();
    await page.getByTestId("entry-value").fill(what);
    await page.getByTestId("entry-save").click();
    await expect(page.getByTestId("home-log")).toContainText(what);
  }

  // None of them has a duration, so the goal has not moved.
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 1h");
});

test("reads the day forwards", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // Logged out of order on purpose: the list is chronological, not
  // most-recently-entered.
  for (const at of ["11:30", "08:00", "09:45"]) {
    await add(page, "meal");
    await page.getByTestId("entry-time").fill(at);
    await page.getByTestId("entry-value").fill(`Comida de ${at}`);
    await page.getByTestId("entry-save").click();
    await expect(page.getByTestId("home-log")).toContainText(`Comida de ${at}`);
  }

  const log = await page.getByTestId("home-log").innerText();
  expect(log.indexOf("08:00")).toBeLessThan(log.indexOf("09:45"));
  expect(log.indexOf("09:45")).toBeLessThan(log.indexOf("11:30"));
});

test("refuses a time that is not one", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("99:99");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("entry-to-error")).toHaveText(
    "Escríbela como 09:15",
  );
});

test("walks back a day and forward again, and never into tomorrow", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
  // Nothing to log about a day that has not happened.
  await expect(page.getByTestId("home-next-day")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toHaveText("Ayer");
  await expect(page.getByTestId("home-next-day")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );

  // From two days back a person reaches for the weekday, not "anteayer".
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toHaveText(
    /^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/,
  );

  await page.getByTestId("home-next-day").click();
  await page.getByTestId("home-next-day").click();
  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
});

test("logs into the day on screen, not into today", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-empty")).toBeVisible();
  // A past day is not still going, so the empty state cannot say "todavía".
  await expect(page.getByTestId("home-empty")).toContainText(
    "Ese día no se apuntó nada",
  );

  await add(page, "meal");
  // The sheet says which day it writes to: the same form, opened a day back,
  // saves a day back.
  await expect(page.getByTestId("entry-day")).toHaveText(/^Ayer, \d+ de /);
  await page.getByTestId("entry-value").fill("Pienso de ayer");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-log")).toContainText("Pienso de ayer");

  // And today does not have it.
  await page.getByTestId("home-next-day").click();
  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
  await expect(page.getByTestId("home-log")).toBeHidden();
});

test("opens the calendar from the date and says what each day carried", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // Put two things on yesterday worth marking, of the two kinds that mark.
  await page.getByTestId("home-prev-day").click();
  await add(page, "incident");
  await page.getByTestId("entry-value").fill("Cojea de la pata");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("Cojea");
  await add(page, "medication");
  await page.getByTestId("entry-value").fill("Apoquel");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("Apoquel");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();

  // The mark is not colour alone: the day says it in words too — and it says
  // both things. The two marks used to collapse into the more severe one,
  // which threw the medication away on the day it mattered most.
  await expect(
    page
      .getByLabel(
        `${yesterday.getDate()}, objetivo sin conseguir, con incidencia, con medicación`,
      )
      .first(),
  ).toBeVisible();

  // Both are drawn, each in its own corner. One day carries them, so one of
  // each is on screen.
  await expect(page.getByTestId("calendar-mark-incident")).toHaveCount(1);
  await expect(page.getByTestId("calendar-mark-medication")).toHaveCount(1);

  // The legend names all three marks, so none of them is colour alone.
  for (const name of ["Objetivo conseguido", "Medicación", "Incidencia"]) {
    await expect(page.getByTestId("home-calendar")).toContainText(name);
  }

  // Choosing a day navigates and closes.
  await page
    .getByLabel(`${yesterday.getDate()},`, { exact: false })
    .first()
    .click();
  await expect(page.getByTestId("home-calendar")).toBeHidden();
  await expect(page.getByTestId("home-title")).toHaveText("Ayer");
});

test("throws confetti for the walk that reaches the goal, and only that one", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // 45 of the 60-minute goal: close, and not there.
  await add(page, "walk");
  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("45 min");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // The walk that crosses it.
  await add(page, "walk");
  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("Objetivo");
  await expect(page.getByTestId("celebration")).toBeVisible();

  // It reads as decoration, not as content: nothing to announce, nothing to
  // tap through.
  await expect(page.getByTestId("celebration")).toHaveAttribute(
    "aria-hidden",
    "true",
  );

  await page.reload();
  await expect(page.getByTestId("home-goal")).toContainText("Objetivo");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // A second walk on a day already won does not celebrate again.
  await add(page, "walk");
  await page.getByTestId("entry-duration-plus").click();
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("1h 15m");
  await expect(page.getByTestId("celebration")).toBeHidden();
});

test("does not celebrate a goal reached on a day that has passed", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-prev-day").click();
  await add(page, "walk");
  for (let i = 0; i < 4; i++) {
    await page.getByTestId("entry-duration-plus").click();
  }
  await page.getByTestId("entry-save").click();

  // Yesterday's goal is met, and filling in a day that has gone is
  // bookkeeping rather than an achievement.
  await expect(page.getByTestId("home-goal")).toContainText("Objetivo");
  await expect(page.getByTestId("celebration")).toBeHidden();
});

test("walks home from any day with one tap", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // On today it stays visible and inert rather than vanishing.
  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("calendar-today")).toBeVisible();
  await expect(page.getByTestId("calendar-today")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await closeCalendar(page);

  for (let i = 0; i < 4; i++) {
    await page.getByTestId("home-prev-day").click();
  }
  await expect(page.getByTestId("home-title")).not.toHaveText("Hoy");

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("calendar-today")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("calendar-today").click();

  // It navigates and closes in one tap.
  await expect(page.getByTestId("home-calendar")).toBeHidden();
  await expect(page.getByTestId("home-title")).toHaveText("Hoy");
});

test("names the birthday and marks it on the calendar", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const born = new Date();
  born.setFullYear(born.getFullYear() - 2);
  const iso = `${born.getFullYear()}-${String(born.getMonth() + 1).padStart(2, "0")}-${String(born.getDate()).padStart(2, "0")}`;

  await resetE2EPets();
  await seedE2EPet({ birth_date: iso, exercise_goal_minutes: 60 });
  await seedSession(page);
  await page.goto("/");

  // The day has a name worth more than "Hoy" today, and the date underneath
  // still says which day it is.
  const title = page.getByTestId("home-title");
  await expect(title).toContainText("Cumpleaños de Loki");
  // The emoji is ornament: shown, never spoken.
  await expect(title).toContainText("🎂");
  const spoken = await title.getAttribute("aria-label");
  expect(spoken).toBe("Cumpleaños de Loki");
  await expect(page.getByTestId("home-date")).toContainText("de ");

  // The emptiest moment of the day is the one worth saying something in.
  await expect(page.getByTestId("home-empty")).toContainText(
    "Loki cumple 2 años",
  );

  // And the confetti, once — a year is a threshold, like the exercise goal.
  await expect(page.getByTestId("celebration")).toBeVisible();

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("calendar-mark-birthday")).toHaveCount(1);

  // Not colour or a glyph alone: the day says it in words, with the years.
  await expect(
    page
      .getByLabel(`${born.getDate()}, cumple 2 años`, { exact: false })
      .first(),
  ).toBeVisible();

  // And a day that is not the birthday goes back to its ordinary name.
  await closeCalendar(page);
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toHaveText("Ayer");
});

test("celebrates the birthday once, not once per open", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const born = new Date();
  born.setFullYear(born.getFullYear() - 3);
  const iso = `${born.getFullYear()}-${String(born.getMonth() + 1).padStart(2, "0")}-${String(born.getDate()).padStart(2, "0")}`;

  await resetE2EPets();
  await seedE2EPet({ birth_date: iso, exercise_goal_minutes: 60 });
  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("celebration")).toBeVisible();

  // The year it fired for is remembered on the device, so opening the app
  // again on the same birthday is not a second party.
  await page.reload();
  await expect(page.getByTestId("home-title")).toContainText(
    "Cumpleaños de Loki",
  );
  await expect(page.getByTestId("celebration")).toBeHidden();
});

test("says the birthday on the file's age line too", async ({ page }) => {
  const born = new Date();
  born.setFullYear(born.getFullYear() - 4);
  const iso = `${born.getFullYear()}-${String(born.getMonth() + 1).padStart(2, "0")}-${String(born.getDate()).padStart(2, "0")}`;

  await resetE2EPets();
  await seedE2EPet({ birth_date: iso });
  await seedSession(page);
  await page.goto("/profile");

  // The age is the fact a birthday changes, and the portrait's own corner is
  // already the camera.
  await expect(page.getByTestId("profile-age")).toContainText("Hoy cumple");
  await expect(page.getByTestId("profile-age")).toContainText("4 años");

  // The cake beside it is a control, not a decoration: once a year, pressing
  // it throws the confetti again on purpose.
  const cake = page.getByTestId("profile-birthday");
  await expect(cake).toHaveAttribute("aria-label", "Celebrarlo otra vez");
  await expect(page.getByTestId("celebration")).toBeHidden();
  await cake.click();
  await expect(page.getByTestId("celebration")).toBeVisible();

  // The countdown and the day itself never share the screen: the age line
  // takes over, so the arrival is a change of voice rather than one more line.
  await expect(page.getByTestId("profile-countdown")).toBeHidden();
});

test("counts down the fortnight before the birthday, and no longer", async ({
  page,
}) => {
  const inDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setFullYear(d.getFullYear() - 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  await resetE2EPets();
  await seedE2EPet({ birth_date: inDays(15) });
  await seedSession(page);
  await page.goto("/profile");
  await expect(page.getByTestId("profile-countdown")).toHaveText(
    "Quedan 15 días para su cumpleaños",
  );

  // The day before says it the way a person would.
  await resetE2EPets();
  await seedE2EPet({ birth_date: inDays(1) });
  await page.reload();
  await expect(page.getByTestId("profile-countdown")).toHaveText(
    "Mañana es su cumpleaños",
  );

  // A day further out is trivia, not a reminder.
  await resetE2EPets();
  await seedE2EPet({ birth_date: inDays(16) });
  await page.reload();
  await expect(page.getByTestId("profile-title")).toBeVisible();
  await expect(page.getByTestId("profile-countdown")).toBeHidden();
});

test("logs a walk known only by its end and its length", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // Typing a duration back-fills the start, which is the ordinary case.
  await add(page, "walk");
  await page.getByTestId("entry-duration").fill("45 min");

  // Clearing it leaves an end and a length, which is a complete fact — and
  // the one the sheet used to throw away. It is also what the steppers
  // produce just after midnight, when counting back lands on yesterday and
  // no time of day can say so.
  // **Backspaced, not `fill("")`.** A real keyboard fires one change per key,
  // so the field passes through "10:" and "1" on the way to empty — and each
  // of those used to wipe the duration, which the single event a `fill` sends
  // never reproduced. Found on the device.
  const from = page.getByTestId("entry-from");
  await from.click();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Backspace");
  }
  await expect(from).toHaveValue("");
  await page.getByTestId("entry-note").click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("45 min");

  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("45 min");
  await expect(page.getByTestId("home-goal")).toContainText("45 min de 1h");
});

test("keeps stepping a walk that reaches back past midnight", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // Whatever the hour, four taps of +15 is an hour of walk. Before the fix
  // this emptied its own duration field the moment the computed start crossed
  // into the previous day, and blamed DESDE on save.
  await add(page, "walk");
  for (let i = 0; i < 4; i++) {
    await page.getByTestId("entry-duration-plus").click();
  }
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");
  await page.getByTestId("entry-note").click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");

  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("1h de 1h");
});

test("keeps every control on the 48dp floor here too", async ({ page }) => {
  await seedSession(page);
  await page.goto("/");

  const floor = async (ids: string[]) => {
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} should be visible`).not.toBeNull();
      expect(
        box!.height,
        `${id} is ${box!.height}px tall`,
      ).toBeGreaterThanOrEqual(48);
    }
  };

  await floor(["home-prev-day", "home-next-day", "home-day", "home-add"]);
  await page.getByTestId("home-add").click();
  await floor([
    "home-add-walk",
    "home-add-meal",
    "home-add-medication",
    "home-add-incident",
  ]);

  await page.getByTestId("home-add-walk").click();
  await floor([
    "entry-from",
    "entry-to",
    "entry-duration",
    "entry-duration-minus",
    "entry-duration-plus",
    "entry-note",
    "entry-cancel",
    "entry-save",
  ]);
});

test("marks the goal met, once", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("10:00");
  await page.getByTestId("entry-duration").fill("1h");
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-goal")).toContainText(
    "Objetivo conseguido",
  );
  // The goal reads in hours on both sides of the "de".
  await expect(page.getByTestId("home-goal")).toContainText("1h de 1h");
});
