import { expect, test } from "@playwright/test";
import { resetE2EPets, seedE2EPet, seedSession } from "./auth";

// A pet per test, and none left behind: the profile only exists once there is
// something to edit, and the onboarding specs need the account empty. Reset
// runs on both ends for the same reason it does there — a run has to be
// idempotent from either direction.
test.beforeEach(async () => {
  await resetE2EPets();
  await seedE2EPet();
});

test.afterAll(async () => {
  await resetE2EPets();
});

test("presents the file rather than a form", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await expect(page.getByTestId("profile-title")).toHaveText("Loki");
  await expect(page.getByTestId("profile-breed")).toHaveText("Husky Siberiano");

  // The age is derived, so the assertion is on its shape and not on a number
  // that changes with the calendar.
  await expect(page.getByTestId("profile-age")).toHaveText(
    /^(Menos de un mes|(unos |un )?\d* ?(mes|meses|años)) · (Cachorro|Adolescente|Adulto|Senior)$/,
  );

  await expect(page.getByTestId("profile-neutered-value")).toHaveText("No");
  await expect(page.getByTestId("profile-activity-value")).toHaveText("Alto");
  await expect(page.getByTestId("profile-goal-value")).toHaveText(
    "Sin objetivo",
  );
  // The portrait carries a camera rather than a word: a band across the foot
  // of the circle ate a slice of the one thing the header exists to show.
  await expect(page.getByTestId("profile-avatar-badge")).toBeVisible();

  // No fields, and above all no delete button, on a screen someone opened to
  // look at their dog.
  await expect(page.getByTestId("profile-name")).toBeHidden();
  await expect(page.getByTestId("profile-delete")).toBeHidden();
  await expect(page.getByTestId("profile-save")).toBeHidden();
  await expect(page.getByTestId("profile-edit-main")).toBeVisible();
  await expect(page.getByTestId("profile-edit-health")).toBeVisible();
});

test("invites the tutor only while something is missing", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  // The seeded pet has a sex and a breed, so there is nothing to invite. The
  // photo is not in that list: the portrait carries its own affordance.
  await expect(page.getByTestId("profile-complete")).toBeHidden();

  await resetE2EPets();
  await seedE2EPet({ breed_primary: null });
  await page.reload();

  await expect(page.getByTestId("profile-complete")).toBeVisible();
  await page.getByTestId("profile-complete").click();
  await expect(page.getByTestId("profile-breed-input")).toBeVisible();
});

test("drops the breed line rather than captioning the hole", async ({
  page,
}) => {
  await resetE2EPets();
  await seedE2EPet({ breed_primary: null });

  await seedSession(page);
  await page.goto("/profile");

  await expect(page.getByTestId("profile-breed")).toBeHidden();
  // And the age still carries the header on its own.
  await expect(page.getByTestId("profile-age")).toBeVisible();
});

test("opens the photo editor from the portrait", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  // The portrait is the affordance, not a link beside it.
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "aria-label",
    "Añadir una foto de Loki",
  );
  await page.getByTestId("profile-avatar").click();

  await expect(page.getByTestId("avatar-editor")).toBeVisible();
  // Nothing picked yet, so there is nothing to save and no frame to drag.
  await expect(page.getByTestId("avatar-editor-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByTestId("avatar-editor-stage")).toBeHidden();
  await expect(page.getByTestId("avatar-editor-pick")).toHaveText(
    "Elegir foto",
  );
  await expect(page.getByTestId("avatar-editor-slider")).toBeHidden();

  await page.getByTestId("avatar-editor-cancel").click();
  await expect(page.getByTestId("avatar-editor")).toBeHidden();
});

