import { expect, test, type Page } from "@playwright/test";
import {
  eventsTableExists,
  resetE2EPets,
  seedE2EEvents,
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
 * "¿Todavía no habéis vuelto?", which says nothing about the code. A walk
 * typed as two times that reach back from now has the mirror problem: 45
 * minutes before 00:20 is yesterday, which the sheet also refuses, correctly.
 *
 * Playwright's clock is not the way out. `setFixedTime` stops Reanimated
 * dead — the button's status animation reads progress from `Date.now()` and
 * never finishes, so Playwright waits forever for a control that never stops
 * moving — and `install` + `resume` patches the timers the app captures at
 * module load, after which the day view never renders at all. Both were
 * measured here.
 *
 * The fix is to derive every time in this file from a "now" the test owns,
 * and to press ‹ wherever a fixed hour is needed. A spec that has to be on
 * today and needs time behind it skips itself in the hour after midnight
 * instead of failing.
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

  // On yesterday, where a fixed morning time has already happened whatever
  // hour the suite runs at. See "reads the day forwards" for the whole story.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

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

  // The duration is derived, which is the whole point of asking for the ends,
  // and so it is shown rather than typed.
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  await expect(page.getByTestId("entry-duration")).not.toBeEditable();

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

test("re-derives the duration when either time is corrected", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // On yesterday, where a fixed morning time has already happened whatever
  // hour the suite runs at. See "reads the day forwards" for the whole story.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

  await add(page, "walk");
  await page.getByTestId("entry-from").fill("10:00");
  await page.getByTestId("entry-to").fill("10:45");
  await expect(page.getByTestId("entry-duration")).toHaveValue("45 min");

  // Correcting either time re-reads the duration from the two of them, in the
  // readable form once it passes the hour.
  await page.getByTestId("entry-to").fill("11:15");
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h 15m");
  await page.getByTestId("entry-from").fill("10:15");
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");

  // And nothing the duration does reaches back into a time: the field is not
  // typed into, so the two times the tutor wrote are the only way in.
  await expect(page.getByTestId("entry-from")).toHaveValue("10:15");
  await expect(page.getByTestId("entry-to")).toHaveValue("11:15");

  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("10:15");
  await expect(page.getByTestId("home-log")).toContainText("1h");
});

test("reopens an entry to correct it", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // On yesterday, where a fixed morning time has already happened whatever
  // hour the suite runs at. See "reads the day forwards" for the whole story.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

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

  // On yesterday, where 09:00 has already happened whatever hour the suite
  // runs at. See "reads the day forwards".
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

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

test("refuses an end that comes before its start", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // On yesterday, so the only thing wrong with these two times is their
  // order. Run before ten in the morning, both are also in the future, and
  // the sheet says so first — a correct message about the wrong problem.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

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

  // On yesterday, where 08:30 has already happened whatever time the suite
  // runs at. See "reads the day forwards".
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("08:30");
  await page.getByTestId("entry-save").click();

  // A walk with only an end is a valid entry: it still happened, and the end
  // is the only time anybody wrote down.
  await expect(page.getByTestId("home-log")).toContainText("08:30");
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 1h");
});

test("records several stools on one walk, the second in one tap", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");

  // Nothing is offered until it is asked for: the walk costs no extra space
  // and no extra decision unless somebody reaches for it.
  await expect(page.getByTestId("stool-add-2")).toBeHidden();

  // The button reveals; the palette adds. No default is ever written.
  await page.getByTestId("stool-toggle").click();
  await page.getByTestId("stool-add-2").click();
  await expect(page.getByTestId("stool-token-0")).toContainText("Perfecta");

  // The palette stays open **and stays put**, so the second costs one tap on
  // the same spot. A bottom sheet grows upward, so anything appearing below
  // it would lift it out from under the thumb — on the device that tap landed
  // on whatever had taken its place.
  const before = await page.getByTestId("stool-add-4").boundingBox();
  await page.getByTestId("stool-add-4").click();
  const after = await page.getByTestId("stool-add-4").boundingBox();
  expect(after?.y).toBe(before?.y);

  await page.getByTestId("entry-save").click();

  const row = page.getByTestId("home-log").getByRole("button").first();
  await expect(row).toHaveAttribute(
    "aria-label",
    /2 kakas: perfecta, sin forma/,
  );
});

