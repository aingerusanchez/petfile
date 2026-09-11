import { expect, test, type Page } from "@playwright/test";
import { resetE2EPets, seedE2EPet, seedSession } from "./auth";

/**
 * The health tab: the weight line and the treatment schedule.
 *
 * **Every date here is derived from a "now" the test owns.** `e2e/home.spec.ts`
 * hard-codes working-day times and fails before nine in the morning for
 * reasons that have nothing to do with the code; this file was written after
 * that was understood, so a run at one in the morning says the same thing as a
 * run at noon.
 */

const pad = (value: number) => String(value).padStart(2, "0");
const typed = (day: Date) =>
  `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${day.getFullYear()}`;

function addDays(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}

async function openHealth(page: Page) {
  await page.goto("/health");
  await expect(page.getByTestId("health-title")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetE2EPets();
  await seedE2EPet();
  await seedSession(page);
});

test.afterEach(async () => {
  await resetE2EPets();
});

test("opens on what is pending, and says so when nothing is", async ({
  page,
}) => {
  await openHealth(page);

  // The question the tab is opened with, answered first — and an empty answer
  // is good news that has to be said rather than a gap on the screen.
  await expect(page.getByTestId("health-due")).toContainText("Nada pendiente");
  await expect(page.getByTestId("health-weight")).toContainText(
    "Todavía no le habéis pesado",
  );
});

test("records a weight and reads it back in kilograms", async ({ page }) => {
  await openHealth(page);

  await page.getByTestId("health-weight-add").click();
  // The comma is what the Spanish keyboard's decimal key gives.
  await page.getByTestId("weight-value").fill("12,4");
  await page.getByTestId("weight-save").click();

  await expect(page.getByTestId("health-weight")).toContainText("12,4 kg");

  // **The button never claims to be about today**, because the sheet is where
  // the day is chosen and the first thing anybody does with an empty line is
  // type in months of past weighings. It does open on the day's own row when
  // there is one, so an upsert can never replace a weight it never showed.
  await expect(page.getByTestId("health-weight-add")).toContainText(
    "Anotar peso",
  );
  await page.getByTestId("health-weight-add").click();
  await expect(page.getByTestId("weight-value")).toHaveValue("12,4");
});

test("saving twice on one day corrects the weight instead of adding another", async ({
  page,
}) => {
  await openHealth(page);

  await page.getByTestId("health-weight-add").click();
  await page.getByTestId("weight-value").fill("12,4");
  await page.getByTestId("weight-save").click();
  await expect(page.getByTestId("health-weight")).toContainText("12,4 kg");

  // Reweighing because the first number looked wrong is a correction. The
  // unique constraint would otherwise reject it with a message about a
  // constraint, and the tutor has not done anything wrong.
  await page.getByTestId("health-weight-add").click();
  await page.getByTestId("weight-value").fill("12,6");
  await page.getByTestId("weight-save").click();

  await expect(page.getByTestId("health-weight")).toContainText("12,6 kg");
  await expect(page.getByTestId("health-weight")).not.toContainText("12,4 kg");
  // One weight means nothing to compare against, so no change is claimed.
  await expect(page.getByTestId("health-weight")).not.toContainText("desde el");
});

