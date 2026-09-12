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

/**
 * Adding lives behind the floating action now, so every add is two taps.
 */
async function addHealth(page: Page, what: "weight" | "treatment") {
  await page.getByTestId("health-add").click();
  await page.getByTestId(`health-add-${what}`).click();
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

  await addHealth(page, "weight");
  // The comma is what the Spanish keyboard's decimal key gives.
  await page.getByTestId("weight-value").fill("12,4");
  await page.getByTestId("weight-save").click();

  await expect(page.getByTestId("health-weight")).toContainText("12,4 kg");

  // **It opens on the day's own row when there is one**, so an upsert can
  // never replace a weight it never showed — and nothing on screen has to
  // explain which of the two is about to happen.
  await addHealth(page, "weight");
  await expect(page.getByTestId("weight-value")).toHaveValue("12,4");
});

test("saving twice on one day corrects the weight instead of adding another", async ({
  page,
}) => {
  await openHealth(page);

  await addHealth(page, "weight");
  await page.getByTestId("weight-value").fill("12,4");
  await page.getByTestId("weight-save").click();
  await expect(page.getByTestId("health-weight")).toContainText("12,4 kg");

  // Reweighing because the first number looked wrong is a correction. The
  // unique constraint would otherwise reject it with a message about a
  // constraint, and the tutor has not done anything wrong.
  await addHealth(page, "weight");
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

  await addHealth(page, "weight");
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
  await openHealth(page);

  await addHealth(page, "treatment");

  // **A sentence, not a second date field.** Two adjacent dates was one too
  // many and the one being typed was always the first, so the rhythm is said
  // in words and the field appears only for somebody who disagrees. It is
  // derived from the constant that fills the date, so the two cannot drift.
  await expect(page.getByTestId("treatment-next")).toBeHidden();
  await expect(page.getByTestId("treatment-cadence")).toContainText("cada año");
  await page.getByTestId("treatment-kind-deworming").click();
  await expect(page.getByTestId("treatment-cadence")).toContainText(
    "cada 3 meses",
  );
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
  await addHealth(page, "treatment");

  // A vaccine suggests from a list, because its name *is* the schedule key.
  await page.getByTestId("treatment-name").click();
  await page.getByTestId("treatment-vaccine-Rabia").click();
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText("Rabia");

  // The two dewormings keep the field: there the name is whichever product the
  // vet handed over, and the kind is the schedule.
  await addHealth(page, "treatment");
  await page.getByTestId("treatment-kind-deworming").click();
  await expect(page.getByTestId("treatment-name")).toBeVisible();
  await page.getByTestId("treatment-name").fill("Milbemax");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText("Milbemax");
});

test("takes a vaccine the list has never heard of, exactly as written", async ({
  page,
}) => {
  await openHealth(page);
  await addHealth(page, "treatment");

  // A combobox, not a picker: no list of vaccines is complete, and refusing
  // what is off it would be refusing the truth.
  await page.getByTestId("treatment-name").fill("Pentavalente");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("health-treatments")).toContainText(
    "Pentavalente",
  );

  // And it reopens with the name intact: suggesting is not rewriting.
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

  await addHealth(page, "treatment");

  // The vet said something else, so the field comes out — and confirming is
  // the tutor answering the question, even when the answer is the one already
  // offered. From then on the date is theirs: changing the kind must not
  // overwrite it.
  await page.getByTestId("treatment-next-change").click();
  await page.getByTestId("treatment-next-picker").click();
  await page.getByTestId("datepicker-confirm").click();
  await page.getByTestId("treatment-kind-antiparasitic").click();
  await expect(page.getByTestId("treatment-next")).toHaveValue(
    typed(addDays(today, 365)),
  );
});

test("a treatment with no next date is not pending, because it is done", async ({
  page,
}) => {
  await openHealth(page);

  await addHealth(page, "treatment");
  // A deworming, because that is the kind that still has a free name field.
  await page.getByTestId("treatment-kind-deworming").click();
  await page.getByTestId("treatment-name").fill("Una sola vez");
  // "Sin fecha" is an answer, not an empty field: a one-off has nothing
  // scheduled after it, and the section above must not invent a reminder.
  await page.getByTestId("treatment-next-change").click();
  await page.getByTestId("treatment-next-picker").click();
  await page.getByTestId("datepicker-clear").click();
  await page.getByTestId("treatment-save").click();

  await expect(page.getByTestId("health-treatments")).toContainText(
    "Una sola vez",
  );
  await expect(page.getByTestId("health-due")).toContainText("Nada pendiente");
});

test("corrects a treatment, and can delete one", async ({ page }) => {
  await openHealth(page);

  await addHealth(page, "treatment");
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
  await addHealth(page, "treatment");

  for (const id of [
    "treatment-kind-vaccine",
    "treatment-kind-deworming",
    "treatment-kind-antiparasitic",
    "treatment-name",
    "treatment-save",
  ]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(
      box?.height,
      `${id} is under the touch floor`,
    ).toBeGreaterThanOrEqual(48);
  }
});

