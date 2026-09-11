import { expect, test, type Page } from "@playwright/test";
import {
  resetE2EPets,
  seedE2EPet,
  seedE2ETreatments,
  seedSession,
} from "./auth";

/**
 * The treatment history: a filter, a search, and a way back into a row.
 *
 * **Seeded with the shape that made this a screen** — a year of monthly
 * antiparasitics under one product name, which is what buries everything else
 * in a section.
 */
async function seed(page: Page) {
  await resetE2EPets();
  const petId = await seedE2EPet();
  await seedE2ETreatments(petId, [
    ...[
      "2026-01-29",
      "2026-03-02",
      "2026-03-31",
      "2026-05-04",
      "2026-06-05",
      "2026-08-03",
      "2026-09-02",
    ].map((administeredOn) => ({
      kind: "antiparasitic" as const,
      name: "Nexgard",
      administeredOn,
    })),
    {
      kind: "deworming" as const,
      name: "Panacur 500mg",
      administeredOn: "2025-12-26",
      note: "Análisis coprológico por posibles giardias",
    },
    {
      kind: "deworming" as const,
      name: "Milbemax",
      administeredOn: "2026-07-14",
    },
    { kind: "vaccine" as const, name: "Rabia", administeredOn: "2026-01-29" },
  ]);
  await seedSession(page);
}

test.afterEach(async () => {
  await resetE2EPets();
});

test("the section hands over once it stops being a summary", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/health");

  // Five, and the count is what turns "there is more" into a reason to tap.
  await expect(page.getByTestId("health-treatments-all")).toContainText(
    "Ver los 10",
  );
  await page.getByTestId("health-treatments-all").click();
  await expect(page.getByTestId("treatments-title")).toBeVisible();
  await expect(page.getByTestId("treatments-list")).toContainText(
    "10 en total",
  );
});

test("filters by kind and searches the words that were written down", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/treatments");
  await expect(page.getByTestId("treatments-list")).toBeVisible();

  await page.getByTestId("treatments-kind-deworming").click();
  await expect(page.getByTestId("treatments-list")).toContainText("2 de 10");
  await expect(page.getByTestId("treatments-list")).not.toContainText(
    "Nexgard",
  );

  // The search reaches the note, which is where a diagnosis ends up.
  await page.getByTestId("treatments-kind-all").click();
  await page.getByTestId("treatments-search").fill("giardias");
  await expect(page.getByTestId("treatments-list")).toContainText("1 de 10");
  await expect(page.getByTestId("treatments-list")).toContainText("Panacur");

  // And it ignores the accent a phone keyboard did not offer.
  await page.getByTestId("treatments-search").fill("desparasitacion");
  await expect(page.getByTestId("treatments-list")).toContainText("2 de 10");

  await page.getByTestId("treatments-search").fill("zzz");
  await expect(page.getByTestId("treatments-empty")).toContainText(
    "Nada con esos criterios",
  );
});

test("opens a row to correct it, without going back for the form", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/treatments");

  await page.getByTestId("treatments-search").fill("Milbemax");
  await page
    .getByTestId(/^treatments-row-[0-9a-f]/)
    .first()
    .click();
  await expect(page.getByTestId("treatment-sheet")).toBeVisible();
  await page.getByTestId("treatment-name").fill("Milbemax 4 comprimidos");
  await page.getByTestId("treatment-save").click();

  await expect(page.getByTestId("treatments-list")).toContainText(
    "Milbemax 4 comprimidos",
  );
});

test("keeps every control on the 48dp floor", async ({ page }) => {
  await seed(page);
  await page.goto("/treatments");

  for (const id of [
    "treatments-back",
    "treatments-search",
    "treatments-kind-all",
    "treatments-kind-vaccine",
  ]) {
    const box = await page.getByTestId(id).boundingBox();
    expect(
      box?.height,
      `${id} is under the touch floor`,
    ).toBeGreaterThanOrEqual(48);
  }
});

test("the diary's calendar marks the day a vaccine touches", async ({
  page,
}) => {
  await resetE2EPets();
  const petId = await seedE2EPet();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Earlier this month, so the calendar opens on the month that carries it.
  const given = new Date(now.getFullYear(), now.getMonth(), 1);
  await seedE2ETreatments(petId, [
    { kind: "vaccine", name: "Rabia", administeredOn: iso(given) },
    // A deworming on another day of the same month earns no mark: a mark is
    // for the exception, and this one comes round every three months.
    {
      kind: "deworming",
      name: "Milbemax",
      administeredOn: iso(new Date(now.getFullYear(), now.getMonth(), 2)),
    },
  ]);
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-day").click();

  await expect(page.getByTestId("calendar-mark-vaccine")).toHaveCount(1);
  // The day says so in words too. Queried by attribute rather than by role:
  // the library wraps every custom cell in its own Pressable, so the richer
  // label sits on a node inside that one — see DESIGN.md on the two TalkBack
  // stops every day already costs.
  await expect(page.locator('[aria-label*="vacuna puesta"]')).toHaveCount(1);
});
