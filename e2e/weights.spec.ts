import { expect, test } from "@playwright/test";
import { resetE2EPets, seedE2EPet, seedE2EWeights, seedSession } from "./auth";

/**
 * The weight, full screen.
 *
 * The miniature answers "which way"; this answers "when, and how much". What
 * the specs hold is the split — that the section hands over, and that the
 * screen carries every weighing rather than the four labels that fit above.
 */
test.beforeEach(async ({ page }) => {
  await resetE2EPets();
  const petId = await seedE2EPet();
  await seedE2EWeights(petId, [
    { measuredOn: "2025-12-26", grams: 9200 },
    { measuredOn: "2026-01-29", grams: 12400 },
    { measuredOn: "2026-03-02", grams: 15100 },
    { measuredOn: "2026-05-04", grams: 18600 },
    { measuredOn: "2026-07-14", grams: 22500 },
  ]);
  await seedSession(page);
});

test.afterEach(async () => {
  await resetE2EPets();
});

test("the chart is a door, and the weight above it is not", async ({
  page,
}) => {
  await page.goto("/health");
  await expect(page.getByTestId("weight-line")).toBeVisible();

  // Two intentions, two controls: the number corrects the day's weighing...
  await page.getByTestId("health-weight-latest").click();
  await expect(page.getByTestId("weight-sheet")).toBeVisible();

  // ...and the line opens every weighing there has been.
  await page.goto("/health");
  await page.getByTestId("health-weight-chart").click();
  await expect(page.getByTestId("weights-title")).toBeVisible();
});

test("carries every weighing, not the four labels that fit", async ({
  page,
}) => {
  await page.goto("/weights");

  await expect(page.getByTestId("weights-chart")).toBeVisible();
  await expect(page.getByTestId("weights-list")).toContainText("9,2 kg");
  await expect(page.getByTestId("weights-list")).toContainText("22,5 kg");
  await expect(page.getByTestId("weights-list")).toContainText("15,1 kg");
});

test("says nothing rather than drawing nothing", async ({ page }) => {
  await resetE2EPets();
  await seedE2EPet();
  await page.goto("/weights");
  await expect(page.getByTestId("weights-empty")).toContainText(
    "Todavía no le habéis pesado",
  );
});