test("runs the scale toward the thumb, and keeps it on one row", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await add(page, "walk");
  await page.getByTestId("stool-toggle").click();

  // 5 to 1, so "Perfecta" — the one tapped on almost every walk — sits near
  // the hand rather than across the phone from it.
  const xs = await Promise.all(
    [5, 4, 3, 2, 1].map(async (value) => {
      const box = await page.getByTestId(`stool-add-${value}`).boundingBox();
      return box?.x ?? 0;
    }),
  );
  expect(xs).toEqual([...xs].sort((a, b) => a - b));

  // The ideal is marked, because a five-point scale reads as one-ended and
  // the assumption is that the best is whatever is furthest from diarrhoea.
  await expect(page.getByTestId("stool-add-2")).toHaveAttribute(
    "aria-label",
    /Es la buena/,
  );
  await expect(page.getByTestId("stool-add-5")).not.toHaveAttribute(
    "aria-label",
    /Es la buena/,
  );

  // One row, never wrapped: a wrapped row moves the options between taps.
  const ys = await Promise.all(
    [5, 4, 3, 2, 1].map(async (value) => {
      const box = await page.getByTestId(`stool-add-${value}`).boundingBox();
      return box?.y ?? 0;
    }),
  );
  expect(new Set(ys).size).toBe(1);
});

test("undoes a mis-tap with one press on the chip", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("stool-toggle").click();
  await page.getByTestId("stool-add-2").click();
  await page.getByTestId("stool-add-2").click();
  await page.getByTestId("stool-add-5").click();

  // Two stools can share a value: removing the first of two "2"s must not
  // take the second with it.
  await page.getByTestId("stool-token-0").click();
  await expect(page.getByTestId("stool-token-0")).toContainText("Perfecta");
  await expect(page.getByTestId("stool-token-1")).toContainText("Diarrea");
  await expect(page.getByTestId("stool-token-2")).toBeHidden();

  // Closing leaves the button and what was collected, and nothing else.
  await page.getByTestId("stool-toggle").click();
  await expect(page.getByTestId("stool-add-2")).toBeHidden();
  await expect(page.getByTestId("stool-token-0")).toBeVisible();
  await expect(page.getByTestId("stool-toggle")).toBeVisible();
});

test("reopens a walk with its stools, and can save without them", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("stool-toggle").click();
  await page.getByTestId("stool-add-5").click();
  await page.getByTestId("entry-save").click();

  const row = page.getByTestId("home-log").getByRole("button").first();
  await expect(row).toHaveAttribute("aria-label", /una kaka: diarrea/);

  // An edit reopens what was stored rather than an empty field — collapsed,
  // because the tokens are the record and the palette is the tool.
  await row.click();
  await expect(page.getByTestId("stool-token-0")).toContainText("Diarrea");
  await expect(page.getByTestId("stool-add-5")).toBeHidden();

  await page.getByTestId("stool-token-0").click();
  await page.getByTestId("entry-save").click();
  await expect(
    page.getByTestId("home-log").getByRole("button").first(),
  ).not.toHaveAttribute("aria-label", /kaka/);
});

