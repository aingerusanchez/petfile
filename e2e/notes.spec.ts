import { expect, test, type Page } from "@playwright/test";
import {
  resetE2EPets,
  seedE2EPet,
  seedE2ETreatments,
  seedSession,
} from "./auth";

/**
 * How a numbered list reads back in a note.
 *
 * **No clock times at all.** Nothing here depends on the hour: the entry
 * sheet's own default time is "now", and every other value is text.
 */

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
