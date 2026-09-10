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

test("loads the stored pet and stays quiet until something changes", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");

  await expect(page.getByTestId("profile-title")).toHaveText("Loki");
  await expect(page.getByTestId("profile-name")).toHaveValue("Loki");
  await expect(page.getByTestId("profile-breed")).toHaveValue(
    "Husky Siberiano",
  );
  await expect(page.getByTestId("profile-birthdate")).toContainText(
    "14/09/2025",
  );

  // Nothing to save yet, and the button says so rather than inviting a
  // pointless write.
  await expect(page.getByTestId("profile-save")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByTestId("profile-name").fill("Loki II");
  await expect(page.getByTestId("profile-save")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("saves an edit and reads it back", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

  await page.getByTestId("profile-name").fill("Loki el Segundo");
  await page.getByTestId("profile-neutered-yes").click();
  await page.getByTestId("profile-activity-moderate").click();
  await page.getByTestId("profile-exercise-goal").fill("75");
  await page.getByTestId("profile-save").click();

  await expect(page.getByText("está al día")).toBeVisible();

  // The heading follows the name, which is how the tutor sees the save landed
  // without reading the toast.
  await expect(page.getByTestId("profile-title")).toHaveText("Loki el Segundo");

  await page.reload();
  await expect(page.getByTestId("profile-name")).toHaveValue("Loki el Segundo");
  await expect(page.getByTestId("profile-exercise-goal")).toHaveValue("75");
  await expect(page.getByTestId("profile-neutered-yes")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("refuses to save what registration would have refused", async ({
  page,
}) => {
  await seedSession(page);
  await page.goto("/profile");

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

  await page.getByTestId("profile-exercise-goal").fill("600");
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

  // The same coupling as onboarding, because it lives in lib/pets.ts rather
  // than in either screen.
  await page.getByTestId("profile-mixed").click();
  await expect(page.getByTestId("profile-breed")).toHaveValue("Mestizo");

  await page.getByTestId("profile-mixed").click();
  await expect(page.getByTestId("profile-breed")).toHaveValue("");
});

test("asks for the dog's name before deleting him", async ({ page }) => {
  await seedSession(page);
  await page.goto("/profile");

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

  for (const id of [
    "profile-name",
    "profile-sex-male",
    "profile-birthdate",
    "profile-birthdate-approx",
    "profile-breed",
    "profile-mixed",
    "profile-neutered-yes",
    "profile-activity-low",
    "profile-exercise-goal",
    "profile-save",
    "profile-signout",
    "profile-delete",
  ]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, `${id} should be visible`).not.toBeNull();
    expect(
      box!.height,
      `${id} is ${box!.height}px tall`,
    ).toBeGreaterThanOrEqual(48);
  }
});