test("keeps both clinics on the screen before anybody fills them", async ({
  page,
}) => {
  await openHealth(page);

  // **Not behind the floating action.** A vet is a property of the animal
  // rather than a record that accumulates, and the emergency one is read by
  // somebody who is frightened — a card that has to be discovered before it
  // can be filled is a card that is empty on the night it matters.
  await expect(page.getByTestId("vet-primary")).toContainText("VETERINARIO");
  await expect(page.getByTestId("vet-emergency")).toContainText("URGENCIAS");
  await expect(page.getByTestId("vet-primary-edit")).toContainText("Añadir");
  await expect(page.getByTestId("vet-primary-call")).toBeHidden();

  // An empty card asks in the household's own terms, and naming the dog is
  // what turns a field into a question somebody can answer.
  await expect(page.getByTestId("vet-primary")).toContainText(
    "la que conoce a Loki",
  );
  await expect(page.getByTestId("vet-emergency")).toContainText(
    "a cualquier hora del día",
  );
});

test("dials and maps what was written down", async ({ page }) => {
  await openHealth(page);

  await page.getByTestId("vet-emergency-edit").click();
  await page.getByTestId("vet-emergency-clinic").fill("Hospital Veterinario");
  await page.getByTestId("vet-emergency-phone").fill("944 42 40 40");
  await page.getByTestId("vet-emergency-address").fill("Sabino Arana 18");
  await page.getByTestId("vet-emergency-hours").fill("24h");
  await page.getByTestId("vet-emergency-save").click();

  await expect(page.getByTestId("vet-emergency")).toContainText("24h");
  // The number and the address are controls, not text: a row that looks like
  // a paragraph and happens to dial is a guess the tutor has to make.
  await expect(page.getByTestId("vet-emergency-call")).toContainText(
    "944 42 40 40",
  );
  await expect(page.getByTestId("vet-emergency-map")).toContainText(
    "Sabino Arana 18",
  );
  await expect(page.getByTestId("vet-emergency-edit")).toContainText("Editar");

  // And the other card is untouched: two clinics, two columns.
  await expect(page.getByTestId("vet-primary-edit")).toContainText("Añadir");
});

test("will not save a clinic nobody changed", async ({ page }) => {
  await openHealth(page);

  await page.getByTestId("vet-primary-edit").click();
  await expect(page.getByTestId("vet-primary-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("vet-primary-phone").fill("944 26 00 51");
  await expect(page.getByTestId("vet-primary-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("reads the illnesses back, and each one leads to its day", async ({
  page,
}) => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  await openHealth(page);

  // Written where it happened — the day view — and read here.
  await expect(page.getByTestId("health-incidents")).toBeHidden();

  await page.goto("/");
  await page.getByTestId("home-add").click();
  await page.getByTestId("home-add-incident").click();
  await page.getByTestId("entry-note").fill("**Diarrea** y vómitos");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("home-log")).toContainText("Diarrea");

  await page.goto("/health");
  await expect(page.getByTestId("health-incidents")).toContainText("Diarrea");
  // The note renders its Markdown: the asterisks are emphasis, not text.
  await expect(page.getByTestId("health-incidents")).not.toContainText("**");

  await page
    .getByTestId(/^health-incident-[0-9a-f]/)
    .first()
    .click();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}`;
  await expect(page).toHaveURL(new RegExp(`day=${today}`));
  await expect(page.getByTestId("home-log")).toContainText("Diarrea");
});

test("takes a date typed into the field, and keeps the calendar behind its icon", async ({
  page,
}) => {
  await openHealth(page);
  await addHealth(page, "treatment");

  // **The field is typed; the glyph is the calendar.** Every date used to go
  // through three taps in a picker, including the ones somebody already knew.
  const on = page.getByTestId("treatment-on");
  await on.fill("01092026");
  await page.getByTestId("treatment-name").click();

  // Normalised on blur — the one correction Android honours. A live mask that
  // inserted the slashes as the digits arrived was built and removed here for
  // the time fields.
  await expect(on).toHaveValue("01/09/2026");

  // A date that is not one says so rather than silently keeping the old value.
  await on.fill("31/02/2026");
  await page.getByTestId("treatment-name").click();
  await expect(page.getByTestId("treatment-on-typed-error")).toContainText(
    "DD/MM/AAAA",
  );

  // And the picker still writes into it.
  await page.getByTestId("treatment-on-picker").click();
  await expect(page.getByTestId("datepicker-confirm")).toBeVisible();
  await page.getByTestId("datepicker-confirm").click();
  await expect(page.getByTestId("treatment-on-typed-error")).toBeHidden();
  await expect(on).not.toHaveValue("");
});
