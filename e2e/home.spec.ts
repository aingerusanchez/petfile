import { expect, test, type Page } from "@playwright/test";
import {
  eventsTableExists,
  resetE2EPets,
  seedE2EEvents,
  seedE2EPet,
  seedSession,
} from "./auth";
import { colors } from "../components/ui/tokens";

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
  await expect(page.getByTestId("home-goal")).toContainText("de 2h");

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
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");

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
  await expect(page.getByTestId("home-goal")).toContainText("30 min de 2h");
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
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");
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
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");
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

/**
 * **The confetti belongs to the top tier, and to nothing else.**
 *
 * It used to fire at the goal. The two tiers moved it: Tier 1 is what an
 * ordinary day reaches — most days clear it — and the everyday is not
 * celebrated. A goal met turns the bar Aqua and says so under it; the party
 * is kept for the day that doubles it, which is the one worth marking on the
 * calendar.
 */
test("throws confetti for the walk that doubles the goal, and only that one", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // Each walk below ends at a "now" this test owns and begins that many
  // minutes before it, so the longest is 45 minutes and has to be today.
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

  // The walk that reaches the goal. The bar says so and nothing falls.
  await add(page, "walk");
  await typeWalk(page, now, 15);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido",
  );
  // Tier 1 is read as it is written: no spoken form of its own.
  await expect(page.getByTestId("home-goal-met")).not.toHaveAttribute(
    "aria-label",
    /.+/,
  );
  await expect(page.getByTestId("celebration")).toBeHidden();

  // Most of the way through lap two, still nothing.
  await add(page, "walk");
  await typeWalk(page, now, 45);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("1h 45m de 2h");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // And the walk that doubles it.
  await add(page, "walk");
  await typeWalk(page, now, 15);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido x2",
  );
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

  // A further walk on a day already doubled does not celebrate again.
  await add(page, "walk");
  await typeWalk(page, now, 15);
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-goal")).toContainText("2h 15m");
  await expect(page.getByTestId("celebration")).toBeHidden();
});

test("does not celebrate a day that has passed, however far it got", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-prev-day").click();
  // Two hours on yesterday, where any time of day has already happened —
  // double the 60-minute goal, so it reaches the one tier that celebrates.
  for (const [from, to] of [
    ["09:00", "10:00"],
    ["10:00", "11:00"],
  ]) {
    await add(page, "walk");
    await page.getByTestId("entry-from").fill(from);
    await page.getByTestId("entry-to").fill(to);
    await page.getByTestId("entry-save").click();
  }

  // Yesterday is doubled, and filling in a day that has gone is bookkeeping
  // rather than an achievement.
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido x2",
  );
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

/**
 * Last month's `day`th at 10:00, where any hour has already happened.
 *
 * The calendar specs below seed a month other than the current one, so the
 * dates they need exist whatever day it is today — a spec that seeded
 * "yesterday" would fall into the previous month on the 1st.
 */
function lastMonthAt(day: number): Date {
  const at = new Date();
  at.setDate(1);
  at.setMonth(at.getMonth() - 1);
  at.setDate(day);
  at.setHours(10, 0, 0, 0);
  return at;
}

/** Opens the month calendar and pages back to the month `lastMonthAt` seeds. */
async function openLastMonth(page: Page) {
  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();
  // The sheet fades in, and a tap on the month arrow during that fade is
  // swallowed — see the paging spec above.
  await page.waitForTimeout(600);
  await page.getByTestId("btn-prev").click();
}

/** The goal bar inside the cell the calendar labels exactly `label`. */
function barIn(page: Page, label: string) {
  return page
    .getByTestId("home-calendar")
    .getByLabel(label, { exact: true })
    .first()
    .getByTestId("calendar-mark-goal");
}

async function backgroundOf(locator: ReturnType<Page["getByTestId"]>) {
  return hexOf(
    await locator.evaluate((el) => getComputedStyle(el).backgroundColor),
  );
}

test("marks a double day in the accent and an ordinary one in Aqua", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // Against a 120 goal: one minute short, the goal and a little over, exactly
  // the goal, exactly double, and well past it. The two exact days are the
  // boundaries, the ones that tell a `>=` from a `>` — and the day view says
  // the same about each of them.
  //
  // **The pet is born on the 1st of January, not on its default.** The default
  // birth date is the 14th of September, and a month that has a birthday in it
  // draws a cake on that day — one of the five days seeded here, in the one
  // month of the year this spec would otherwise run in.
  await resetE2EPets();
  const petId = await seedE2EPet({
    birth_date: "2025-01-01",
    exercise_goal_minutes: 120,
  });
  await seedE2EEvents(
    petId,
    [
      [12, 119],
      [13, 130],
      [14, 240],
      [15, 260],
      [16, 120],
    ].map(([day, minutes]) => ({
      kind: "walk" as const,
      occurredAt: lastMonthAt(day),
      durationMinutes: minutes,
    })),
  );

  await seedSession(page);
  await page.goto("/");
  await openLastMonth(page);

  // Said in the day view's own words, so the mark is not colour alone — and
  // the top tier is called what the day view calls it.
  await expect(barIn(page, "13, objetivo conseguido")).toBeVisible();
  await expect(
    barIn(page, "14, doble objetivo diario conseguido"),
  ).toBeVisible();
  await expect(
    barIn(page, "15, doble objetivo diario conseguido"),
  ).toBeVisible();
  await expect(barIn(page, "16, objetivo conseguido")).toBeVisible();
  await expect(
    page
      .getByTestId("home-calendar")
      .getByLabel("12, objetivo sin conseguir", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(barIn(page, "12, objetivo sin conseguir")).toHaveCount(0);

  // The Shared Mark Rule: Aqua for the goal, Aurora Boreal for double — the
  // two colours the day view's bar wears for the same two states.
  expect(await backgroundOf(barIn(page, "13, objetivo conseguido"))).toBe(
    colors.accent,
  );
  expect(
    await backgroundOf(barIn(page, "14, doble objetivo diario conseguido")),
  ).toBe(colors.accentFocus);
  // Exactly the goal is Tier 1, not short of it: the twin of the 240 day.
  expect(await backgroundOf(barIn(page, "16, objetivo conseguido"))).toBe(
    colors.accent,
  );
  expect(
    await backgroundOf(barIn(page, "15, doble objetivo diario conseguido")),
  ).toBe(colors.accentFocus);

  // The legend names both, in the same words and the same colours, so neither
  // swatch is something to guess at.
  const legend = page.getByTestId("home-calendar");
  await expect(legend).toContainText("Objetivo conseguido x2");
  expect(await backgroundOf(page.getByTestId("calendar-legend-goal"))).toBe(
    colors.accent,
  );
  expect(await backgroundOf(page.getByTestId("calendar-legend-goal-x2"))).toBe(
    colors.accentFocus,
  );
});

test("reads the top tier as words and still shows the short form", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **Both halves in one test, because the defect would be changing one and
  // not the other.** "Objetivo conseguido x2" is what fits under the bar and
  // in a legend; "doble objetivo diario conseguido" is what the mark means
  // when it is said aloud, where "equis dos" means nothing. A test that only
  // looked for the spoken form would stay green if the visible text had been
  // replaced with it, and a test that only looked for the visible one is the
  // test that already existed.
  //
  // Goal 60: today is 130 minutes (doubled), and last month's 13th is 70
  // (Tier 1) beside its 14th at 130 (Tier 2). The pet is born on New Year's
  // Day so no cake lands on a seeded day.
  const earlier = new Date();
  earlier.setHours(0, 1, 0, 0);
  await resetE2EPets();
  const petId = await seedE2EPet({
    birth_date: "2025-01-01",
    exercise_goal_minutes: 60,
  });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 130 },
    { kind: "walk", occurredAt: lastMonthAt(13), durationMinutes: 70 },
    { kind: "walk", occurredAt: lastMonthAt(14), durationMinutes: 130 },
  ]);

  await seedSession(page);
  await page.goto("/");

  // The bar's label: shown short, spoken long.
  const met = page.getByTestId("home-goal-met");
  await expect(met).toHaveText("Objetivo conseguido x2");
  await expect(met).toHaveAttribute(
    "aria-label",
    "doble objetivo diario conseguido",
  );

  await openLastMonth(page);
  const calendar = page.getByTestId("home-calendar");

  // The cell: said long, and nothing in the calendar says "x2" to a reader.
  await expect(
    calendar.getByLabel("14, doble objetivo diario conseguido", {
      exact: true,
    }),
  ).not.toHaveCount(0);
  await expect(calendar.getByLabel(/x2/i)).toHaveCount(0);

  // The legend: shown short, spoken long.
  await expect(
    calendar.getByText("Objetivo conseguido x2", { exact: true }),
  ).toBeVisible();
  await expect(
    calendar.getByLabel("doble objetivo diario conseguido", { exact: true }),
  ).toBeVisible();

  // Tier 1 is unchanged, seen and heard: no spoken form of its own.
  await expect(
    calendar.getByLabel("13, objetivo conseguido", { exact: true }),
  ).not.toHaveCount(0);
  await expect(
    calendar.getByText("Objetivo conseguido", { exact: true }),
  ).toBeVisible();
  await expect(
    calendar.getByText("Objetivo conseguido", { exact: true }),
  ).not.toHaveAttribute("aria-label", /.+/);
});