test("will not re-save an entry nobody changed", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // A *new* entry has nothing to differ from, and an untouched walk is a
  // complete record on purpose: nothing but the time you got back.
  await add(page, "walk");
  await expect(page.getByTestId("entry-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("entry-save").click();

  // Reopening it is the profile's situation: pressing save with nothing
  // touched is a write with nothing in it.
  const row = page.getByTestId("home-log").getByRole("button").first();
  await row.click();
  await expect(page.getByTestId("entry-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  // A stool counts as a change, like any other field.
  await page.getByTestId("stool-toggle").click();
  await page.getByTestId("stool-add-2").click();
  await expect(page.getByTestId("entry-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );

  // And taking it away again puts the button back where it was.
  await page.getByTestId("stool-token-0").click();
  await expect(page.getByTestId("entry-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("puts no control inside another, on any sheet", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **Only the web can see this.** React Native has no rule against a
  // pressable inside a pressable, so the defect is invisible on the device and
  // arrives as a hydration warning here: the sheet's scrim gained the
  // accessible name it needed, a `Pressable` with a button role renders as a
  // real `<button>`, and every control in the panel became a button inside a
  // button.
  const complaints: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /descendant|nested/.test(message.text())
    ) {
      complaints.push(message.text().slice(0, 80));
    }
  });

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("stool-toggle").click();
  expect(
    await page.evaluate(
      () => document.querySelectorAll("button button").length,
    ),
  ).toBe(0);
  await page.getByTestId("entry-cancel").click();

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.querySelectorAll("button button").length,
    ),
  ).toBe(0);

  expect(complaints).toEqual([]);
});

test("offers the scale on a walk and nowhere else", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // A meal, a medication and an incident are a moment, not an outing.
  for (const kind of ["meal", "medication", "incident"]) {
    await add(page, kind);
    await expect(page.getByTestId("entry-note")).toBeVisible();
    await expect(page.getByTestId("stool-toggle")).toBeHidden();
    await page.getByTestId("entry-cancel").click();
  }

  await add(page, "walk");
  await expect(page.getByTestId("stool-toggle")).toBeVisible();
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

  // **On yesterday, where every hour has already happened.** The times are
  // fixed because the assertion is about their order, and a fixed morning
  // time is in the future for anybody running the suite before it — the sheet
  // refuses that, correctly, and the ordering assertion then blames the log.
  // A past day has no such edge, and the diary can be written on one.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

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

  // On yesterday, where a fixed morning time has already happened whatever
  // hour the suite runs at. See "reads the day forwards" for the whole story.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

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
  const cal = page.getByTestId("home-calendar");
  await expect(
    cal
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
  // Scoped to the calendar: a bare "10," also matches an entry logged at
  // 13:10, which is a collision the wall clock decides.
  await cal
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

  // Each walk below ends at a "now" this test owns and begins that many
  // minutes before it, so the first is 45 minutes long and has to be today.
  const now = new Date();
  test.skip(
    new Date(now.getTime() - 45 * 60_000).getDate() !== now.getDate(),
    "45 minutes ago is still yesterday",
  );

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // 45 of the 60-minute goal: close, and not there.
  await add(page, "walk");
  await typeWalk(page, now, 45);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("45 min");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // The walk that crosses it.
  await add(page, "walk");
  await typeWalk(page, now, 15);
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
  await typeWalk(page, now, 15);
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
  // An hour on yesterday, where any time of day has already happened.
  await page.getByTestId("entry-from").fill("09:00");
  await page.getByTestId("entry-to").fill("10:00");
  await page.getByTestId("entry-save").click();

  // Yesterday's goal is met, and filling in a day that has gone is
  // bookkeeping rather than an achievement.
  await expect(page.getByTestId("home-goal")).toContainText("Objetivo");
  await expect(page.getByTestId("celebration")).toBeHidden();
});

test("carries the marks with it when the month is paged", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  // The 12th of last month: an incident, so the day carries a mark that can
  // only come from that month's own fetch.
  const lastMonth = new Date();
  lastMonth.setDate(1);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  lastMonth.setDate(12);
  lastMonth.setHours(10, 0, 0, 0);
  await seedE2EEvents(petId, [
    { kind: "incident", occurredAt: lastMonth, what: "Cojeaba" },
  ]);

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();
  await expect(page.getByTestId("calendar-mark-incident")).toHaveCount(0);
  // The sheet fades in, and a tap on the month arrow during that fade is
  // swallowed — the grid stays on the month it opened at and the assertion
  // below then blames the fetch for a click that never landed.
  await page.waitForTimeout(600);

  // Page back a month with the library's own arrow, the way anybody looking
  // for "which day did he have diarrhoea?" would. That arrow changes the
  // month without calling `onMonthChange`, so a per-month fetch never learned
  // it had to run — and every cell fell through to the unlogged branch, the
  // calendar asserting that nothing happened all month.
  await page.getByTestId("btn-prev").click();

  // The month on screen must be the month the marks belong to. Falling
  // through to the unlogged branch would have the calendar assert that
  // nothing happened all month, which is worse than showing nothing.
  await expect(page.getByTestId("calendar-mark-incident")).toHaveCount(1);
  // And it says which day in words, not by position in the grid.
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel("12, objetivo sin conseguir, con incidencia", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
});

test("waits in the shape of the log, not on the day before it", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-log-skeleton")).toBeHidden();

  // Hold the day's read open so the waiting state is a state and not a
  // flicker. Without this the assertion is a race the network usually wins.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/pet_events*", async (route) => {
    await held;
    await route.continue();
  });

  await page.getByTestId("home-prev-day").click();

  // The header moved, and the rows under it did not stay on the day before.
  await expect(page.getByTestId("home-title")).toHaveText("Ayer");
  await expect(page.getByTestId("home-log-skeleton")).toBeVisible();
  await expect(page.getByTestId("home-goal-skeleton")).toBeVisible();
  await expect(page.getByTestId("home-log")).toBeHidden();
  await expect(page.getByTestId("home-goal")).toBeHidden();

  release();
  await expect(page.getByTestId("home-log-skeleton")).toBeHidden();
  await expect(page.getByTestId("home-goal")).toBeVisible();
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

  // **The calendar opens on today, so on the birthday the accent fill lands
  // on the one cell the whole feature exists for.** The watermark behind it
  // is covered; a second copy over the fill is what keeps the cake visible on
  // its own day, and this is the cell that had none.
  await expect(page.getByTestId("calendar-mark-birthday-selected")).toHaveCount(
    1,
  );

  // Not colour or a glyph alone: the day says it in words, with the years.
  await expect(
    page
      .getByTestId("home-calendar")
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

test("forgets the length with the start it was read from", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // Yesterday, so both times are in the past whatever hour the suite runs at.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

  await add(page, "walk");
  await page.getByTestId("entry-from").fill("09:15");
  await page.getByTestId("entry-to").fill("09:45");
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");

  // **Backspaced, not `fill("")`.** A real keyboard fires one change per key,
  // so the field passes through "09:1" and "0" on the way to empty. Only the
  // empty field is a cleared start; the ones before it are mid-typing.
  const from = page.getByTestId("entry-from");
  await from.click();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Backspace");
  }
  await expect(from).not.toHaveValue("");
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  await page.keyboard.press("Backspace");
  await expect(from).toHaveValue("");

  // With no start the length has nothing left to be read from, and the field
  // cannot be typed into to take it out by hand — so it goes with the start.
  // What is left is an end, which is a valid entry on its own, and Guardar
  // must not file the old length under it.
  await expect(page.getByTestId("entry-duration")).toHaveValue("");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("09:45");
  await expect(page.getByTestId("home-log")).not.toContainText("30 min");
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 1h");
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
    "entry-note",
    "entry-cancel",
    "entry-save",
  ]);
});

