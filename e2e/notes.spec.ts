import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  resetE2EPets,
  seedE2EPet,
  seedE2ETreatments,
  seedSession,
} from "./auth";

/**
 * The note field: how a numbered list reads back, and the counter under it.
 *
 * **No clock times at all.** Nothing here depends on the hour: the entry
 * sheet's own default time is "now", and every other value is text.
 */

const LIMIT = 500;

/** `length` characters of words, ending on a letter so a save's trim is a no-op. */
function words(length: number): string {
  return "palabra "
    .repeat(Math.ceil(length / 8))
    .slice(0, length)
    .replace(/\s+$/, "x");
}

/**
 * Put the caret somewhere definite.
 *
 * **Not `press("End")`**, which moves to the end of the *visual line* in a
 * wrapped textarea, and not a keyboard shortcut, which is a different chord on
 * every OS — a first version of this spec pressed one and found its caret still
 * where a click had left it, so its "typing does nothing" assertions held for
 * the wrong reason.
 */
async function caretAt(field: Locator, where: "start" | "end") {
  await field.focus();
  await field.evaluate((element, at) => {
    const input = element as HTMLTextAreaElement;
    const position = at === "start" ? 0 : input.value.length;
    input.setSelectionRange(position, position);
  }, where);
}

async function openEntrySheet(page: Page) {
  await page.goto("/");
  await page.getByTestId("home-add").click();
  await page.getByTestId("home-add-incident").click();
  await expect(page.getByTestId("entry-note")).toBeVisible();
}

let petId: string;

test.beforeEach(async ({ page }) => {
  await resetE2EPets();
  petId = await seedE2EPet();
  await seedSession(page);
});

test.afterEach(async () => {
  await resetE2EPets();
});

test("a numbered list reads in order however it was typed", async ({
  page,
}) => {
  await seedE2ETreatments(petId, [
    {
      kind: "deworming",
      name: "Todo uno",
      administeredOn: "2026-03-02",
      note: "1. Primero\n1. Segundo\n1. Tercero",
    },
    {
      kind: "deworming",
      name: "Con huecos",
      administeredOn: "2026-03-01",
      // Typed 1, 3, 4 — what is left after an item is deleted in an edit.
      note: "1. Uno\n3. Tres\n4. Cuatro",
    },
    {
      kind: "deworming",
      name: "Con viñetas",
      administeredOn: "2026-02-01",
      note: "- Una cosa\n- Y otra",
    },
  ]);
  await page.goto("/treatments");

  const rows = page.getByTestId(/^treatments-row-[0-9a-f]/);
  await expect(rows).toHaveCount(3);

  // The marker is drawn, not read: three items typed "1." come out 1, 2, 3.
  const allOne = rows.filter({ hasText: "Todo uno" });
  expect(await allOne.innerText()).toMatch(
    /1\.\s*Primero\s*2\.\s*Segundo\s*3\.\s*Tercero/,
  );
  expect(await allOne.innerText()).not.toMatch(/1\.\s*Segundo/);

  const gaps = rows.filter({ hasText: "Con huecos" });
  expect(await gaps.innerText()).toMatch(
    /1\.\s*Uno\s*2\.\s*Tres\s*3\.\s*Cuatro/,
  );
  // The typed 3 and 4 are gone from the screen.
  expect(await gaps.innerText()).not.toMatch(/4\.\s*Cuatro/);

  // A bulleted list is untouched.
  const bullets = rows.filter({ hasText: "Con viñetas" });
  expect(await bullets.innerText()).toMatch(/·\s*Una cosa\s*·\s*Y otra/);
  expect(await bullets.innerText()).not.toMatch(/1\./);
});

test("the help sheet shows the numbered list it explains", async ({ page }) => {
  await openEntrySheet(page);
  await page.getByTestId("entry-note-help").click();
  const help = page.getByTestId("markdown-help-sheet");
  await expect(help).toContainText("1. Primero esto");
  expect(await help.innerText()).toMatch(
    /1\.\s*Primero esto\s*2\.\s*Luego esto/,
  );
});

test("keeps the counter out of the way until a note is nearly full", async ({
  page,
}) => {
  await openEntrySheet(page);
  const note = page.getByTestId("entry-note");
  const count = page.getByTestId("entry-note-count");

  // An ordinary note has no counter beneath it.
  await note.fill(words(72));
  await expect(count).toBeHidden();
  await note.fill(words(399));
  await expect(count).toBeHidden();

  // At 80% it appears, with the right numbers, and follows the text.
  await note.fill(words(400));
  await expect(count).toHaveText("400/500");
  await note.fill(words(412));
  await expect(count).toHaveText("412/500");

  // It goes back out of the way when the note is cut down again.
  await note.fill(words(40));
  await expect(count).toBeHidden();
});