test("a birthday that is also a double day reads as both", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // Both marks are Aurora Boreal, which is the point of The Shared Mark Rule
  // and the reason to look: the cake is a watermark behind the number and the
  // bar sits under it, and what keeps them two things is that they never
  // share a pixel.
  const day = lastMonthAt(14);
  const iso = `${day.getFullYear() - 2}-${String(day.getMonth() + 1).padStart(2, "0")}-14`;
  await resetE2EPets();
  const petId = await seedE2EPet({
    birth_date: iso,
    exercise_goal_minutes: 120,
  });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: day, durationMinutes: 260 },
  ]);

  await seedSession(page);
  await page.goto("/");
  await openLastMonth(page);

  // One cell, both facts, in words.
  const label = "14, cumple 2 años, doble objetivo diario conseguido";
  const bar = barIn(page, label);
  await expect(bar).toBeVisible();
  expect(await backgroundOf(bar)).toBe(colors.accentFocus);
  await expect(page.getByTestId("calendar-mark-birthday")).toHaveCount(1);

  // The cake's drawn box ends where the bar's begins. Its base line sits a
  // few dp above that edge, so there is clear ground between the two — and
  // this is the line that moves if the cake is ever made larger.
  const cake = await page
    .getByTestId("calendar-mark-birthday")
    .locator("svg")
    .boundingBox();
  const under = await bar.boundingBox();
  expect(cake).not.toBeNull();
  expect(under).not.toBeNull();
  expect(cake!.y + cake!.height).toBeLessThanOrEqual(under!.y + 0.5);
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
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");
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
  // The goal reads in hours on both sides of the "de", and the right-hand
  // side is the **top** tier: an hour's goal is counted against two.
  await expect(page.getByTestId("home-goal")).toContainText("1h de 2h");

  // **Under the bar, not beside the measure.** The measure row's right slot
  // is the walk control's now, so the label has one home on every day. Both
  // halves are pinned: it is no longer inside the measure, and it sits below
  // the bar rather than above it.
  //
  // **Measured against the ground and not the fill**, because a day exactly
  // on the goal is the foot of lap two: the fill is zero-width, which
  // Playwright reads as invisible. The ground is the bar at its full width
  // whatever the day did.
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "Objetivo",
  );
  const bar = await page.getByTestId("home-goal-ground").boundingBox();
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
  // Nothing is running, so nothing pulses and nothing marks a junction.
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);

  const entries = page.locator('[data-testid^="home-entry-"]');
  await expect(entries).toHaveCount(0);

  await page.getByTestId("home-goal-control").click();

  // The measure says so, and the walk is a row in the log like any other —
  // which is what lets the stool in the middle of it be written down. The dot
  // beside it is the same fact in a form that does not depend on how wide the
  // bar's segment is in the walk's first minutes.
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  // The first walk of the day has nothing recorded before it, so no junction.
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
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
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
  await expect(entries).toHaveCount(0);
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");
});

/**
 * The two moments the tick specs hang on, derived from a "now" they own.
 *
 * A recorded walk at one minute past midnight — the earliest start that is
 * still today, and always in the past — and a live walk begun two minutes ago.
 * It is `null` only in the first few minutes of the day, when the live walk
 * would be yesterday's. Anchoring on midnight rather than "two hours ago" is
 * what lets these run at 01:00 instead of skipping for the first two hours.
 */
function tickMoments(): { earlier: Date | null; running: Date } {
  const now = new Date();
  const running = new Date(now.getTime() - 2 * 60_000);
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const room = running.getDate() === now.getDate() && running > earlier;
  return { earlier: room ? earlier : null, running };
}

/**
 * **The tick is the boundary the two fills cannot draw.** Mist and the
 * segment's tone sit 1.71:1 apart, and against a 3 h goal the segment is 3.6 dp
 * wide at two minutes, so the mark at the junction is the only thing that says
 * where the recorded minutes end. The goal is 60 min here and 30 are recorded,
 * so the junction is the middle of the bar.
 */
test("marks where the recorded minutes end while a walk is running", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { earlier, running } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  const tick = page.getByTestId("home-goal-tick");
  await expect(tick).toBeVisible();
  const bar = await page.getByTestId("home-goal-bar").boundingBox();
  const box = await tick.boundingBox();
  expect(bar, "the recorded fill should be drawn").not.toBeNull();
  expect(box, "the tick should be drawn").not.toBeNull();

  // **Its position tracks the recorded proportion**: the recorded fill's right
  // edge is the junction, and the tick is centred on it. A half-way junction
  // also rules out a tick pinned to either end.
  const junction = bar!.x + bar!.width;
  expect(box!.x + box!.width / 2).toBeCloseTo(junction, 0);
  expect(bar!.width).toBeGreaterThan(0);

  // 2 dp wide and 12 tall, and standing proud of the 4 dp track at both ends.
  expect(box!.width).toBeCloseTo(2, 0);
  expect(box!.height).toBeCloseTo(12, 0);
  expect(box!.y).toBeLessThan(bar!.y);
  expect(box!.y + box!.height).toBeGreaterThan(bar!.y + bar!.height);

  // Decoration to a reader, the way the dot is.
  await expect(tick).toHaveAttribute("aria-hidden", "true");
});

test("moves the tick as more is recorded, and leaves the layout alone", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 15 },
  ]);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal")).toContainText("15 min de 2h");
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
  const idle = await page.getByTestId("home-goal").boundingBox();

  await page.getByTestId("home-goal-control").click();
  const tick = page.getByTestId("home-goal-tick");
  await expect(tick).toBeVisible();

  // A quarter of the bar: the junction is where 15 of 60 minutes end.
  const bar = await page.getByTestId("home-goal-bar").boundingBox();
  const box = await tick.boundingBox();
  // The block is as wide as the track, so the recorded fill is a quarter of it.
  const idleWidth = idle!.width;
  expect(box!.x + box!.width / 2).toBeCloseTo(bar!.x + bar!.width, 0);
  expect(bar!.width / idleWidth).toBeCloseTo(0.25, 2);

  // **It does not change the block.** The tick is absolutely placed, so the
  // block is the height it was when idle.
  const walking = await page.getByTestId("home-goal").boundingBox();
  expect(walking!.height).toBeCloseTo(idle!.height, 0);
  expect(walking!.y).toBeCloseTo(idle!.y, 0);
});

test("draws no tick on a day exactly at the goal, where lap two has recorded nothing yet", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { earlier, running } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 60 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");

  // 60 of 60 is the foot of lap two: the ground is Aqua and the recorded fill
  // over it is empty, with a walk running. The tick marks where recorded
  // minutes end, and on an empty fill that is the left edge, separating nothing
  // from the walk — so it is withheld because nothing is recorded on this lap,
  // not because the goal is met. One minute further and it does draw.
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("home-goal-met")).toBeVisible();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
});

test("draws no tick on the first walk of the day, where nothing is recorded yet", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // Nothing recorded, so there is no junction: the line would sit on the
  // bar's left edge, 1 dp outside the track, separating nothing from the
  // walk in progress.
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
});

test("sweeps the bar while a walk runs, and only then", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeVisible();
  await expect(page.getByTestId("home-goal-sweep")).toHaveCount(0);
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-sweep")).toBeVisible();
  await expect(page.getByTestId("home-goal-sweep")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  // **Inside the track, so the track's rounded clip is the band's.** Beside
  // it, the band's own square clip painted square corners into the bar's
  // rounded ends on every pass of every walk.
  const insideTrack = await page
    .getByTestId("home-goal-sweep")
    .evaluate(
      (el) =>
        el.parentElement ===
        document.querySelector('[data-testid="home-goal-bar"]')?.parentElement,
    );
  expect(insideTrack, "the sweep should be a child of the track").toBe(true);
});

test("sweeps nothing for a tutor who asked for no animation", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-control").click();
  // The walk is running — the dot proves the state is real — and the band
  // is absent rather than slow.
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-sweep")).toHaveCount(0);
});

/**
 * **One bar, two grounds, and the band has to answer both.** Measured on the
 * device: a pale band over the dark track lifts the red channel by 123 and
 * over the recorded fill by 20, so on a day with minutes already banked the
 * band crossed half the bar unseen. Cutting the tone at the junction took the
 * weak half to −67, measured on the phone, and that is what this pins. A
 * second answer was tried alongside it — making the band taller than the bar —
 * and removed: it bought nothing the tone had not already bought, and it
 * coarsened the half that was never broken.
 *
 * The goal is 60 min here and 30 are recorded, so there is a junction in the
 * middle of the bar and both halves exist.
 */
test("takes the opposite tone of each half of the bar it crosses", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { earlier, running } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  const sweep = page.getByTestId("home-goal-sweep");
  await expect(sweep).toBeVisible();

  // Two bands, not one: a dark one over the light recorded fill and the light
  // one over the dark track. A single tone here is the defect coming back.
  const tones = await sweep.evaluate((el) =>
    [...el.querySelectorAll("stop")].map(
      (s) => s.getAttribute("stop-color") ?? "",
    ),
  );
  expect(new Set(tones)).toEqual(
    new Set([colors.onAccent, colors.textPrimary]),
  );

  // And it stays the bar's own height: the tick is the one mark that rises
  // above the track, and nothing that merely passes may compete with it.
  const band = await sweep.boundingBox();
  const tick = await page.getByTestId("home-goal-tick").boundingBox();
  expect(band, "the band should be drawn").not.toBeNull();
  expect(tick, "the tick should be drawn").not.toBeNull();
  expect(band!.height).toBeLessThan(tick!.height);
});

/**
 * **The bar is two tones at once, and these read them apart.**
 *
 * The ground is the tier the day reached and the fill is the way to the next,
 * so a day on lap two (Aqua under violet) and a day past double (violet with
 * nothing over it) differ only in which element carries which colour. One
 * element each, one testID each, or the pair cannot be told apart at all.
 *
 * Reported as a hex string, because `tokens.ts` is where this file takes the
 * palette from and `getComputedStyle` answers in `rgb()`.
 */