test("marks the goal met, once", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **Derived from a "now" the test owns.** It filled "10:00", which is in
  // the future for anybody running the suite before ten in the morning — and
  // the sheet refuses a walk that has not happened yet, correctly. The walk
  // is an hour long and has to be today, so within the first hour of the day
  // there is nothing for it to be.
  const now = new Date();
  test.skip(
    new Date(now.getTime() - 60 * 60_000).getDate() !== now.getDate(),
    "an hour ago is still yesterday",
  );

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await typeWalk(page, now, 60);
  await page.getByTestId("entry-save").click();

  await expect(page.getByTestId("home-goal")).toContainText(
    "Objetivo conseguido",
  );
  // The goal reads in hours on both sides of the "de".
  await expect(page.getByTestId("home-goal")).toContainText("1h de 1h");

  // **Under the bar, not beside the measure.** The measure row's right slot
  // is the walk control's now, so the label has one home on every day. Both
  // halves are pinned: it is no longer inside the measure, and it sits below
  // the bar rather than above it.
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "Objetivo",
  );
  const bar = await page.getByTestId("home-goal-bar").boundingBox();
  const met = await page.getByTestId("home-goal-met").boundingBox();
  expect(bar, "the bar should be visible").not.toBeNull();
  expect(met, "the label should be visible").not.toBeNull();
  expect(met!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
});