test("will not save until there is a weight, and not again until it changes", async ({
  page,
}) => {
  await openHealth(page);

  await page.getByTestId("health-weight-add").click();
  // Nothing typed is nothing to save: the same rule the profile's blocks use.
  await expect(page.getByTestId("weight-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("weight-value").fill("12,4");
  await expect(page.getByTestId("weight-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("weight-save").click();

  // Reopened on the stored weight, Guardar is inert again until something
  // differs from what is already there.
  await page.getByTestId("health-weight-latest").click();
  await expect(page.getByTestId("weight-value")).toHaveValue("12,4");
  await expect(page.getByTestId("weight-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("proposes the next date from the kind, and keeps what is confirmed", async ({
  page,
}) => {
  const today = new Date();
  await openHealth(page);

  await page.getByTestId("health-treatment-add").click();

  // A vaccine's proposal is a year out; switching to the antiparasitic moves
  // it to a month, because the proposal follows the kind until somebody
  // overrules it.
  await expect(page.getByTestId("treatment-next")).toContainText(
    typed(addDays(today, 365)),
  );
  await page.getByTestId("treatment-kind-antiparasitic").click();
  await expect(page.getByTestId("treatment-next")).toContainText(
    typed(addDays(today, 30)),
  );
  await page.getByTestId("treatment-kind-deworming").click();
  await expect(page.getByTestId("treatment-next")).toContainText(
    typed(addDays(today, 90)),
  );

  // And it says why that date is there, in the kind's own rhythm — derived
  // from the same constant that filled the field, so the two cannot drift.
  await expect(page.getByTestId("treatment-cadence")).toContainText(
    "cada 3 meses",
  );
  await page.getByTestId("treatment-kind-vaccine").click();
  await expect(page.getByTestId("treatment-cadence")).toContainText("cada año");
  await page.getByTestId("treatment-kind-deworming").click();

  await page.getByTestId("treatment-name").fill("Milbemax");
  await page.getByTestId("treatment-save").click();

  // And it lands in the section whose whole job is saying what is coming.
  await expect(page.getByTestId("health-due")).toContainText(
    "Desparasitación (Int.)",
  );
  await expect(page.getByTestId("health-due")).not.toContainText(
    "Nada pendiente",
  );
  await expect(page.getByTestId("health-treatments")).toContainText("Milbemax");
});

test("picks a vaccine from a list, and keeps a free field for the rest", async ({
  page,
}) => {
  await openHealth(page);
  await page.getByTestId("health-treatment-add").click();

  // A vaccine's name *is* its schedule key, so it comes off a list: free text
  // would make "Rabia" and "rabia" two pautas, each holding half the history.
  await expect(page.getByTestId("treatment-name")).toBeHidden();
  await expect(page.getByTestId("treatment-vaccine-note")).toContainText(
    "hexa",
  );

  await page.getByTestId("treatment-vaccine-rabia").click();
  await expect(page.getByTestId("treatment-vaccine-note")).toBeHidden();
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText("Rabia");

  // The two dewormings keep the field: there the name is whichever product the
  // vet handed over, and the kind is the schedule.
  await page.getByTestId("health-treatment-add").click();
  await page.getByTestId("treatment-kind-deworming").click();
  await expect(page.getByTestId("treatment-name")).toBeVisible();
  await page.getByTestId("treatment-name").fill("Milbemax");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText("Milbemax");
});

test("reveals the field for a vaccine the list has never heard of", async ({
  page,
}) => {
  await openHealth(page);
  await page.getByTestId("health-treatment-add").click();

  await page.getByTestId("treatment-vaccine-otra").click();
  await expect(page.getByTestId("treatment-name")).toBeVisible();
  await page.getByTestId("treatment-name").fill("Pentavalente");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText(
    "Pentavalente",
  );

  // And it reopens on "Otra" with the name intact: a closed list must never
  // rewrite what somebody already wrote down.
  await page
    .getByTestId(/^health-treatment-[0-9a-f]/)
    .first()
    .click();
  await expect(page.getByTestId("treatment-name")).toHaveValue("Pentavalente");
});

test("stops proposing once the tutor has written the date themselves", async ({
  page,
}) => {
  const today = new Date();
  await openHealth(page);

  await page.getByTestId("health-treatment-add").click();

  // Opening the picker and confirming is the tutor answering the question,
  // even when the answer is the one already offered. From then on the date is
  // theirs: changing the kind must not overwrite what the vet said.
  await page.getByTestId("treatment-next").click();
  await page.getByTestId("datepicker-confirm").click();
  await page.getByTestId("treatment-kind-antiparasitic").click();
  await expect(page.getByTestId("treatment-next")).toContainText(
    typed(addDays(today, 365)),
  );
});

test("a treatment with no next date is not pending, because it is done", async ({
  page,
}) => {
  await openHealth(page);

  await page.getByTestId("health-treatment-add").click();
  // A deworming, because that is the kind that still has a free name field.
  await page.getByTestId("treatment-kind-deworming").click();
  await page.getByTestId("treatment-name").fill("Una sola vez");
  // "Sin fecha" is an answer, not an empty field: a one-off has nothing
  // scheduled after it, and the section above must not invent a reminder.
  await page.getByTestId("treatment-next").click();
  await page.getByTestId("datepicker-clear").click();
  await page.getByTestId("treatment-save").click();

  await expect(page.getByTestId("health-treatments")).toContainText(
    "Una sola vez",
  );
  await expect(page.getByTestId("health-due")).toContainText("Nada pendiente");
});

test("corrects a treatment, and can delete one", async ({ page }) => {
  await openHealth(page);

  await page.getByTestId("health-treatment-add").click();
  await page.getByTestId("treatment-kind-deworming").click();
  await page.getByTestId("treatment-name").fill("Milbemx");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText("Milbemx");

  const row = page.getByTestId(/^health-treatment-[0-9a-f]/).first();
  await row.click();
  await page.getByTestId("treatment-name").fill("Milbemax");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText("Milbemax");
  await expect(page.getByTestId("health-treatments")).not.toContainText(
    "Milbemx",
  );

  await page
    .getByTestId(/^health-treatment-[0-9a-f]/)
    .first()
    .click();
  await page.getByTestId("treatment-delete").click();
  await expect(page.getByTestId("health-treatments")).toContainText(
    "Aquí van las vacunas",
  );
});

test("keeps every control on the 48dp floor", async ({ page }) => {
  await openHealth(page);
  await page.getByTestId("health-treatment-add").click();

  for (const id of [
    "treatment-kind-vaccine",
    "treatment-kind-deworming",
    "treatment-kind-antiparasitic",
    "treatment-vaccine-rabia",
    "treatment-vaccine-otra",
    "treatment-save",
  ]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(
      box?.height,
      `${id} is under the touch floor`,
    ).toBeGreaterThanOrEqual(48);
  }
});
