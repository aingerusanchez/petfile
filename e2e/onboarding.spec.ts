import { expect, test } from "@playwright/test";
import { resetE2EPets, seedSession } from "./auth";

test.beforeEach(async () => {
  // Every test starts from a known no-pet state, not just the first one.
  //
  // This was `beforeAll`, which broke isolation the moment a second test was
  // added after the one that registers a pet: `/onboarding` redirects away
  // once a pet exists, so those later tests found an empty screen and failed
  // on a missing element rather than on anything they were checking.
  // `workers: 1` in playwright.config.ts means these resets cannot race.
  await resetE2EPets();
});

test.afterAll(async () => {
  // Reset again on the way out so the suite is idempotent from either end:
  // the account is left at zero pets, which keeps a later run (or a manual
  // visit to /onboarding, which redirects away once a pet exists) from
  // depending on whether the previous run finished cleanly.
  await resetE2EPets();
});

/** Drives the calendar picker that replaced the free-text ISO field. */
async function pickExactBirthDate(
  page: import("@playwright/test").Page,
  /**
   * Defaults to the 1st, which is the only day guaranteed to be in the past
   * whatever the calendar opens on: `maxDate` disables future days, so a fixed
   * mid-month number fails whenever the suite runs early in a month.
   */
  day = 1,
) {
  await page.getByTestId("onboarding-birthdate").click();
  // Targeted by role and accessible name rather than by text: the library
  // gives every day cell `accessibilityRole="button"` and an
  // `accessibilityLabel` of the day number, so this asserts the accessible
  // tree at the same time as it drives the UI.
  await page
    .getByRole("button", { name: String(day), exact: true })
    .first()
    .click();
  await page.getByTestId("datepicker-confirm").click();
}

test("reports every missing required field at once, beside the field", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-submit").click();

  // Both required fields report together. The form used to reveal one error
  // per submit round-trip, rendered below every group.
  await expect(page.getByTestId("onboarding-name-error")).toBeVisible();
  await expect(page.getByTestId("onboarding-birthdate-error")).toBeVisible();
});

test("keeps the optional fields collapsed until asked for", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await expect(page.getByTestId("onboarding-optional")).toBeHidden();
  await expect(page.getByTestId("onboarding-neutered-yes")).toBeHidden();

  await page.getByTestId("onboarding-more").click();

  await expect(page.getByTestId("onboarding-neutered-yes")).toBeVisible();
  await expect(page.getByTestId("onboarding-activity-low")).toBeVisible();
});

test("reveals a second breed field only when the dog is marked mixed", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await expect(page.getByTestId("onboarding-breed-secondary")).toBeHidden();

  await page.getByTestId("onboarding-mixed").click();

  await expect(page.getByTestId("onboarding-breed-secondary")).toBeVisible();
});

test("asks for month and year only when the date is approximate", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-birthdate-approx").click();
  await page.getByTestId("onboarding-birthdate").click();

  // A month-and-year selector, never a calendar: an approximate date must not
  // make the tutor invent a day. This is the assertion most worth having —
  // the day grid reappearing is the exact regression this mode exists to
  // prevent, and it is what a naive use of the calendar library would produce.
  await expect(page.getByTestId("datepicker-approx")).toBeVisible();
  await expect(page.getByTestId("datepicker-month-9")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "15", exact: true }),
  ).toBeHidden();

  await page.getByTestId("datepicker-year-2025").click();
  await page.getByTestId("datepicker-month-9").click();

  // The preview states what will be stored before the tutor commits.
  await expect(page.getByTestId("datepicker-preview")).toContainText(
    "Septiembre de 2025",
  );

  await page.getByTestId("datepicker-confirm").click();

  // Rendered as what is actually known, not as a fabricated 01/09/2025.
  await expect(page.getByTestId("onboarding-birthdate")).toContainText(
    "Septiembre de 2025",
  );
});

test("closes the picker without saving via Cancelar", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-birthdate").click();
  await expect(page.getByTestId("datepicker-confirm")).toBeVisible();

  await page.getByTestId("datepicker-cancel").click();

  await expect(page.getByTestId("datepicker-confirm")).toBeHidden();
  // Nothing was committed, so the field still shows its placeholder.
  await expect(page.getByTestId("onboarding-birthdate")).toContainText(
    "DD/MM/AAAA",
  );
});

test("closes the picker without saving via the X", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-birthdate").click();
  await page.getByTestId("datepicker-close").click();

  await expect(page.getByTestId("datepicker-confirm")).toBeHidden();
  await expect(page.getByTestId("onboarding-birthdate")).toContainText(
    "DD/MM/AAAA",
  );
});

test("greets the animal by name on the primary action once there is one", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await expect(page.getByTestId("onboarding-submit")).toContainText(
    "Añadir mascota",
  );

  await page.getByTestId("onboarding-name").fill("Loki");

  // The only place in the flow where the name is read back to the tutor.
  await expect(page.getByTestId("onboarding-submit")).toContainText(
    "¡Vamos, Loki!",
  );
});

test("registers a pet with only the required fields and lands on the day view", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-name").fill("Loki");
  await pickExactBirthDate(page);
  await page.getByTestId("onboarding-sex-male").click();

  // Breed, sterilisation and activity level are left blank on purpose.
  await page.getByTestId("onboarding-submit").click();

  await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 15_000 });
});

test("runs the whole feedback cycle on the primary action", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  // An invalid submit is still a result: the button reports failure rather
  // than silently doing nothing, and the fields say why.
  await page.getByTestId("onboarding-submit").click();
  await expect(page.getByTestId("onboarding-submit-error")).toBeVisible();
  await expect(page.getByTestId("onboarding-name-error")).toBeVisible();
});

test("marks only the skippable field as optional, and gives sex its icons", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  // Breed is the one visible field the tutor may decline; name, sex and date
  // are required and carry no marker. Sex was briefly optional too, but the
  // `not null` column made that a save the database rejects.
  await expect(page.getByText("opcional")).toHaveCount(1);
  await expect(page.getByTestId("onboarding-sex-male")).toBeVisible();
  await expect(page.getByTestId("onboarding-sex-female")).toBeVisible();
});

test("confirms a successful save with a toast that survives the navigation", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-name").fill("Loki");
  await page.getByTestId("onboarding-sex-male").click();
  await pickExactBirthDate(page);
  await page.getByTestId("onboarding-submit").click();

  // The screen navigates away immediately; the toast host lives above the
  // Stack, so the confirmation outlives the screen that sent it. This is the
  // whole reason the host is mounted in the root layout.
  await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("toast-success")).toBeVisible();
  // The toast answers the button: "¡Vamos, Loki!" is the call, this is the dog
  // arriving. Pinning the exact wording keeps the pair from drifting apart,
  // which is the whole point of it.
  await expect(page.getByTestId("toast-success")).toContainText(
    "¡Loki ya está contigo!",
  );
  await expect(page.getByTestId("toast-success-countdown")).toBeVisible();
});

test("celebrates a successful registration, above the navigator", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await expect(page.getByTestId("celebration")).toBeHidden();

  await page.getByTestId("onboarding-name").fill("Loki");
  await page.getByTestId("onboarding-sex-male").click();
  await pickExactBirthDate(page);
  await page.getByTestId("onboarding-submit").click();

  // Same reason as the toast: it is hosted above the Stack, so it survives the
  // navigation that unmounts the screen which triggered it.
  await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("celebration")).toBeVisible();
});