test("stops at the limit and says so", async ({ page }) => {
  await openEntrySheet(page);
  const note = page.getByTestId("entry-note");
  const count = page.getByTestId("entry-note-count");

  // A paste of 600 characters is cut where the field fills, not refused whole.
  await note.fill(words(600));
  await expect(count).toHaveText("500/500");
  expect((await note.inputValue()).length).toBe(LIMIT);

  // Typing past it does nothing...
  await caretAt(note, "end");
  await page.keyboard.type("zzz");
  expect((await note.inputValue()).length).toBe(LIMIT);
  await expect(count).toHaveText("500/500");

  // ...and one character deleted is one character back. Deleting key by key,
  // as a phone's keyboard does, rather than through `fill`.
  await page.keyboard.press("Backspace");
  await expect(count).toHaveText("499/500");
  await page.keyboard.type("z");
  await expect(count).toHaveText("500/500");

  // The full note is what saves.
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-note")).toBeHidden();
});

test("every free-text note field carries the same counter", async ({
  page,
}) => {
  const long = words(450);

  // The day view's sheet (walk, meal, medication, incident share it).
  await openEntrySheet(page);
  await page.getByTestId("entry-note").fill(long);
  await expect(page.getByTestId("entry-note-count")).toHaveText("450/500");

  // The weight sheet.
  await page.goto("/health");
  await page.getByTestId("health-add").click();
  await page.getByTestId("health-add-weight").click();
  await page.getByTestId("weight-note").fill(long);
  await expect(page.getByTestId("weight-note-count")).toHaveText("450/500");

  // The treatment sheet.
  await page.goto("/health");
  await page.getByTestId("health-add").click();
  await page.getByTestId("health-add-treatment").click();
  await page.getByTestId("treatment-note").fill(long);
  await expect(page.getByTestId("treatment-note-count")).toHaveText("450/500");

  // The clinic's schedule: multi-line, free text, Markdown, same help.
  await page.goto("/health");
  await page.getByTestId("vet-primary-edit").click();
  await page.getByTestId("vet-primary-hours").fill(long);
  await expect(page.getByTestId("vet-primary-hours-count")).toHaveText(
    "450/500",
  );

  // The address is multi-line but is not a note, and has no limit.
  await page.getByTestId("vet-primary-address").fill(words(600));
  await expect(page.getByTestId("vet-primary-address-count")).toHaveCount(0);
  expect(
    (await page.getByTestId("vet-primary-address").inputValue()).length,
  ).toBe(600);
});

test.describe("a note written before the limit existed", () => {
  const old = words(650);

  async function openOldTreatment(page: Page) {
    await seedE2ETreatments(petId, [
      {
        kind: "deworming",
        name: "Panacur",
        administeredOn: "2026-03-02",
        note: old,
      },
    ]);
    await page.goto("/treatments");
    await page
      .getByTestId(/^treatments-row-[0-9a-f]/)
      .first()
      .click();
    await expect(page.getByTestId("treatment-sheet")).toBeVisible();
  }

  test("opens whole, says it is over, and will not grow", async ({ page }) => {
    await openOldTreatment(page);
    const note = page.getByTestId("treatment-note");

    // Not truncated on the way in.
    await expect(note).toHaveValue(old);
    await expect(page.getByTestId("treatment-note-count")).toHaveText(
      `${old.length}/500`,
    );

    // It cannot be added to — at the end or in the middle.
    await caretAt(note, "end");
    await page.keyboard.type("zzz");
    await expect(note).toHaveValue(old);
    await caretAt(note, "start");
    await page.keyboard.type("zzz");
    await expect(note).toHaveValue(old);
  });

  test("can be corrected and saved without losing a character it kept", async ({
    page,
  }) => {
    await openOldTreatment(page);
    const note = page.getByTestId("treatment-note");

    // Saved untouched apart from the name: the note goes back as it was.
    await page.getByTestId("treatment-name").fill("Panacur 500mg");
    await page.getByTestId("treatment-save").click();
    await expect(page.getByTestId("treatment-sheet")).toBeHidden();
    await page.reload();
    await page
      .getByTestId(/^treatments-row-[0-9a-f]/)
      .first()
      .click();
    await expect(note).toHaveValue(old);

    // Shortened by hand — deleting key by key, as a phone's keyboard does —
    // and the shorter note is the one that stays.
    await caretAt(note, "end");
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Backspace");
    await expect(note).toHaveValue(old.slice(0, -3));
    await page.getByTestId("treatment-save").click();
    await expect(page.getByTestId("treatment-sheet")).toBeHidden();
    await page.reload();
    await page
      .getByTestId(/^treatments-row-[0-9a-f]/)
      .first()
      .click();
    await expect(note).toHaveValue(old.slice(0, -3));
    await expect(page.getByTestId("treatment-note-count")).toHaveText(
      `${old.length - 3}/500`,
    );
  });
});