/** "HH:MM" for a moment, in the browser's own clock — which is this one. */
function clockTime(moment: Date): string {
  return `${String(moment.getHours()).padStart(2, "0")}:${String(
    moment.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Fills DESDE and HASTA for a walk that ended at `end` and lasted `minutes`.
 *
 * Both times are computed from the one instant, so the duration the sheet
 * reads back is exactly `minutes` whichever second the minute turns on. The
 * caller owns keeping the start on the same day.
 */
async function typeWalk(page: Page, end: Date, minutes: number) {
  await page.getByTestId("entry-to").fill(clockTime(end));
  await page
    .getByTestId("entry-from")
    .fill(clockTime(new Date(end.getTime() - minutes * 60_000)));
}

/**
 * Leaves a walk running on this device, begun at `startedAt`.
 *
 * The live walk's start cannot be edited, so a spec that needs one with time
 * behind it has to be handed it: the row is seeded and the device's own note
 * of which walk is running — the key and shape `lib/walk.ts` writes — is
 * planted before the page loads.
 */
async function seedRunningWalk(page: Page, petId: string, startedAt: Date) {
  const [id] = await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: startedAt },
  ]);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ["petfile.walk.v1", JSON.stringify({ id })] as const,
  );
}

test("starts a walk and stops it from the goal block", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeVisible();

  const entries = page.locator('[data-testid^="home-entry-"]');
  await expect(entries).toHaveCount(0);

  await page.getByTestId("home-goal-control").click();

  // The measure says so, and the walk is a row in the log like any other —
  // which is what lets the stool in the middle of it be written down.
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("En marcha");

  // The walk survives a reload: the device kept the row's id, and the start
  // is read back from the row.
  await page.reload();
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(entries.first()).toContainText("En marcha");

  // Stopping inside the first minute is a mis-tap, so the row goes with it
  // instead of recording a walk of nothing.
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "De paseo",
  );
  await expect(entries).toHaveCount(0);
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 1h");
});

test("does not let a walk in progress have its times changed", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();

  // The start is the app's own measurement of the moment the tutor left, and
  // nothing in the sheet may move it while the walk is still going: DESDE,
  // HASTA and the duration are all locked, and so are the clocks beside them.
  const start = await page.getByTestId("entry-from").inputValue();
  expect(start).toMatch(/^\d{2}:\d{2}$/);
  await expect(page.getByTestId("entry-from")).not.toBeEditable();
  await expect(page.getByTestId("entry-to")).not.toBeEditable();
  await expect(page.getByTestId("entry-duration")).not.toBeEditable();
  await expect(page.getByTestId("entry-from-picker")).toBeDisabled();
  await expect(page.getByTestId("entry-to-picker")).toBeDisabled();

  // **A disabled field whose clock still opens is no disabling at all.** The
  // click is forced past Playwright's own refusal to press a disabled control,
  // because the thing under test is what the app does with a press that does
  // arrive.
  await page.getByTestId("entry-from-picker").click({ force: true });
  await page.getByTestId("entry-to-picker").click({ force: true });
  await expect(page.getByTestId("timepicker")).toHaveCount(0);

  // What the row is opened mid-walk for is untouched: the note and the stool.
  await expect(page.getByTestId("entry-note")).toBeEditable();
  await page.getByTestId("entry-note").fill("Ha olido a otro perro");
  await page.getByTestId("stool-toggle").click();
  await page.getByTestId("stool-add-2").click();
  await expect(page.getByTestId("stool-token-0")).toContainText("Perfecta");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);

  // The walk is exactly as it was found, plus what was written: still running,
  // with the same start.
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(row).toContainText("En marcha");
  await expect(row).toContainText("Ha olido a otro perro");
  await row.click();
  await expect(page.getByTestId("entry-from")).toHaveValue(start);
  await expect(page.getByTestId("entry-to")).toHaveValue("");
});

test("lets the times of a walk that has ended be changed again", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // The lock belongs to the walk running on this device and to no other row:
  // a stored walk, opened the same way, keeps its two times editable.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(10, 0, 0, 0);
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: start, durationMinutes: 45 },
  ]);

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();
  await page.locator('[data-testid^="home-entry-"]').first().click();

  await expect(page.getByTestId("entry-from")).toBeEditable();
  await expect(page.getByTestId("entry-to")).toBeEditable();
  await expect(page.getByTestId("entry-from-picker")).toBeEnabled();
  await expect(page.getByTestId("entry-to-picker")).toBeEnabled();
  // The length is a reading of the two, for a stored walk as for a new one.
  await expect(page.getByTestId("entry-duration")).not.toBeEditable();
});

test("annotates a walk in progress, then closes it with its length", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // A walk that began an hour behind a "now" this test owns, rather than a
  // fixed morning time: the sheet refuses a start in the future, and the live
  // walk's own start can no longer be backdated from the sheet, so the row is
  // seeded already an hour old. Within the first hour of the day that hour is
  // yesterday, which this day view cannot hold.
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  test.skip(
    hourAgo.getDate() !== now.getDate(),
    "an hour ago is still yesterday",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedRunningWalk(page, petId, hourAgo);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");

  // **The live row opens as a start, not as a return.** Every other row with
  // one time and no length means "I got back at this hour"; this one means
  // the opposite, and the day view is the only thing that knows which.
  await row.click();
  // The shape is the assertion for HASTA, not the digits; the start is the
  // hour the walk was seeded at.
  await expect(page.getByTestId("entry-to")).toHaveValue("");
  await expect(page.getByTestId("entry-from")).toHaveValue(clockTime(hourAgo));

  // The mid-walk annotation the feature exists for: the kaka and the note are
  // written while the dog is still out.
  await page.getByTestId("stool-toggle").click();
  await page.getByTestId("stool-add-2").click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);

  // Still running: the row has a start and no length, which is the whole
  // shape of a walk in progress, so the device's flag still points at it.
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("home-goal-measure")).toContainText("1h");
  await expect(row).toContainText("En marcha");

  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "De paseo",
  );

  // The length lands — the clause the spec's Testing section asks for, and
  // the only one that writes a number into a real animal's activity record.
  await expect(row).toContainText("1h");
  await expect(page.getByTestId("home-goal-met")).toBeVisible();

  // **And the note and the kaka survived it.** This is the regression test
  // for `closeWalk` touching the duration and nothing else: a full update,
  // with its nulls, would wipe exactly what was written mid-walk.
  await expect(row).toContainText("Ha bebido en la fuente");
  await expect(row).toHaveAttribute("aria-label", /una kaka: perfecta/);
});

test("saves a stored walk that crossed midnight, and saves it again after an edit", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **The sheet cannot make this walk any more — the duration is not typed —
  // so it is stored.** Yesterday at 23:40 for half an hour, which ends at 00:10
  // *today*: exactly the walk no HASTA can say. Rows like this exist already,
  // and they have to keep opening and saving.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(23, 40, 0, 0);
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: start, durationMinutes: 30 },
  ]);

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");
  await expect(page.getByTestId("home-log")).toContainText("23:40");
  await expect(page.getByTestId("home-log")).toContainText("30 min");

  // Open it and edit anything else. The sheet recovers DESDE and leaves HASTA
  // empty, since a walk that crossed midnight has no HASTA this form can hold
  // — and it used to refuse to save that, whatever had been changed. (Guardar
  // stays disabled on a reopened entry nobody touched, so the note is the
  // smallest real edit.)
  await page.locator('[data-testid^="home-entry-"]').first().click();
  await expect(page.getByTestId("entry-from")).toHaveValue("23:40");
  await expect(page.getByTestId("entry-to")).toHaveValue("");
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  await page.getByTestId("entry-note").fill("Cruzó la medianoche");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await expect(page.getByTestId("home-log")).toContainText("23:40");
  await expect(page.getByTestId("home-log")).toContainText("30 min");
  await expect(page.getByTestId("home-log")).toContainText(
    "Cruzó la medianoche",
  );

  // **And its start can be retyped without losing its length.** Clearing DESDE
  // to type another used to wipe the duration — on a real keyboard, which
  // passes through "23:4" and "2" on the way to empty. HASTA is empty here, so
  // there are not two times to read a duration from and the length is the
  // fact: it has to stand through the whole of it, backspaced one key at a
  // time as a phone does.
  await page.locator('[data-testid^="home-entry-"]').first().click();
  const from = page.getByTestId("entry-from");
  await from.click();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  }
  await expect(from).toHaveValue("");
  await from.fill("23:30");
  await expect(page.getByTestId("entry-to")).toHaveValue("");
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await expect(page.getByTestId("home-log")).toContainText("23:30");
  await expect(page.getByTestId("home-log")).toContainText("30 min");
  await expect(page.getByTestId("home-goal")).toContainText("30 min de 1h");
});

test("saves a stored walk with both its times, changing only its note", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(10, 0, 0, 0);
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: start, durationMinutes: 45 },
  ]);

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();
  await page.locator('[data-testid^="home-entry-"]').first().click();

  // The sheet gives back the two times the row was entered from, and the
  // length it reads from them is the length that was stored.
  await expect(page.getByTestId("entry-from")).toHaveValue("10:00");
  await expect(page.getByTestId("entry-to")).toHaveValue("10:45");
  await expect(page.getByTestId("entry-duration")).toHaveValue("45 min");

  await page.getByTestId("entry-note").fill("Con el perro del vecino");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);

  await expect(page.getByTestId("home-log")).toContainText("10:00");
  await expect(page.getByTestId("home-log")).toContainText("45 min");
  await expect(page.getByTestId("home-log")).toContainText(
    "Con el perro del vecino",
  );
  await expect(page.getByTestId("home-goal")).toContainText("45 min de 1h");
});

test("refuses a typed return time that does not parse, instead of dropping it", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  // Yesterday, so the start is a valid, past time and the only thing wrong is
  // the HASTA.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

  await add(page, "walk");
  await page.getByTestId("entry-from").fill("09:15");
  await page.getByTestId("entry-to").fill("99:99");
  await page.getByTestId("entry-save").click();

  // Only an *empty* HASTA can be stood in for by DESDE. A typed one is a
  // value somebody meant, and saving the walk without it would lose it.
  await expect(page.getByTestId("entry-to-error")).toHaveText(
    "Escríbela como 09:15",
  );
  await expect(page.getByTestId("entry-title")).toBeVisible();
  await expect(page.getByTestId("home-log")).toBeHidden();
});

test("refuses a start in the future when there is no return time", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // A start ten minutes ahead of a "now" this test owns. Within ten minutes of
  // midnight that clock time wraps to the early hours, which today has already
  // had, so there would be nothing to refuse.
  const now = new Date();
  const soon = new Date(now.getTime() + 10 * 60_000);
  test.skip(
    soon.getDate() !== now.getDate(),
    "ten minutes ahead is already tomorrow",
  );

  await seedSession(page);
  await page.goto("/");

  await add(page, "walk");
  await page.getByTestId("entry-to").fill("");
  await page.getByTestId("entry-from").fill(clockTime(soon));
  await page.getByTestId("entry-save").click();

  // With HASTA empty the start is what gets stored, so it gets HASTA's check,
  // on its own field.
  await expect(page.getByTestId("entry-from-error")).toHaveText(
    "¿Todavía no habéis salido?",
  );
  await expect(page.getByTestId("entry-title")).toBeVisible();
});

test("shows the goal block for a pet with no goal, and still starts a walk", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // The activity question is optional, so this is an ordinary pet.
  await resetE2EPets();
  await seedE2EPet();

  await seedSession(page);
  await page.goto("/");

  // "paseados", without the day: the block renders on past days too now, and
  // the header is what names the day.
  await expect(page.getByTestId("home-goal")).toContainText("paseados");
  await expect(page.getByTestId("home-goal")).not.toContainText("hoy");
  // No goal, so no bar and nothing to have met.
  await expect(page.getByTestId("home-goal-bar")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-met")).toHaveCount(0);

  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(
    page.locator('[data-testid^="home-entry-"]').first(),
  ).toContainText("En marcha");

  // Stopped inside a minute, so nothing is left behind in the log.
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "De paseo",
  );
});

test("offers the clock beside a time field, for a thumb that would rather point", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toContainText("Ayer");

  await add(page, "meal");

  // **The field stays typed and the picker is the alternative.** "915" is two
  // seconds on a number pad; the clock is for the thumb that would rather
  // point at one.
  await page.getByTestId("entry-time").fill("0915");
  await page.getByTestId("entry-time-picker").click();
  await expect(page.getByTestId("timepicker-preview")).toContainText("09:15");

  // The face opens on the half of the day the field was in, so 14 is not on
  // it yet — one ring cannot carry twenty-four hours, and the switch is how
  // the other twelve are reached.
  await expect(page.getByTestId("timepicker-hour-14")).toHaveCount(0);
  await page.getByTestId("timepicker-half-afternoon").click();
  await expect(page.getByTestId("timepicker-preview")).toContainText("21:15");

  // Choosing an hour hands over to the minutes, the way every clock picker
  // does: the hour ring is gone and the minutes are there in its place.
  await page.getByTestId("timepicker-hour-14").click();
  await expect(page.getByTestId("timepicker-hour-14")).toHaveCount(0);
  await page.getByTestId("timepicker-minute-30").click();
  await expect(page.getByTestId("timepicker-preview")).toContainText("14:30");

  // Nothing commits until Confirmar, the contract every sheet here keeps —
  // and the field kept the tidying that opening the picker gave it, because
  // reaching for the picker took focus off the field.
  await page.getByTestId("timepicker-cancel").click();
  await expect(page.getByTestId("entry-time")).toHaveValue("09:15");

  await page.getByTestId("entry-time-picker").click();
  await page.getByTestId("timepicker-half-afternoon").click();
  await page.getByTestId("timepicker-hour-14").click();
  await page.getByTestId("timepicker-minute-30").click();
  await page.getByTestId("timepicker-confirm").click();
  await expect(page.getByTestId("entry-time")).toHaveValue("14:30");
});

test("keeps the clock's own controls on the 48dp floor", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();

  await add(page, "meal");
  // A fixed hour, so the face is on a known half of the day: a sheet that
  // opens on the clock would put the suite on 00-11 or on 12-23 depending on
  // when it ran, which is the shape of failure this file has had before.
  await page.getByTestId("entry-time").fill("0600");
  await page.getByTestId("entry-time-picker").click();

  // The numbers on the face are the reason the dial carries twelve marks and
  // a switch instead of two rings: a second ring inside this one would put
  // them 38dp apart.
  for (const id of [
    "entry-time-picker",
    "timepicker-set-hour",
    "timepicker-set-minute",
    "timepicker-half-morning",
    "timepicker-half-afternoon",
    "timepicker-hour-00",
    "timepicker-hour-06",
  ]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(
      box?.height,
      `${id} is under the touch floor`,
    ).toBeGreaterThanOrEqual(48);
    expect(box?.width, `${id} is under the touch floor`).toBeGreaterThanOrEqual(
      48,
    );
  }
});

test("keeps a minute the clock has no number for", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();

  await add(page, "meal");

  // **Opening on 09:47 must not round to 09:45.** The face labels every fifth
  // minute; rounding the other 55 on open would be the picker editing a value
  // nobody asked it to touch.
  await page.getByTestId("entry-time").fill("0947");
  await page.getByTestId("entry-time-picker").click();
  await expect(page.getByTestId("timepicker-preview")).toContainText("09:47");
  await page.getByTestId("timepicker-confirm").click();
  await expect(page.getByTestId("entry-time")).toHaveValue("09:47");
});