test("frames a picked photo and stores the crop", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");
  await page.getByTestId("profile-avatar").click();

  // On the web target expo-image-picker is an <input type="file">, which is
  // what makes the whole pick → frame → crop → upload path testable here. The
  // fixture is 600x400, so cover zoom takes the middle 400x400 square.
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("avatar-editor-pick").click();
  (await chooser).setFiles("e2e/fixtures/photo.jpg");

  await expect(page.getByTestId("avatar-editor-stage")).toBeVisible();
  await expect(page.getByTestId("avatar-editor-zoom")).toHaveText("1.0×");
  // Cover zoom is the floor, so there is nothing to zoom out of yet.
  await expect(page.getByTestId("avatar-editor-zoom-out")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("avatar-editor-zoom-in").click();
  await expect(page.getByTestId("avatar-editor-zoom")).toHaveText("1.5×");

  // Three controls for one value, none of them redundant: the slider shows
  // the range, the buttons step it precisely, the pinch is the device's.
  await expect(page.getByTestId("avatar-editor-slider")).toHaveAttribute(
    "role",
    "slider",
  );
  await expect(page.getByTestId("avatar-editor-slider")).toHaveAttribute(
    "aria-valuenow",
    "1.5",
  );
  await expect(page.getByTestId("avatar-editor-zoom-out")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await expect(page.getByTestId("avatar-editor-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("avatar-editor-save").click();

  await expect(page.getByText("Foto actualizada")).toBeVisible();
  await expect(page.getByTestId("avatar-editor")).toBeHidden();

  // The portrait now renders the stored crop, and its label follows.
  await expect(page.getByTestId("profile-avatar-image")).toBeVisible();
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "aria-label",
    "Cambiar la foto de Loki",
  );

  await page.reload();
  await expect(page.getByTestId("profile-avatar-image")).toBeVisible();
});

test("takes the photo away again", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");
  await page.getByTestId("profile-avatar").click();

  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("avatar-editor-pick").click();
  (await chooser).setFiles("e2e/fixtures/photo.jpg");
  await page.getByTestId("avatar-editor-save").click();
  await expect(page.getByTestId("profile-avatar-image")).toBeVisible();

  await page.getByTestId("profile-avatar").click();
  await page.getByTestId("avatar-editor-remove").click();

  // Back to the initial, which is a complete answer rather than a gap.
  await expect(page.getByTestId("profile-avatar-initial")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("profile-avatar-initial")).toBeVisible();
});

test("keeps the initial whole when the name starts with an emoji", async ({
  page,
}) => {
  await resetE2EPets();
  await seedE2EPet({ name: "🐶 Loki" });

  await seedSession(page);
  await page.goto("/profile");

  // `charAt(0)` on an emoji is half a surrogate pair, and the frame drew a
  // broken glyph. The initial is the first grapheme, whatever it is.
  await expect(page.getByTestId("profile-avatar-initial")).toHaveText("🐶");
});

test("pins the day to the 1st when the date turns approximate", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");
  await page.getByTestId("profile-edit-main").click();

  // The seeded pet was born on 14/09/2025. An exact date is typed into a
  // field now, so it is a value rather than text; ticking "aproximado" turns
  // the control back into a button, which is why the next assertion reads
  // the other way.
  await expect(page.getByTestId("profile-birthdate")).toHaveValue("14/09/2025");

  // Ticking it says "I know the month, not the day", so the stored value has
  // to drop to the 1st — and keep being September of 2025.
  await page.getByTestId("profile-birthdate-approx").click();
  await expect(page.getByTestId("profile-birthdate")).toContainText(
    "Septiembre de 2025",
  );

  // And it survives the round trip, which is where a corrupted value would
  // show up as a refusal or as a date nobody recognises.
  await page.getByTestId("profile-save").click();
  await expect(page.getByText("está al día")).toBeVisible();
  await page.reload();
  await page.getByTestId("profile-edit-main").click();
  await expect(page.getByTestId("profile-birthdate")).toContainText(
    "Septiembre de 2025",
  );
});

test("opens a block, saves it, and the header follows", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-main").click();

  // Nothing to save yet, and the button says so rather than inviting a
  // pointless write.
  await expect(page.getByTestId("profile-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("profile-name").fill("Loki el Segundo");
  await expect(page.getByTestId("profile-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("profile-save").click();

  await expect(page.getByText("está al día")).toBeVisible();

  // Saving closes the block and the file reads back the new name, which is how
  // the tutor sees the write landed without reading the toast.
  await expect(page.getByTestId("profile-title")).toHaveText("Loki el Segundo");
  await expect(page.getByTestId("profile-name")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("profile-title")).toHaveText("Loki el Segundo");
});

test("saves the health block, unit and all", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-health").click();

  await page.getByTestId("profile-neutered-yes").click();
  await page.getByTestId("profile-activity-moderate").click();
  await page.getByTestId("profile-exercise-goal").fill("75");
  await page.getByTestId("profile-save").click();

  await expect(page.getByTestId("profile-goal-value")).toHaveText("1h 15m");
  await expect(page.getByTestId("profile-neutered-value")).toHaveText("Sí");
  await expect(page.getByTestId("profile-activity-value")).toHaveText(
    "Moderado",
  );

  await page.reload();
  await expect(page.getByTestId("profile-goal-value")).toHaveText("1h 15m");
});

test("takes the goal in hours, and gives it back that way", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");
  await page.getByTestId("profile-edit-health").click();

  // "5h" is the shape a tutor reaches for on a target this size, which is why
  // this field keeps the alphabetic keyboard where the walk sheet does not.
  await page.getByTestId("profile-exercise-goal").fill("5h");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-goal-value")).toHaveText("5h");

  // And reopening shows it in the same words rather than as 300.
  await page.getByTestId("profile-edit-health").click();
  await expect(page.getByTestId("profile-exercise-goal")).toHaveValue("5h");

  // Bare minutes still work, and the field tidies them on blur.
  await page.getByTestId("profile-exercise-goal").fill("90");
  await page.getByTestId("profile-activity-low").click();
  await expect(page.getByTestId("profile-exercise-goal")).toHaveValue("1h 30m");
});

test("says so when the goal is not a duration", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");
  await page.getByTestId("profile-edit-health").click();

  await page.getByTestId("profile-exercise-goal").fill("un rato");
  await expect(page.getByTestId("profile-exercise-goal-error")).toHaveText(
    "Escríbelo como 1h 30m",
  );

  // Forgive on input, as everywhere else.
  await page.getByTestId("profile-exercise-goal").fill("45");
  await expect(page.getByTestId("profile-exercise-goal-error")).toBeHidden();
});