function hexOf(css: string): string {
  const [r, g, b] = (css.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  return `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

async function groundColour(page: Page): Promise<string> {
  return hexOf(
    await page
      .getByTestId("home-goal-ground")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  );
}

async function fillColour(page: Page): Promise<string> {
  return colourOf(page, "home-goal-bar");
}

/** The background any one part of the bar is drawn in, as a hex string. */
async function colourOf(page: Page, id: string): Promise<string> {
  return hexOf(
    await page
      .getByTestId(id)
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  );
}

/**
 * The drawn width of one of the bar's parts, in CSS pixels.
 *
 * `boundingBox()` is no use here: Playwright calls a zero-width element
 * invisible and answers `null`, and zero width is exactly the reading that
 * tells a day sitting on a tier from a day past it.
 */
function widthOf(page: Page, id: string): Promise<number> {
  return page
    .getByTestId(id)
    .evaluate((el) => el.getBoundingClientRect().width);
}

test("turns Aqua at the goal and starts the second lap over it", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 180 },
  ]);
  await seedSession(page);
  await page.goto("/");

  // 180 of 120 is lap two, half way: the ground is Aqua and the fill violet.
  await expect(page.getByTestId("home-goal-measure")).toContainText("de 4h");
  const ground = await groundColour(page);
  const fill = await fillColour(page);
  expect(ground).toBe(colors.accent);
  expect(fill).toBe(colors.accentFocus);

  // Half way along a lap that is as long as the first one, which is the
  // whole visual argument for deriving the top tier as double.
  const across =
    (await widthOf(page, "home-goal-bar")) /
    (await widthOf(page, "home-goal-ground"));
  expect(across).toBeCloseTo(0.5, 2);

  // Lap one is still said in words, because the bar no longer says it alone.
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido",
  );
});

test("a day exactly at the goal is Aqua with no second lap showing", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  // 120 of 120: the whole bar Aqua, the violet fill zero-width.
  // Asserts the column the artboard settled: Aqua is still the signal for met.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 120 },
  ]);
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-goal-measure")).toContainText("2h de 4h");
  expect(await groundColour(page)).toBe(colors.accent);
  // **The foot of lap two, not the head of lap one.** A day that lands on the
  // goal has nothing left for a lap-one fill to say — the whole bar is already
  // Aqua — so the fill wraps to zero and the second lap begins empty.
  expect(await widthOf(page, "home-goal-bar")).toBe(0);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido",
  );
});

test("a day past double is violet throughout", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  // 260 of 120: ground violet, no further fill.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 260 },
  ]);
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-goal-measure")).toContainText(
    "4h 20m de 4h",
  );
  expect(await groundColour(page)).toBe(colors.accentFocus);
  // There is no third lap to start, so nothing is painted over the violet.
  expect(await widthOf(page, "home-goal-bar")).toBe(0);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido x2",
  );
});

test("a day at exactly double is violet throughout, with nothing over it", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  // 240 of 120: the top of the scale, the other half of the wrap rule that
  // 120 of 120 pins at the bottom. There is no third lap, so the fill is
  // suppressed rather than full.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 240 },
  ]);
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-goal-measure")).toContainText("4h de 4h");
  expect(await groundColour(page)).toBe(colors.accentFocus);
  expect(await widthOf(page, "home-goal-bar")).toBe(0);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido x2",
  );
});

test("re-reads every tier when the goal is edited under a running walk", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  // Seed 150 recorded against a 120 goal (lap two), start a walk, change the
  // goal to 300 in Perfil, come back: the bar is lap one at half, the measure
  // says "de 10h", and nothing is left painted violet. Every tier is derived
  // from the goal the screen is holding right now, and a stale one would show
  // here as a bar still wearing the old lap's colours.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 150 },
  ]);
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-goal-measure")).toContainText(
    "2h 30m de 4h",
  );
  expect(await groundColour(page)).toBe(colors.accent);
  expect(await fillColour(page)).toBe(colors.accentFocus);

  // **Started from the control, so it is under a minute old** — the stop at
  // the end then discards it as a mis-tap and the recorded total is still the
  // 150 that was seeded, whatever the navigation cost.
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  await page.goto("/profile");
  await page.getByTestId("profile-edit-health").click();
  await page.getByTestId("profile-exercise-goal").fill("300");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-goal-value")).toHaveText("5h");

  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  // 150 of 300 is lap one at half: the empty track under a Mist fill, and
  // not a trace of either violet left anywhere on the bar.
  expect(await groundColour(page)).toBe(colors.surface);
  expect(await fillColour(page)).toBe(colors.textSecondary);
  const across =
    (await widthOf(page, "home-goal-bar")) /
    (await widthOf(page, "home-goal-ground"));
  expect(across).toBeCloseTo(0.5, 2);
  await expect(page.getByTestId("home-goal-met")).toHaveCount(0);

  // And the measure counts against the new top tier once the walk is out of
  // the way — while one runs it says the walk instead, as it always has.
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal")).toContainText("de 10h");
});

test("laps the live segment past the floor, and leaves the ground alone", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // 30 min recorded against a 60-minute goal and a walk 45 minutes old: 75 of
  // 60 is a quarter of the way into lap two, while the *recorded* total is
  // still only half of lap one.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 45 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "45 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  // **The ground is the tier the recorded minutes reached, and only a real
  // stop turns it.** That asymmetry is the feature: a bar lapping in grey is
  // itself the signal that something has not been saved, so a walk left
  // running by mistake can never pass for a finished day.
  expect(await groundColour(page)).toBe(colors.surface);
  await expect(page.getByTestId("home-goal-met")).toHaveCount(0);

  const bar = await widthOf(page, "home-goal-ground");
  // Lap one is completed in its own live tone, from the saved edge…
  expect(await widthOf(page, "home-goal-bar")).toBeCloseTo(bar * 0.5, 0);
  expect(await colourOf(page, "home-goal-live")).toBe(colors.textTertiary);
  expect(await widthOf(page, "home-goal-live")).toBeCloseTo(bar * 0.5, 0);
  // …and a second band is drawn from the left edge in the next lap's. Its
  // width is the one reading here that moves with the clock: 75 of 60 is a
  // quarter of lap two, and a setup that crossed a minute makes it 76.
  expect(await colourOf(page, "home-goal-lap")).toBe(colors.accentFocusDim);
  expectMinutes((await widthOf(page, "home-goal-lap")) / bar, 15, 16, 60);
  const left = await page.getByTestId("home-goal-ground").boundingBox();
  const band = await page.getByTestId("home-goal-lap").boundingBox();
  expect(band!.x).toBeCloseTo(left!.x, 0);

  // The tick does not move with it: it still marks the saved/live boundary,
  // which is where the recorded minutes stop.
  const tick = await page.getByTestId("home-goal-tick").boundingBox();
  expect(tick!.x + tick!.width / 2).toBeCloseTo(left!.x + bar * 0.5, 0);
});

test("draws no bar at all for a pet with no goal, as before", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  // The constraint that a tutor without a goal keeps today's behaviour
  // exactly: no bar on the day view, no underline in the calendar, and the
  // measure says what it says today. This is the regression the tiers could
  // silently break, since every new branch keys off a goal that is there.
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: null });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 30 },
  ]);
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("home-goal-measure")).toHaveText(
    "30 min paseados",
  );
  await expect(page.getByTestId("home-goal-ground")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-bar")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-met")).toHaveCount(0);

  await page.getByTestId("home-day").click();
  await expect(page.getByTestId("home-calendar")).toBeVisible();
  await expect(page.getByLabel(/objetivo conseguido/)).toHaveCount(0);
  await closeCalendar(page);
});

/**
 * **The close is asserted settled, except where noted.** It runs for 760 ms and
 * Playwright cannot be parked inside it: this file's own header records that
 * `page.clock.setFixedTime` stops Reanimated dead and `install` + `resume`
 * keeps the day view from rendering at all. So what these pin is where the
 * bar comes to rest — the overlay gone, the live marks gone, and the fill
 * holding the tone its props give it. The overlay carries `home-goal-close`,
 * so `toHaveCount(0)` is the settled state.
 *
 * The first of them stops inside the first minute, which deletes the row as a
 * mis-tap, so it pins the other half of the rule too: a close that added no
 * minutes says nothing. The rest write on the walk before stopping it, which
 * closes it at the one minute the column accepts, so each of those is a real
 * close.
 *
 * Where a spec has to see the overlay rather than its absence it arms
 * `page.waitForSelector` before the tap — a settled assertion would retry
 * straight past the 760 ms. What keeps the drawing itself from being
 * deletable in silence is further down the file: `barFrames`, `tickFrames`
 * and `widthInFlight` sample the bar on every frame, the way
 * `shakeTranslation` does.
 */
test("lands a closed walk in the recorded tone, and clears the live segment", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
});

test("lands the minute a walk that was written on recorded", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);

  // Stopped inside the first minute, but written on — so the row is closed at
  // the one minute the column accepts rather than deleted, and that minute is
  // what the close animates.
  //
  // **The one assertion in this file that catches the close in the air, and
  // it is here because nothing else in the suite would notice the whole
  // animation being deleted.** Every other close spec asserts an absence,
  // which an unbuilt overlay satisfies exactly as well as a settled one.
  //
  // **Armed before the tap, because the overlay no longer waits for the
  // reload.** It mounts on the stop and is gone 760 ms later, so a settled
  // assertion afterwards could retry straight past it.
  const mounted = page.waitForSelector('[data-testid="home-goal-close"]', {
    state: "attached",
  });
  await page.getByTestId("home-goal-control").click();
  await mounted;

  // And then it goes, leaving the fill holding the tone it already had.
  await expect(page.getByTestId("home-goal")).toContainText("1 min de 2h");
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
});

test("does not animate a close onto a day that is not the walk's", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  // **Written on before it is stopped, or there is no close to withhold.** A
  // walk stopped inside its first minute is deleted as a mis-tap and adds no
  // minutes, so nothing is recorded and this would pass over a day gate that
  // had been deleted. Written on, the row is closed at a minute instead.
  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal")).toContainText("1 min de 2h");

  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");
  // Never, rather than "gone by the time we looked" — the same reason the
  // replay spec below waits to be disappointed. Yesterday's bar would have
  // animated for 760 ms, and a settled assertion would simply retry past it.
  await expect(
    page.waitForSelector('[data-testid="home-goal-close"]', {
      state: "attached",
      timeout: 2000,
    }),
  ).rejects.toThrow();
});

test("does not replay a close on the way back to the day it happened on", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal")).toContainText("1 min de 2h");

  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-goal")).toContainText("0 min de 2h");
  await page.getByTestId("home-next-day").click();
  await expect(page.getByTestId("home-goal")).toContainText("1 min de 2h");

  // **Never, rather than "gone by the time we looked".** The settled
  // assertion the others make cannot tell a replay from no replay here: the
  // overlay would stand for 760 ms and `toHaveCount(0)` would simply retry
  // past it. The block unmounts behind the skeleton while the other day
  // loads, so it comes back with no memory of what it has already played —
  // the close has to have been let go of by then, which is what this waits
  // to be disappointed by.
  await expect(
    page.waitForSelector('[data-testid="home-goal-close"]', {
      state: "attached",
      timeout: 2000,
    }),
  ).rejects.toThrow();
});

test("settles twice when two walks are closed in succession", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  // **Each walk is written on before it is stopped, or neither is a close.**
  // A walk stopped inside its first minute is deleted as a mis-tap and adds
  // nothing, so with no note on either this passed with the whole close
  // feature removed — under the one title that claims the double close. Both
  // are real closes now, at the one minute the column accepts, which is what
  // the running total below counts.
  for (const total of [1, 2]) {
    await page.getByTestId("home-goal-control").click();
    const row = page
      .locator('[data-testid^="home-entry-"]')
      .filter({ hasText: "En marcha" });
    await expect(row).toHaveCount(1);
    await row.click();
    await page.getByTestId("entry-note").fill(`Paseo ${total}`);
    await page.getByTestId("entry-save").click();
    await expect(page.getByTestId("entry-title")).toHaveCount(0);
    // Armed before the tap: the overlay mounts on the stop now, so it has to
    // be waited for from before there is anything to wait for.
    const mounted = page.waitForSelector('[data-testid="home-goal-close"]', {
      state: "attached",
    });
    await page.getByTestId("home-goal-control").click();
    // The overlay is mounted for this close, so it was one — and it goes.
    await mounted;
    await expect(page.getByTestId("home-goal")).toContainText(
      `${total} min de 2h`,
    );
    await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
    await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  }
});

/**
 * **The close that used to be about the whole bar, and now lands on lap two.**
 *
 * 60 min recorded against a 60 min goal, and a walk of two minutes on top. On
 * a bar that ended at the goal these minutes fell past its edge; with a second
 * lap above it they have somewhere to go — the fill starts at the foot of lap
 * two, over an Aqua ground, and converts in violet.
 */
test("lands a close on the second lap, over a bar that is already Aqua", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { earlier, running } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 60 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  expect(await groundColour(page)).toBe(colors.accent);

  // Two minutes of a 60-minute goal is 3.3% of the bar, so the conversion is
  // caught somewhere inside that — travelled, not simply set.
  const travelled = widthInFlight(
    page,
    "home-goal-close-lap-1-fill",
    0.004,
    0.03,
  );
  await page.getByTestId("home-goal-control").click();
  await travelled;

  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  // And the bar is still Aqua underneath, with lap two's violet over it.
  expect(await groundColour(page)).toBe(colors.accent);
  expect(await fillColour(page)).toBe(colors.accentFocus);
});

/**
 * **The two halves of the handover, read off one sampler.**
 *
 * 30 min recorded and a walk of 31 against a 60-minute goal: 61 of 60 crosses
 * the goal inside the one fill. What this pins is that the bar is never in two
 * minds — not in width, which the no-shrink spec above owns, and not in tone:
 * the ground may not turn Aqua until the fill has arrived there, and with the
 * reload no longer gated it lands somewhere inside these 760 ms and would turn
 * it early for anyone who fixed only the width.
 *
 * **And nothing is celebrated.** Tier 1 is the everyday now — most days clear
 * it — and the everyday is not celebrated. The ground turning and the label
 * under the bar are the whole of what a goal met gets.
 */
test("crosses the goal inside one fill, with no confetti", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 31 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "31 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  // Before the stop the day is on lap one: the empty track under a Mist fill.
  await expect.poll(() => groundColour(page)).toBe(colors.surface);
  expect(await fillColour(page)).toBe(colors.textSecondary);

  const sampling = barFrames(page, 3_000, "home-goal-close-lap-0-fill");
  await page.getByTestId("home-goal-control").click();
  const { bar, frames } = await sampling;

  // **The bar is painted across its whole width from before the press**, and
  // that is not what is being watched here: the live segment had already
  // lapped, so the painted width cannot say where the conversion has got to.
  // The lap's own fill can.
  expect(Math.min(...frames.map((f) => f.painted))).toBeCloseTo(bar, 0);

  // It travelled: lap one's fill is caught at readings that are neither where
  // it began (half the bar) nor where it ends (all of it).
  const converting = frames.filter((f) => f.probe >= 0 && f.probe < bar - 0.5);
  expect(converting.filter((f) => f.probe > bar * 0.55).length).toBeGreaterThan(
    3,
  );

  // **And no frame turned the ground before the fill got there.** Every frame
  // with the conversion still under way is wearing the empty track, not Aqua
  // — which is the half of the handover a builder who fixed only the width
  // would ship, since the reload lands somewhere inside these 760 ms.
  expect(converting.map((f) => f.ground)).toEqual(
    converting.map(() => colors.surface),
  );
  expect(frames[frames.length - 1].ground).toBe(colors.accent);

  // It comes to rest Aqua, with a minute of lap two in violet over it, and
  // the conclusion said under the bar.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido",
  );
  await expect.poll(() => groundColour(page)).toBe(colors.accent);
  expect(await fillColour(page)).toBe(colors.accentFocus);
  expect(await widthOf(page, "home-goal-bar")).toBeGreaterThan(0);

  // The everyday is not celebrated.
  await expect(page.getByTestId("celebration")).toBeHidden();
});

test("converts a lapped walk without dropping its second band", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // 50 min recorded against a 60-minute goal and a walk of 30 on top: the
  // live segment has lapped, so before the stop the left third of the bar is
  // wearing lap two's live violet over a lap one that is otherwise Mist.
  //
  // **The painted width is blind to this.** It is the whole bar before the
  // stop and the whole bar throughout the close, so the no-shrink spec cannot
  // see a band inside the paint reverting to the tone underneath it. A point
  // can: sampled at 15% of the bar, the close may hand it from lap two's live
  // violet to lap two's saved violet and to nothing else. A frame of Mist
  // there is the lapped band having been dropped for the first slice of the
  // animation — the smaller version of exactly the backwards step this whole
  // gesture exists to remove.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 30 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "30 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 50 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  // The lapped band is there before the stop, and reaches past the point
  // this spec watches.
  expect(await colourOf(page, "home-goal-lap")).toBe(colors.accentFocusDim);
  expect(
    (await widthOf(page, "home-goal-lap")) /
      (await widthOf(page, "home-goal-ground")),
  ).toBeGreaterThan(0.25);

  const sampling = barFrames(page, 3_000, "", 0.15);
  await page.getByTestId("home-goal-control").click();
  const { frames } = await sampling;

  // Violet throughout — the live one while the band is still unconverted, the
  // saved one once the fill has passed. Never the tone of the lap underneath.
  const violets: string[] = [colors.accentFocusDim, colors.accentFocus];
  const strangers = frames.filter((f) => !violets.includes(f.tone));
  expect(strangers.map((f) => f.tone)).toEqual([]);

  // And it did convert: both tones appear, so the point was handed over
  // rather than simply left alone.
  expect(frames.some((f) => f.tone === colors.accentFocusDim)).toBe(true);
  expect(frames.some((f) => f.tone === colors.accentFocus)).toBe(true);

  // It settles on lap two, a third of the way along, over an Aqua ground.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect.poll(() => groundColour(page)).toBe(colors.accent);
  expect(await fillColour(page)).toBe(colors.accentFocus);
});

test("crosses both tiers in one close and still celebrates once", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // 15 min recorded against a 30-minute goal and a walk of 46 on top: 61 of
  // 60 is past double, so the one gesture passes both tiers. 30 is the floor a
  // goal can have, so the tiers cannot be made closer than this; the recorded
  // walk is half the goal to keep lap one starting where it always did, and the
  // live walk is what has to grow — which costs the first 47 minutes of the
  // day, when 46 minutes ago is still yesterday.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 46 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "46 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 30 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 15 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("celebration")).toBeHidden();

  // Lap one converts and hands over to lap two inside the same gesture.
  const lapOne = widthInFlight(page, "home-goal-close-lap-0-fill", 0.55, 0.95);
  const lapTwo = widthInFlight(page, "home-goal-close-lap-1-fill", 0.1, 0.9);
  await page.getByTestId("home-goal-control").click();
  await lapOne;
  await lapTwo;

  // The bar ends violet throughout, with nothing over it, and says so.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect.poll(() => groundColour(page)).toBe(colors.accentFocus);
  expect(await widthOf(page, "home-goal-bar")).toBe(0);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido x2",
  );

  // **Once, at the second tier and not at the first.** Two crossings in one
  // animation is still one day doubled.
  await expect(page.getByTestId("celebration")).toBeVisible();
  await expect(page.getByTestId("celebration")).toHaveCount(0);
  await expect(
    page.waitForSelector('[data-testid="celebration"]', {
      state: "attached",
      timeout: 2_000,
    }),
  ).rejects.toThrow();
});

test("says nothing when the day is already past the top tier", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // 65 min recorded against a 30-minute goal is already past double (60), so
  // the minutes this walk adds fall off the end of the bar. The silence is
  // deliberate: the day is already said. (The goal cannot go under 30, and 45
  // would sit between the tiers, which is a different test.)
  const { earlier, running } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 30 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 65 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  expect(await groundColour(page)).toBe(colors.accentFocus);

  const sampling = barFrames(page, 2_500);
  const never = neverCloses(page);
  await page.getByTestId("home-goal-control").click();
  const { bar, frames } = await sampling;
  await never;

  // No overlay mounted, and the bar did not flicker: every frame is the same
  // violet across the same full width.
  expect(frames.map((f) => f.ground)).toEqual(
    frames.map(() => colors.accentFocus),
  );
  expect(Math.min(...frames.map((f) => f.painted))).toBeCloseTo(bar, 0);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido x2",
  );
});

test("paints the end state at once for a tutor who asked for no animation", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // The same tier-crossing close as above, with motion off: "absent" has to
  // mean the bar is painted at the fill's end state on the stop, not that the
  // 400 ms hole comes back for exactly the tutors who asked for less movement.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 31 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "31 minutes ago is still yesterday, or before the recorded walk",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  const sampling = barFrames(page, 2_500);
  const never = neverCloses(page);
  await page.getByTestId("home-goal-control").click();
  const { bar, frames } = await sampling;
  await never;

  // No overlay was ever mounted, and the bar never lost the walk on the way
  // to its end state.
  expect(Math.min(...frames.map((f) => f.painted))).toBeGreaterThanOrEqual(
    frames[0].painted - 0.5,
  );
  expect(frames[frames.length - 1].painted).toBeCloseTo(bar, 0);

  // The right ground as well as the right width: 61 of 60 is a minute into
  // lap two, so the bar is Aqua with a violet sliver over it.
  await expect.poll(() => groundColour(page)).toBe(colors.accent);
  expect(await fillColour(page)).toBe(colors.accentFocus);
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido",
  );
});

test("holds the fill when the reload never comes", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // The close succeeds and every read after it fails. The fill has animated
  // to a value the data never confirms, and it must hold there rather than
  // snapping back to the width from before the walk: a failed action must not
  // take the diary away, and saying so is the toast's job, not the bar's.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 31 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "31 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  // Only the reads are cut: the PATCH that closes the walk goes through.
  await page.route("**/rest/v1/pet_events*", (route) =>
    route.request().method() === "GET" ? route.abort() : route.continue(),
  );

  const sampling = barFrames(page, 3_000);
  await page.getByTestId("home-goal-control").click();
  const { bar, frames } = await sampling;
  const at = frames[0].painted;

  expectMinutes(at / bar, 61, 62, 120);
  expect(Math.min(...frames.map((f) => f.painted))).toBeGreaterThanOrEqual(
    at - 0.5,
  );

  // And it is still there once everything has settled: 61 of 120, drawn
  // from numbers the close carried rather than from rows that never came.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  expectMinutes(
    (await widthOf(page, "home-goal-bar")) /
      (await widthOf(page, "home-goal-ground")),
    61,
    62,
    120,
  );
  // **And the measure says the same number the bar is painted at.** The rows
  // never came, so the only minutes anybody knows are the ones the close
  // carried — the line above the bar reads them too, rather than counting a
  // log it could not read and announcing nought.
  await expect(page.getByTestId("home-goal-measure")).toHaveText(
    /^1h [12]m de 4h paseados$/,
  );
  await page.unroute("**/rest/v1/pet_events*");
});

/**
 * **A close that commits onto a reload that never answers, and the two halves
 * of the block must agree.** This is the shape the household actually meets:
 * the phone drops the house wifi on the stairs, the `PATCH` gets through and
 * the pet read does not. The bar holds what the close carried — that part was
 * already right — and the measure used to count an empty log and state
 * "0 min de 2h paseados" directly above a bar painted past the goal and a
 * label reading "Objetivo conseguido". A tutor cannot tell which half is real,
 * and the one they read every day is the number.
 *
 * PRODUCT.md's rule is the same one the log's own region obeys: an empty state
 * may never stand in for a failed read. Zero minutes is a claim about the dog's
 * day; an unread log is a claim about the network.
 */
test("keeps the measure and the bar agreeing when a close lands and the reload does not", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 10 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "ten minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 55 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  // Only the pet read is cut, so the walk really is closed on the server and
  // it is the reload that cannot confirm it.
  const pets = /\/rest\/v1\/pets\b/;
  await page.route(pets, (route) => route.abort());
  const gaveUp = failedReads(page, pets, 4);
  await page.getByTestId("home-goal-control").click();
  await gaveUp;
  await page.waitForTimeout(750);

  // The read failed and says so, and the day is not reported as empty.
  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-empty")).toHaveCount(0);

  // 65 of 60 is five minutes into lap two: an Aqua ground under a short
  // violet fill, which is the close the bar is holding.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect.poll(() => groundColour(page)).toBe(colors.accent);
  expectMinutes(
    (await widthOf(page, "home-goal-bar")) /
      (await widthOf(page, "home-goal-ground")),
    5,
    6,
    60,
  );
  await expect(page.getByTestId("home-goal-met")).toHaveText(
    "Objetivo conseguido",
  );
  // The line that used to contradict both of them.
  await expect(page.getByTestId("home-goal-measure")).toHaveText(
    /^1h [56]m de 2h paseados$/,
  );

  await page.unroute(pets);
});

test("lands a close with no animation at all for a tutor who asked for none", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSession(page);
  await page.goto("/");
  // **Written on first, so this is a close and not a mis-tap.** An immediate
  // stop deletes the row, and a close that recorded nothing animates nothing
  // whatever the tutor asked for — which would leave this proving the
  // commitment against a case that never reaches it. It also leaves the fill
  // at 0% wide, which Playwright reads as hidden.
  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await page.getByTestId("home-goal-control").click();

  // No overlay is ever mounted, and the bar is still right: the tone and
  // the thickness come from props, which is what makes "absent" true rather
  // than "too quick to catch".
  await expect(page.getByTestId("home-goal")).toContainText("1 min de 2h");
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-bar")).toBeVisible();
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
});

/**
 * Samples the bar on every frame for `ms`, starting now: how far right it is
 * painted, and what colour it is wearing while it is.
 *
 * **"Painted" is everything on the bar that is not the empty track**, which is
 * the only definition that survives a tier crossing: at the goal the ground
 * itself turns Aqua and carries the whole width, so a measure that looked only
 * at the fills would read a bar that had just become whole as a bar that had
 * emptied. Transparent boxes — the sweep's clips, the close overlay's
 * wrapper — contribute nothing, and neither does a ground still in the
 * track's own colour.
 *
 * **`ground` is the topmost ground actually drawn**, the real one or the lap
 * the close has reached, so the pair answers the two halves of the handover
 * in one reading: a frame whose ground has turned while the painted width is
 * still short of the bar is a bar in two minds about its tone.
 *
 * `probe` is one more element to measure on every frame — a lap of the close
 * overlay, whose own width is the only thing that says where the conversion
 * has got to once the painted width is already the whole bar. It reads −1 on
 * a frame where that element is not mounted.
 *
 * **`at` is a point on the bar, as a share of its width, and `tone` is the
 * colour painted there** — the topmost band covering it, ticks excluded. The
 * painted width is blind to anything that happens *inside* the paint, which
 * is exactly where a lapped close could drop a band and step backwards
 * without the bar getting any shorter. A point reads what an eye reads.
 *
 * The first frame is sampled before the promise yields, so a caller can check
 * it began before the press rather than after it — a sampler that started
 * late would see no drop and pass for the wrong reason.
 */
function barFrames(page: Page, ms: number, probe = "", at = -1) {
  return page.evaluate(
    ([sampleMs, track, watched, point]) =>
      new Promise<{
        bar: number;
        frames: {
          painted: number;
          ground: string;
          probe: number;
          tone: string;
        }[];
      }>((resolve) => {
        const hex = (css: string): string => {
          const rgba = (css.match(/[\d.]+/g) ?? []).map(Number);
          if (rgba.length < 3) return "";
          if (rgba.length > 3 && rgba[3] === 0) return "";
          return `#${rgba
            .slice(0, 3)
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("")}`.toUpperCase();
        };
        const sample = () => {
          const bar = document.querySelector(
            '[data-testid="home-goal-ground"]',
          );
          const seen = watched
            ? document.querySelector(`[data-testid="${watched}"]`)
            : null;
          const measured = seen ? seen.getBoundingClientRect().width : -1;
          if (!bar)
            return { painted: 0, ground: "", probe: measured, tone: "" };
          const close = document.querySelector(
            '[data-testid="home-goal-close"]',
          );
          const nodes: Element[] = [bar, ...bar.querySelectorAll("*")];
          if (close) nodes.push(...close.querySelectorAll("*"));
          const left = bar.getBoundingClientRect().left;
          const spot =
            point >= 0 ? left + point * bar.getBoundingClientRect().width : NaN;
          let painted = 0;
          let ground = "";
          let tone = "";
          for (const el of nodes) {
            const style = getComputedStyle(el);
            if (Number(style.opacity) === 0) continue;
            const painting = hex(style.backgroundColor);
            if (painting === "") continue;
            const box = el.getBoundingClientRect();
            const id = el.getAttribute("data-testid") ?? "";
            // The grounds are the only full-width layers, and the last one
            // drawn is the one the eye sees.
            if (id === "home-goal-ground" || id.endsWith("-ground")) {
              if (box.width > 0) ground = painting;
            }
            // A tick is 2 dp of furniture standing over the bands rather than
            // one of them, so it is not what is painted at a point.
            if (
              !id.endsWith("-tick") &&
              box.width > 0 &&
              box.left <= spot &&
              box.right >= spot
            ) {
              tone = painting;
            }
            if (painting === track) continue;
            painted = Math.max(painted, box.right - left);
          }
          return { painted, ground, probe: measured, tone };
        };
        const frames = [sample()];
        const began = performance.now();
        const step = () => {
          frames.push(sample());
          if (performance.now() - began >= sampleMs) {
            resolve({
              bar:
                document
                  .querySelector('[data-testid="home-goal-ground"]')
                  ?.getBoundingClientRect().width ?? 0,
              frames,
            });
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    [ms, colors.surface, probe, at] as const,
  );
}

/**
 * Asserts a share of the bar is worth somewhere between `low` and `high`
 * minutes of `goal`.
 *
 * **A span of whole minutes is the only promise this suite can make.** A walk
 * seeded at `now − 31 min` is 31 minutes old until a full 60 s has passed
 * between the seeding and the measurement, and then it is 32; a cold run is
 * not bounded, and the component's own clock is refreshed only every 30 s, so
 * the close can record a minute more than the segment was painted at. One
 * minute of a two-hour goal moves the ratio by 0.0083, where
 * `toBeCloseTo(…, 2)` admits 0.005 — the class of half-the-day failure this
 * file's header is about. The 0.002 either side is for sub-pixel layout, not
 * for time.
 */
function expectMinutes(share: number, low: number, high: number, goal: number) {
  expect(share).toBeGreaterThan(low / goal - 0.002);
  expect(share).toBeLessThan(high / goal + 0.002);
}

/**
 * Samples the close's tick against the leading edge of the fill it is
 * supposed to be riding, on every frame for `ms`. Frames where either is
 * absent are skipped, so the length of the result is how long the close was
 * drawing a tick at all.
 */
function tickFrames(page: Page, ms: number) {
  return page.evaluate(
    ([sampleMs]) =>
      new Promise<{ bar: number; frames: { tick: number; edge: number }[] }>(
        (resolve) => {
          const sample = () => {
            const bar = document.querySelector(
              '[data-testid="home-goal-ground"]',
            );
            const tick = document.querySelector(
              '[data-testid="home-goal-close-tick"]',
            );
            const fill = document.querySelector(
              '[data-testid="home-goal-close-lap-0-fill"]',
            );
            if (!bar || !tick || !fill) return null;
            const left = bar.getBoundingClientRect().left;
            const mark = tick.getBoundingClientRect();
            const edge = fill.getBoundingClientRect().right;
            return {
              tick: mark.left + mark.width / 2 - left,
              edge: edge - left,
            };
          };
          const frames: { tick: number; edge: number }[] = [];
          const began = performance.now();
          const step = () => {
            const got = sample();
            if (got !== null) frames.push(got);
            if (performance.now() - began >= sampleMs) {
              resolve({
                bar:
                  document
                    .querySelector('[data-testid="home-goal-ground"]')
                    ?.getBoundingClientRect().width ?? 0,
                frames,
              });
              return;
            }
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        },
      ),
    [ms] as const,
  );
}

/**
 * Resolves on the first frame where an element covers a share of the bar
 * strictly inside `(low, high)` — travelled, not arrived.
 *
 * The settled state is where the bar would be with no animation at all, so it
 * cannot tell a width that moved from one that was simply set. A reading that
 * is neither endpoint can only come from the interpolation. Polled on every
 * frame from before the press, the way `shakeTranslation` is, because the
 * close cannot be parked inside.
 */
function widthInFlight(page: Page, id: string, low: number, high: number) {
  return page.waitForFunction(
    ([target, lo, hi]) => {
      const el = document.querySelector(`[data-testid="${target}"]`);
      const bar = document.querySelector('[data-testid="home-goal-ground"]');
      if (!el || !bar) return false;
      const width = bar.getBoundingClientRect().width;
      if (width === 0) return false;
      const share = el.getBoundingClientRect().width / width;
      return share > lo && share < hi;
    },
    [id, low, high] as const,
    { polling: "raf", timeout: 5_000 },
  );
}

/** The close overlay, which must never be attached at all. */
function neverCloses(page: Page) {
  return expect(
    page.waitForSelector('[data-testid="home-goal-close"]', {
      state: "attached",
      timeout: 2_000,
    }),
  ).rejects.toThrow();
}

test("fills from the tick without the bar ever shrinking", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **The defect this whole task replaces, and the one assertion that pins
  // it.** Measured on the tutor's video: the bar painted to x=403 while the
  // walk ran, dropped to x=207 for about 400 ms as the live segment unmounted
  // ahead of the reload, and only then grew back. Nothing else in the suite
  // notices that hole, because every other close spec asserts where the bar
  // comes to rest.
  //
  // 30 min recorded and a walk of 31 against a 120-minute goal: 61 of 120 is
  // half of lap one, so the close lands inside the lap it started on and the
  // ground never turns. A crossing close is the next test's business.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 31 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "31 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("home-goal-tick")).toBeVisible();

  const sampling = barFrames(page, 3_000);
  await page.getByTestId("home-goal-control").click();
  const { bar, frames } = await sampling;
  const at = frames[0].painted;

  // The sampler was running before the press: 61 of 120 minutes is half the
  // bar, and 30 of 120 — the recorded fill alone — is a quarter. Without this
  // a sampler that started late would measure the hole as its own baseline.
  expectMinutes(at / bar, 61, 62, 120);

  // And the bar never lost the walk.
  expect(Math.min(...frames.map((f) => f.painted))).toBeGreaterThanOrEqual(
    at - 0.5,
  );

  // It settles where the data says, with the live marks gone.
  await expect(page.getByTestId("home-goal")).toHaveText(/1h [12]m de 4h/);
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
  expectMinutes(
    (await widthOf(page, "home-goal-bar")) /
      (await widthOf(page, "home-goal-ground")),
    61,
    62,
    120,
  );
});

test("rides the tick on the fill's leading edge while the close converts", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // The same close as above — 30 recorded and a walk of 31 against a
  // 120-minute goal, inside one lap. During the conversion the fill's leading
  // edge *is* the saved/live boundary, which is the one thing the tick has
  // ever marked, so it travels with it from the junction to the end. Nothing
  // else in the file would notice the mark being pinned to a constant or
  // deleted outright, and the headline spec above is named after it.
  const now = new Date();
  const earlier = new Date(now);
  earlier.setHours(0, 1, 0, 0);
  const running = new Date(now.getTime() - 31 * 60_000);
  test.skip(
    running.getDate() !== now.getDate() || running <= earlier,
    "31 minutes ago is still yesterday, or before the recorded walk",
  );

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier, durationMinutes: 30 },
  ]);
  await seedRunningWalk(page, petId, running);

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");

  const sampling = tickFrames(page, 3_000);
  await page.getByTestId("home-goal-control").click();
  const { bar, frames } = await sampling;

  // It was drawn for the length of the close, not for a frame of it.
  expect(frames.length).toBeGreaterThan(10);

  // **On the edge, every frame.** A tick a pixel off the boundary is a tick
  // marking something else.
  const adrift = frames.filter((f) => Math.abs(f.tick - f.edge) > 1);
  expect(adrift.map((f) => [f.tick, f.edge])).toEqual([]);

  // **And it travelled.** Wiring its position to a constant would satisfy
  // everything above.
  const places = frames.map((f) => f.tick);
  expectMinutes(Math.min(...places) / bar, 30, 31, 120);
  expectMinutes(Math.max(...places) / bar, 61, 62, 120);

  // It goes with the overlay, leaving a bar with nothing left to separate.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);
});

test("shows the control working while the start is being written", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeVisible();
  await expect(page.getByTestId("home-goal-spinner")).toHaveCount(0);

  // **Park the insert, so the busy state is a state and not a flicker.** Only
  // the POST waits; the reload that follows it is a GET and goes through.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/pet_events*", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });

  await page.getByTestId("home-goal-control").click();

  // The control stays where it was, says it is working, and cannot be pressed
  // again: a control that is present but inert is how a walk gets started
  // twice. The label is the same word throughout.
  const control = page.getByTestId("home-goal-control");
  await expect(page.getByTestId("home-goal-spinner")).toBeVisible();
  await expect(control).toBeDisabled();
  await expect(control).toContainText("Paseo");
  await expect(control).toHaveAttribute("aria-label", "Empezar paseo");
  // Nothing is running until the write lands.
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);

  release();
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("home-goal-spinner")).toHaveCount(0);
  await expect(control).toBeEnabled();
  await expect(control).toHaveAttribute("aria-label", "Terminar paseo");
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await page.unroute("**/rest/v1/pet_events*");
});

/**
 * **A shake is asserted by catching it in flight, and that is the one place
 * this file looks mid-animation on purpose.** The close is only ever checked
 * settled, because it cannot be parked inside; the shake can be *caught*
 * rather than parked, by polling the wrapper's computed transform on every
 * frame from before the press. A nonzero horizontal translation is the shake,
 * and zero is the control back at rest, which is what lets two failures in a
 * row be told apart from one.
 */
function shakeTranslation(page: Page, moving: boolean) {
  return page.waitForFunction(
    (wantMoving) => {
      const el = document.querySelector('[data-testid="home-goal-shake"]');
      if (!el) return false;
      const t = getComputedStyle(el).transform;
      const x = t === "none" ? 0 : new DOMMatrix(t).m41;
      return wantMoving ? Math.abs(x) > 0.01 : x === 0;
    },
    moving,
    { polling: "raf", timeout: 5_000 },
  );
}

test("shakes the control and keeps it pressable when a stop cannot be saved", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();

  // The close fails at the transport, which is the one failure a tutor
  // actually meets: a stop pressed where there is no signal. **Both verbs,
  // because a stop inside the first minute is a delete, not an update** —
  // `walkOutcome` discards it as a mis-tap and `deleteEvent` is a DELETE, so
  // routing only the PATCH would let this stop succeed and leave the test
  // waiting for an error that never comes.
  await page.route("**/rest/v1/pet_events*", (route) =>
    ["PATCH", "DELETE"].includes(route.request().method())
      ? route.abort()
      : route.continue(),
  );
  const first = shakeTranslation(page, true);
  await page.getByTestId("home-goal-control").click();
  await first;

  await expect(page.getByTestId("toast-error")).toBeVisible();
  // The walk is still running and the control is still a stop, because
  // nothing was saved — and no close animation ran.
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);
  // The spinner is the real signal that the control came back: a web
  // Pressable renders as a div, where `toBeEnabled` passes regardless.
  await expect(page.getByTestId("home-goal-spinner")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-control")).toHaveAttribute(
    "aria-label",
    "Terminar paseo",
  );

  // Settled, and then a second failure is a second shake: a counter, not a
  // flag, so the second write is a change.
  await shakeTranslation(page, false);
  const second = shakeTranslation(page, true);
  await page.getByTestId("home-goal-control").click();
  await second;
  await page.unroute("**/rest/v1/pet_events*");
});

test("shakes the control when a start cannot be saved", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeVisible();

  await page.route("**/rest/v1/pet_events*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  const shook = shakeTranslation(page, true);
  await page.getByTestId("home-goal-control").click();
  await shook;

  await expect(page.getByTestId("toast-error")).toBeVisible();
  // Nothing started: still an offer to start, and no walk in the measure.
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-spinner")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-control")).toHaveAttribute(
    "aria-label",
    "Empezar paseo",
  );
  await page.unroute("**/rest/v1/pet_events*");
});

/**
 * **A failed action is not a failed navigation.** Found on a phone in
 * airplane mode: the toast and the shake were right, and about seven seconds
 * later the whole diary was replaced by the connection error, because the
 * failure bumps `attempt` and the refetch includes the pet read, which fails
 * offline too.
 *
 * **This cuts every Supabase route, not the write.** The specs around it abort
 * one verb on `pet_events`, so the pet read always survived and the screen
 * could never fall over — which is exactly why none of them saw this.
 */
test("keeps the diary on screen when a walk cannot be saved offline", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  await seedE2EEvents(petId, [
    { kind: "meal", occurredAt: earlier!, what: "Pienso" },
  ]);

  await seedSession(page);
  await page.goto("/");
  const entries = page.locator('[data-testid^="home-entry-"]');
  await expect(entries).toHaveCount(1);
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  // Every route, so the refetch the failure triggers cannot read the pet.
  const supabase = /\/(rest|auth|storage)\/v1\//;
  await page.route(supabase, (route) => route.abort());
  // **The read is retried, which is where the seven seconds come from.**
  // postgrest-js retries a failed GET three times, after 1, 2 and 4 seconds,
  // so the pet read reports its failure to the screen only once the fourth
  // attempt has failed. Waiting for the first one would end the test before
  // the old defect had happened.
  let petReads = 0;
  const petReadGaveUp = new Promise<void>((resolve) => {
    page.on("requestfailed", (request) => {
      if (/\/rest\/v1\/pets\b/.test(request.url()) && ++petReads === 4) {
        resolve();
      }
    });
  });

  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("toast-error")).toBeVisible();

  // The pet read was attempted again and gave up — the moment the old screen
  // fell over — and a beat later is when its state would have committed.
  await petReadGaveUp;
  await page.waitForTimeout(750);

  await expect(page.getByTestId("home-retry")).toHaveCount(0);
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(entries).toHaveCount(1);
  await expect(page.getByTestId("home-goal-control")).toHaveAttribute(
    "aria-label",
    "Empezar paseo",
  );
  await page.unroute(supabase);
});

/**
 * **The other half of the rule: a failed *navigation* must still say so.**
 * The gate above keeps the diary when an action fails, and it must not turn
 * into silence for the arrows. Pressing ‹ offline asks for a new day, the pet
 * read fails, and with a pet already loaded there is no error screen to show —
 * so the failure belongs to the log, which is the part that could not be
 * loaded. Without that the tutor sat on the skeleton with no message and no
 * Reintentar, and it did not recover when the connection came back.
 */
test("says the day could not be loaded when ‹ is pressed offline, and recovers", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  const supabase = /\/(rest|auth|storage)\/v1\//;
  await page.route(supabase, (route) => route.abort());
  // Four attempts, as above: the failure reaches the screen after the last.
  let petReads = 0;
  const petReadGaveUp = new Promise<void>((resolve) => {
    page.on("requestfailed", (request) => {
      if (/\/rest\/v1\/pets\b/.test(request.url()) && ++petReads === 4) {
        resolve();
      }
    });
  });

  await page.getByTestId("home-prev-day").click();
  await petReadGaveUp;

  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-log-retry")).toBeVisible();
  // **And the measure withholds the number rather than inventing one.** With
  // no close to lean on there is no total anybody knows, so the one line of
  // the block that states minutes says it could not read them.
  await expect(page.getByTestId("home-goal-measure")).toHaveText(
    "Sin datos del día",
  );
  // The shell is fine: the header and the actions are still there.
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(page.getByTestId("home-retry")).toHaveCount(0);

  // And it comes back when the connection does.
  await page.unroute(supabase);
  await page.getByTestId("home-log-retry").click();
  await expect(page.getByTestId("home-log-error")).toHaveCount(0);
  await expect(page.getByTestId("home-title")).toBeVisible();
});

/**
 * Resolves when `count` requests matching `url` have failed from now on.
 *
 * postgrest-js retries a failed GET three times, so a read reports its failure
 * to the screen only on the fourth. Register it before the press that causes
 * the read.
 */
function failedReads(page: Page, url: RegExp, count: number) {
  let seen = 0;
  return new Promise<void>((resolve) => {
    page.on("requestfailed", (request) => {
      if (url.test(request.url()) && ++seen === count) resolve();
    });
  });
}

/**
 * **A retry that fails again is still a failure, never an empty day.** The
 * empty state says "Ese día no se apuntó nada", which is a claim about the
 * dog: nobody walked him. A network read that failed is not evidence of that.
 * Pressing Reintentar offline used to land on exactly that sentence, because
 * the failed day was remembered as one the log had something to say about, and
 * the second failure was then skipped as if it were a failed action.
 */
test("keeps saying the day could not be loaded when Reintentar fails too", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  const supabase = /\/(rest|auth|storage)\/v1\//;
  await page.route(supabase, (route) => route.abort());
  const pets = /\/rest\/v1\/pets\b/;
  const first = failedReads(page, pets, 4);
  await page.getByTestId("home-prev-day").click();
  await first;
  await expect(page.getByTestId("home-log-retry")).toBeVisible();

  const second = failedReads(page, pets, 4);
  await page.getByTestId("home-log-retry").click();
  await second;
  await page.waitForTimeout(750);

  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-empty")).toHaveCount(0);
  await page.unroute(supabase);
});

test("keeps saying the day could not be loaded when only the log failed and Reintentar fails too", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  // First only the log: the pet reads, the day's rows do not.
  const events = /\/rest\/v1\/pet_events\b/;
  await page.route(events, (route) => route.abort());
  const first = failedReads(page, events, 4);
  await page.getByTestId("home-prev-day").click();
  await first;
  await expect(page.getByTestId("home-log-retry")).toBeVisible();

  // Then the pet too, as when the signal drops entirely before the retry.
  const supabase = /\/(rest|auth|storage)\/v1\//;
  await page.route(supabase, (route) => route.abort());
  const second = failedReads(page, /\/rest\/v1\/pets\b/, 4);
  await page.getByTestId("home-log-retry").click();
  await second;
  await page.waitForTimeout(750);

  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-empty")).toHaveCount(0);
  await page.unroute(supabase);
  await page.unroute(events);
});

/**
 * **Going back to a day that loaded is still a navigation.** A loaded, ‹ to a
 * day that fails, › back to the day that loaded — all offline. The log then
 * holds the failed day's error, not the loaded day's rows, so the first day is
 * not on screen either, and the screen has to say so. It sat on its skeleton,
 * with no message and no Reintentar, because the guard remembered the first day
 * as loaded and took the failure for a failed action.
 */
test("says the day could not be loaded going back offline too", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  const supabase = /\/(rest|auth|storage)\/v1\//;
  const pets = /\/rest\/v1\/pets\b/;
  await page.route(supabase, (route) => route.abort());
  const out = failedReads(page, pets, 4);
  await page.getByTestId("home-prev-day").click();
  await out;
  await expect(page.getByTestId("home-log-error")).toBeVisible();

  const back = failedReads(page, pets, 4);
  await page.getByTestId("home-next-day").click();
  await back;
  await page.waitForTimeout(750);

  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-log-retry")).toBeVisible();
  await expect(page.getByTestId("home-log-skeleton")).toHaveCount(0);
  await page.unroute(supabase);
});

test("says the day could not be loaded going back offline, when the first failure was only the log", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  const events = /\/rest\/v1\/pet_events\b/;
  await page.route(events, (route) => route.abort());
  const out = failedReads(page, events, 4);
  await page.getByTestId("home-prev-day").click();
  await out;
  await expect(page.getByTestId("home-log-retry")).toBeVisible();

  const supabase = /\/(rest|auth|storage)\/v1\//;
  await page.route(supabase, (route) => route.abort());
  const back = failedReads(page, /\/rest\/v1\/pets\b/, 4);
  await page.getByTestId("home-next-day").click();
  await back;
  await page.waitForTimeout(750);

  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-log-skeleton")).toHaveCount(0);
  await page.unroute(supabase);
  await page.unroute(events);
});

/**
 * **An action that succeeded and a reload that could not confirm it is not a
 * failed action.** The diary is kept when the *action* fails; here the write
 * landed — the walk exists on the server — and the screen is waiting on a read
 * that will not answer. Keeping the old rows left a diary with no walk in it
 * and the control disabled over a spinner, with no message and no Reintentar:
 * the tutor could not stop a walk the screen did not know it had started.
 * Only the pet read is cut, so the start itself succeeds.
 */
test("offers Reintentar when a walk was started and the reload cannot confirm it", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  const pets = /\/rest\/v1\/pets\b/;
  await page.route(pets, (route) => route.abort());
  const gaveUp = failedReads(page, pets, 4);
  await page.getByTestId("home-goal-control").click();
  await gaveUp;
  await page.waitForTimeout(750);

  // Said, with a way out — not a spinner that never ends.
  await expect(page.getByTestId("home-log-error")).toBeVisible();
  await expect(page.getByTestId("home-log-retry")).toBeVisible();
  await expect(page.getByTestId("home-title")).toBeVisible();
  // A start adds no minutes, so there is nothing held and nothing known: the
  // measure says so instead of reporting a day with no walks in it.
  await expect(page.getByTestId("home-goal-measure")).toHaveText(
    "Sin datos del día",
  );

  // And the way out works: the walk the server holds comes back, running.
  await page.unroute(pets);
  await page.getByTestId("home-log-retry").click();
  await expect(page.getByTestId("home-log-error")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-spinner")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();
  await expect(page.getByTestId("home-goal-control")).toHaveAttribute(
    "aria-label",
    "Terminar paseo",
  );
  await expect(page.locator('[data-testid^="home-entry-"]')).toHaveCount(1);
});

/**
 * **The inverse risk: a day that really is empty stays empty.** Every guard
 * above exists to stop a failure being shown as "nothing happened", and the
 * guard must not overcorrect into never saying "nothing happened". A day
 * that loaded with no rows, then a failed action reloading it offline, keeps
 * its empty state: the rows it holds are real.
 */
test("keeps a genuinely empty day empty when an action fails offline", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-empty")).toBeVisible();
  await expect(page.getByTestId("home-goal-control")).toBeEnabled();

  const supabase = /\/(rest|auth|storage)\/v1\//;
  await page.route(supabase, (route) => route.abort());
  const gaveUp = failedReads(page, /\/rest\/v1\/pets\b/, 4);
  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("toast-error")).toBeVisible();
  await gaveUp;
  await page.waitForTimeout(750);

  await expect(page.getByTestId("home-empty")).toBeVisible();
  await expect(page.getByTestId("home-log-error")).toHaveCount(0);
  await page.unroute(supabase);
});

/**
 * **A pet that never arrived still takes the whole screen.** With no pet there
 * is no day to show, which is what the gate keeps. `app/index.tsx` reads the
 * pet once before the tabs mount, so the first read is let through and every
 * one after it — the home screen's own, with its retries — is cut.
 */
test("shows the connection error when the pet never loads, and recovers", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  let petReads = 0;
  let failedReads = 0;
  const supabase = /\/rest\/v1\/pets\b/;
  await page.route(supabase, (route) =>
    ++petReads === 1 ? route.continue() : route.abort(),
  );
  const gaveUp = new Promise<void>((resolve) => {
    page.on("requestfailed", (request) => {
      if (supabase.test(request.url()) && ++failedReads === 4) resolve();
    });
  });

  await page.goto("/");
  await gaveUp;
  await expect(page.getByTestId("home-retry")).toBeVisible();
  await expect(page.getByTestId("home-title")).toHaveCount(0);

  await page.unroute(supabase);
  await page.getByTestId("home-retry").click();
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(page.getByTestId("home-retry")).toHaveCount(0);
});

test("mounts no shake for a tutor who asked for no animation", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-control")).toBeVisible();

  await page.route("**/rest/v1/pet_events*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByTestId("home-goal-control").click();

  // The failure is still said — in the toast, which is not motion — and the
  // wrapper that would carry the shake is absent rather than still. The
  // normal-motion test above is what proves this testID exists to be absent.
  await expect(page.getByTestId("toast-error")).toBeVisible();
  await expect(page.getByTestId("home-goal-spinner")).toHaveCount(0);
  await expect(page.getByTestId("home-goal-shake")).toHaveCount(0);
  await page.unroute("**/rest/v1/pet_events*");
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
  // A walk that is already an hour old shows the dot too, and a bar segment
  // wide enough to see: the two say different things, how long and how much.
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();

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

test("keeps a walk that was written on a moment ago, even stopped before the day reloads", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await seedSession(page);
  await page.goto("/");

  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");

  // **Hold the day's reload back, so the window is wide enough to stop in.**
  // Normally the log lands in well under a second and the row `stop` reads
  // already has the note; here the read is parked for a few seconds, which is
  // the same state a slow connection produces. Writes go through untouched —
  // only the day's list is delayed.
  await page.route("**/rest/v1/pet_events?*", async (route) => {
    if (route.request().method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    await route.continue();
  });

  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);

  // Stopped inside the first minute, before the row on screen can know about
  // the note. An untouched walk this young is deleted as a mis-tap; this one
  // was written on, so it is closed at the one minute the column accepts.
  await page.getByTestId("home-goal-control").click();
  await page.unroute("**/rest/v1/pet_events?*");

  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "De paseo",
  );
  const entries = page.locator('[data-testid^="home-entry-"]');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("1 min");
  await expect(entries.first()).toContainText("Ha bebido en la fuente");
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
  await expect(page.getByTestId("home-goal")).toContainText("30 min de 2h");
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
  await expect(page.getByTestId("home-goal")).toContainText("45 min de 2h");
});

test("re-reads the duration when a time is set on the clock face", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **The dial is a second way into the same field, and it used to skip the
  // reading.** The clock wrote the time straight in, so only the keyboard
  // recomputed the duration: this walk moved to 11:00 went on showing "45
  // min" while `save` stored 60. A read-only field makes that a wrong number
  // the tutor can see and cannot correct.
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
  await expect(page.getByTestId("home-title")).toContainText("Ayer");
  await page.locator('[data-testid^="home-entry-"]').first().click();
  await expect(page.getByTestId("entry-duration")).toHaveValue("45 min");

  await page.getByTestId("entry-to-picker").click();
  await page.getByTestId("timepicker-hour-11").click();
  await page.getByTestId("timepicker-minute-00").click();
  await page.getByTestId("timepicker-confirm").click();
  await expect(page.getByTestId("entry-to")).toHaveValue("11:00");

  // What the field says and what the row gets have to be the same hour's
  // worth, which is the whole of the finding.
  await expect(page.getByTestId("entry-duration")).toHaveValue("1h");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await expect(page.getByTestId("home-log")).toContainText("10:00");
  await expect(page.getByTestId("home-log")).toContainText("1h");
  await expect(page.getByTestId("home-goal")).toContainText("1h de 2h");

  // And DESDE's own dial reads the same way round.
  await page.locator('[data-testid^="home-entry-"]').first().click();
  await page.getByTestId("entry-from-picker").click();
  await page.getByTestId("timepicker-hour-10").click();
  await page.getByTestId("timepicker-minute-30").click();
  await page.getByTestId("timepicker-confirm").click();
  await expect(page.getByTestId("entry-from")).toHaveValue("10:30");
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
});

test("keeps a crossed walk's length while its real end is tried in HASTA", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  // **A HASTA before its DESDE is mid-typing, not an error.** This walk ended
  // at 00:10 the next day, which no HASTA on this form can say — so typing
  // that real end is the obvious thing to try, and it used to empty the
  // duration on the way. Clearing HASTA again then left the field blank, and
  // `save` wrote `duration_minutes = null`: half an hour of a real walk gone,
  // with Guardar live throughout.
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
  await page.locator('[data-testid^="home-entry-"]').first().click();
  await expect(page.getByTestId("entry-from")).toHaveValue("23:40");
  await expect(page.getByTestId("entry-to")).toHaveValue("");
  await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");

  const to = page.getByTestId("entry-to");
  await to.click();
  // Key by key, the way the phone delivers it: every intermediate value is a
  // pair that does not read as a length either.
  for (const key of ["0", "0", ":", "1", "0"]) {
    await page.keyboard.press(key);
    await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  }
  await expect(to).toHaveValue("00:10");

  // Backing it out again leaves the row exactly as it was stored.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("entry-duration")).toHaveValue("30 min");
  }
  await expect(to).toHaveValue("");

  await page.getByTestId("entry-note").fill("Volvimos pasada la medianoche");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
  await expect(page.getByTestId("home-log")).toContainText("23:40");
  await expect(page.getByTestId("home-log")).toContainText("30 min");
  await expect(page.getByTestId("home-goal")).toContainText("30 min de 2h");
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
  // The dot says the walk is live; the tick marks a junction on a bar, and
  // there is no bar to have one.
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-tick")).toHaveCount(0);

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

/**
 * **Five characters is not five widths.** Outfit's digits are proportional, so
 * the time column sized to its content was wider for `09:40` — no narrow `1`
 * in it — than for `10:20` or `13:51`, and pushed its title right. Measured on
 * the device: titles at x=288, 280 and 280. The hours are yesterday's, so the
 * spec holds at any hour it runs.
 */
test("starts every entry's title at the same place whatever the hour", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 60 });
  const at = (hours: number, minutes: number) => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: at(9, 40), durationMinutes: 20 },
    { kind: "walk", occurredAt: at(10, 20), durationMinutes: 20 },
    { kind: "walk", occurredAt: at(13, 51), durationMinutes: 20 },
  ]);

  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-prev-day").click();

  const entries = page.locator('[data-testid^="home-entry-"]');
  await expect(entries).toHaveCount(3);
  // The read side is 24-hour by default, which is what makes the three times
  // the ones named above rather than whatever the locale would print.
  await expect(entries.nth(0)).toContainText("09:40");
  await expect(entries.nth(1)).toContainText("10:20");
  await expect(entries.nth(2)).toContainText("13:51");

  const xs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const box = await entries
      .nth(i)
      .getByText("Paseo", { exact: true })
      .boundingBox();
    expect(box, `entry ${i}'s title should be drawn`).not.toBeNull();
    xs.push(box!.x);
  }
  expect(
    Math.max(...xs) - Math.min(...xs),
    `titles start at ${xs.join(", ")}`,
  ).toBeLessThan(0.5);
});