test("discards an edit that was cancelled", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-main").click();
  await page.getByTestId("profile-name").fill("Nombre equivocado");
  await page.getByTestId("profile-cancel").click();

  await expect(page.getByTestId("profile-title")).toHaveText("Loki");

  // And reopening shows the file as it is, not as it was left.
  await page.getByTestId("profile-edit-main").click();
  await expect(page.getByTestId("profile-name")).toHaveValue("Loki");
});

test("keeps one block open at a time", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-main").click();
  await expect(page.getByTestId("profile-name")).toBeVisible();

  await page.getByTestId("profile-edit-health").click();
  await expect(page.getByTestId("profile-exercise-goal")).toBeVisible();
  await expect(page.getByTestId("profile-name")).toBeHidden();
});

test("refuses to save what registration would have refused", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-main").click();
  await page.getByTestId("profile-name").fill("");
  await page.getByTestId("profile-save").click();

  await expect(page.getByTestId("profile-name-error")).toHaveText(
    "¿Cómo se llama?",
  );

  // Forgive on input: the error goes as soon as the field is valid again.
  await page.getByTestId("profile-name").fill("Loki");
  await expect(page.getByTestId("profile-name-error")).toBeHidden();
});

test("caps a mistyped exercise goal", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-health").click();
  await page.getByTestId("profile-exercise-goal").fill("600");
  await page.getByTestId("profile-save").click();

  await expect(page.getByTestId("profile-exercise-goal-error")).toHaveText(
    "Como mucho 300 minutos",
  );

  // The cap is on the minutes, so it holds however the tutor wrote them.
  await page.getByTestId("profile-exercise-goal").fill("6h");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-exercise-goal-error")).toHaveText(
    "Como mucho 300 minutos",
  );
});

test("keeps the mixed flag and the breed field saying the same thing", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-main").click();

  // The same coupling as onboarding, because it lives in lib/pets.ts rather
  // than in either screen.
  await page.getByTestId("profile-mixed").click();
  await expect(page.getByTestId("profile-breed-input")).toHaveValue("Mestizo");

  await page.getByTestId("profile-mixed").click();
  await expect(page.getByTestId("profile-breed-input")).toHaveValue("");
});

test("asks for the name before deleting the file", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-edit-main").click();
  await page.getByTestId("profile-delete").click();

  // The ceremony is the point: a destructive action nobody can trigger by
  // mis-tapping.
  await expect(page.getByTestId("profile-delete-confirm")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("profile-delete-name").fill("Thor");
  await expect(page.getByTestId("profile-delete-confirm")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  // Case is not part of the test the tutor has to pass.
  await page.getByTestId("profile-delete-name").fill("loki");
  await expect(page.getByTestId("profile-delete-confirm")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("profile-delete-confirm").click();

  // With no pet left, the root sends the tutor back to registration.
  await expect(page.getByTestId("onboarding-name")).toBeVisible({
    timeout: 15000,
  });
});

test("keeps every control on the 48dp floor here too", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

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

  await floor([
    "profile-avatar",
    "profile-edit-main",
    "profile-edit-health",
    "profile-signout",
  ]);

  await page.getByTestId("profile-edit-main").click();
  await floor([
    "profile-name",
    "profile-sex-male",
    "profile-birthdate",
    "profile-birthdate-approx",
    "profile-breed-input",
    "profile-mixed",
    "profile-save",
    "profile-cancel",
    "profile-delete",
  ]);

  await page.getByTestId("profile-edit-health").click();
  await floor([
    "profile-neutered-yes",
    "profile-activity-low",
    "profile-exercise-goal",
  ]);
});
