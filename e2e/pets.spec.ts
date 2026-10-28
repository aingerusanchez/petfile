import { expect, test, type Page } from "@playwright/test";
import {
  eventsTableExists,
  resetE2EPets,
  seedE2EEvents,
  seedE2EPet,
  seedSession,
} from "./auth";

/**
 * **The switcher's own suite: one account, two dogs, and the question of
 * which one every screen is talking about.**
 *
 * The first five cases came from the plan. The last two came from the
 * branch itself — a walk open on one dog thrown away by a look at the
 * other, and a closing ceremony replayed over a bar it had nothing to do
 * with. Both were latent the moment a second sheet could exist, and neither
 * of them throws: they show the tutor a confident wrong answer, which is
 * exactly the kind of defect that needs a test rather than an eye. Both
 * were checked by putting the defect back and watching the test go red,
 * because an assertion of absence nobody has seen fail proves nothing.
 *
 * **Nothing here types a fixed clock time onto today.** `e2e/home.spec.ts`
 * paid for that lesson: the entry sheet refuses a time in the future, so
 * 10:45 is a failing test until a quarter to eleven. The two walk cases use
 * the goal block's own start and stop, which take their instant from the
 * app, and the day case moves with ‹ rather than with the clock.
 *
 * **Three traps measured here, each one a red run before it was understood,
 * and each commented where it bites.** A loading skeleton satisfies every
 * assertion of absence, so a dog is only looked at once its own log has
 * landed (see `home-empty` below); the close overlay stays mounted while the
 * tab changes, so it has to be let go of before a replay can be waited for;
 * and registering a second pet leaves the screen it was started from mounted
 * and hidden, where `getByTestId` finds two of everything (see `visible`).
 */

/** The goal-bar cases need `0006_events_weights_treatments.sql` applied. */
let ready = false;

test.beforeAll(async () => {
  ready = await eventsTableExists();
});

test.beforeEach(async () => {
  await resetE2EPets();
});

test.afterAll(async () => {
  await resetE2EPets();
});

/**
 * The two sheets these specs switch between, oldest first.
 *
 * Order matters: `pickActivePet` falls back to the oldest, and a fresh
 * browser context has no stored choice, so the first one returned here is
 * the one every test starts on.
 */
async function seedTwoPets(): Promise<{ loki: string; nala: string }> {
  const loki = await seedE2EPet({
    name: "Loki",
    exercise_goal_minutes: 60,
  });
  const nala = await seedE2EPet({
    name: "Nala",
    sex: "female",
    breed_primary: "Border Collie",
    exercise_goal_minutes: 60,
  });
  return { loki, nala };
}

/**
 * Picks a pet the way a tutor does: from Perfil, through the sheet.
 *
 * The switcher lives on one screen, so every switch in this file is three
 * taps and a tab. Driven rather than planted in storage on purpose — the
 * stored id is `lib/pet.tsx`'s business and the point of these specs is that
 * the screens follow it.
 */
async function switchTo(page: Page, petId: string) {
  await page.getByRole("tab", { name: /Perfil/ }).click();
  await visible(page, "pet-switcher").click();
  await expect(visible(page, "pet-switcher-sheet")).toBeVisible();
  await visible(page, `pet-choice-${petId}`).click();
  await expect(page.getByTestId("pet-switcher-sheet")).toHaveCount(0);
}

/**
 * The one on screen, when the navigator is holding more than one copy.
 *
 * Registering a second pet pushes onboarding over the tab navigator and then
 * replaces it, which leaves the screen it was pushed from still mounted and
 * hidden underneath — so `getByTestId` finds two of everything and the first
 * of them can never be clicked. `getByRole` does not have the problem (the
 * hidden half is `aria-hidden`, so it is out of the accessibility tree
 * altogether), which is why only the testID locators need this.
 */
function visible(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

/** How long the close overlay is watched for. */
const WATCH_MS = 10_000;
/**
 * By when the bar has to be up for the watch above to have covered it.
 *
 * **Derived from the window, never a ceiling of its own.** The subtraction is
 * what the overlay needs to be seen — 760 ms and room to spare — so moving
 * the window moves this with it. A fixed number here was the previous round's
 * defect in a quieter form: at 3 s it was stricter than Playwright's own 5 s
 * default, so a load of four seconds, which the watch covered perfectly well,
 * would have failed a correct test.
 *
 * **And the wait in front of it carries the same number, or this one is
 * decoration.** The elapsed check only ever runs once the bar has been read,
 * so whatever deadline that read uses is the real floor: on Playwright's 5 s
 * default a slow load failed one line earlier, with a message about missing
 * text, and nothing here could ever have fired. Both `expect`s below pass
 * this explicitly so the two agree — a bar that takes longer than the watch
 * can cover is reported as what it is, by the assertion that says so.
 */
const WATCH_DEADLINE_MS = WATCH_MS - 1500;

/**
 * Whether the close overlay ever mounts in the next `ms`, as a value.
 *
 * **A value, not a rejection, and settled the instant it is created.** The
 * watch has to be armed before the navigation — the overlay stands for 760 ms
 * and a settled assertion afterwards would retry straight past it — but a
 * bare `waitForSelector` left unawaited while an `expect` runs is a promise
 * that can reject with nobody listening, which Playwright turns into a failed
 * test on perfectly good code. This project's own suite waits 15 s elsewhere
 * because Supabase sometimes takes its time, so that is not a hypothetical.
 * Attaching both handlers here makes the rejection harmless and turns the
 * question into a string the caller asserts on.
 *
 * **The timeout is told apart from every other failure**, because a page that
 * has gone down also fails to find the overlay, and passing for that reason
 * is passing for the wrong one.
 */
function closeOverlayWithin(page: Page, ms: number): Promise<string> {
  return page
    .waitForSelector('[data-testid="home-goal-close"]', {
      state: "attached",
      timeout: ms,
    })
    .then(
      () => "replayed",
      (cause: unknown) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        return /Timeout/i.test(message) ? "quiet" : `broke: ${message}`;
      },
    );
}

test("offers no switcher to a household with one dog, and the door to a second", async ({
  page,
}) => {
  await seedE2EPet({ name: "Loki" });
  await seedSession(page);
  await page.goto("/profile");

  await expect(page.getByTestId("profile-title")).toHaveText("Loki");

  // Nothing to switch between, so the control is absent rather than present
  // and useless: a chevron beside the name would invite a tap that opens a
  // sheet with one option in it.
  await expect(page.getByTestId("pet-switcher")).toHaveCount(0);

  // And the way to a second one is here all the same — hiding it until there
  // are two would be a door that opens once you are already through it.
  await expect(page.getByTestId("profile-add-pet")).toBeVisible();
});

test("lists both dogs and marks the one on screen", async ({ page }) => {
  const { loki, nala } = await seedTwoPets();
  await seedSession(page);
  await page.goto("/profile");

  // The row says what pressing it would change, not just whose file this is.
  const row = page.getByTestId("pet-switcher");
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute(
    "aria-label",
    "Cambiar de mascota. Ahora: Loki",
  );

  await row.click();
  await expect(page.getByTestId("pet-switcher-sheet")).toBeVisible();

  // An exclusive single-select, in the dialect the chips already speak: a
  // radiogroup of radios, with the state on `aria-checked` because
  // react-native-web renders the role and drops `accessibilityState`.
  // Scoped to the sheet, not to the page: Perfil's own chips are radios too,
  // and they are only absent today because every edit section is closed.
  const options = page.getByTestId("pet-switcher-sheet").getByRole("radio");
  await expect(options).toHaveCount(2);
  await expect(page.getByTestId(`pet-choice-${loki}`)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByTestId(`pet-choice-${nala}`)).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByTestId(`pet-choice-${nala}`)).toContainText("Nala");

  // Closing without choosing leaves the file where it was.
  await page.getByTestId("pet-switcher-close").click();
  await expect(page.getByTestId("pet-switcher-sheet")).toBeHidden();
  await expect(page.getByTestId("profile-title")).toHaveText("Loki");
});

test("lands on the dog just registered, and the sheet goes back to the other", async ({
  page,
}) => {
  const loki = await seedE2EPet({ name: "Loki" });
  await seedSession(page);
  await page.goto("/");

  // **The empty log is where this screen says a name, and `home-title` is
  // not.** The headline reads "Hoy" whoever the dog is — only a birthday
  // replaces it — so asking the title whose diary this is would mean giving
  // both dogs a birthday today, and this test would then break the day
  // somebody touches birthdays, for a reason that has nothing to do with the
  // switcher. The empty state says the name in plain words, and both halves
  // here are on today with a sheet that was just created, which is exactly
  // when it speaks.
  await expect(page.getByTestId("home-empty")).toContainText("Loki");

  await page.getByRole("tab", { name: /Perfil/ }).click();
  await page.getByTestId("profile-add-pet").click();
  await expect(page.getByTestId("onboarding-name")).toBeVisible();

  await page.getByTestId("onboarding-name").fill("Nala");
  // The 1st, which is the only day guaranteed to be in the past whatever
  // month the picker opens on: `maxDate` disables the future, so a fixed
  // mid-month number fails whenever the suite runs early in a month. The
  // date itself is not this test's subject.
  await page.getByTestId("onboarding-birthdate-picker").click();
  await page.getByRole("button", { name: "1", exact: true }).first().click();
  await page.getByTestId("datepicker-confirm").click();
  await page.getByTestId("onboarding-submit").click();

  // **The registration is the switch.** Nobody is asked to choose afterwards,
  // so the diary has to arrive already talking about her — this is the door
  // the wrong-dog defect came in through.
  await expect(visible(page, "home-empty")).toContainText("Nala", {
    timeout: 15_000,
  });

  // And the other half: the sheet takes the diary back, which is what the
  // registration alone can never prove.
  await switchTo(page, loki);
  await expect(visible(page, "profile-title")).toHaveText("Loki");
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(visible(page, "home-empty")).toContainText("Loki");
});

test("keeps the day you were reading when the dog changes", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { nala } = await seedTwoPets();

  // **One row that only Nala has, and only on yesterday**, because without it
  // this test had nothing on the day view that could tell the two dogs apart
  // there. A past day's empty state names nobody — "Ese día no se apuntó
  // nada" is the same sentence for both — so every wait this case made was
  // satisfied just as well by Loki's screen or by the skeleton, and it was
  // the one case in this file nobody had ever seen go red. Her meal makes
  // "whose yesterday is on screen" a question with an answer.
  //
  // Noon yesterday, built from a "now" the test owns: it is behind us at
  // every hour the suite can run, including the first minutes of the day.
  const noon = new Date();
  noon.setDate(noon.getDate() - 1);
  noon.setHours(12, 0, 0, 0);
  await seedE2EEvents(nala, [
    { kind: "meal", occurredAt: noon, what: "Pienso" },
  ]);

  await seedSession(page);
  await page.goto("/");

  // ‹ rather than a typed date: the day the tutor stepped back to is the
  // subject here, and yesterday is the one that is always behind us.
  await page.getByTestId("home-prev-day").click();
  await expect(page.getByTestId("home-title")).toHaveText("Ayer");
  // The other half of what makes her row a discriminator: his yesterday is
  // empty, so one entry on screen can only be hers.
  await expect(page.getByTestId("home-empty")).toBeVisible();
  const yesterday = await page.getByTestId("home-date").textContent();
  expect(yesterday).toBeTruthy();

  await switchTo(page, nala);
  await expect(page.getByTestId("profile-title")).toHaveText("Nala");
  await page.getByRole("tab", { name: /Diario/ }).click();

  // **Her meal is the proof that what is on screen is her yesterday**: not
  // the skeleton, not his day, and not today — she has nothing today. A day
  // snapped back to today fails right here, before the two assertions below
  // get their turn.
  await expect(page.locator('[data-testid^="home-entry-"]')).toHaveCount(1);

  // Changing dog answers "whose diary", never "which day". Snapping back to
  // today would lose the place of a tutor comparing two animals' Sundays.
  await expect(page.getByTestId("home-date")).toHaveText(yesterday!);
  await expect(page.getByTestId("home-title")).toHaveText("Ayer");
});

/**
 * **Deleting the dog on screen leaves the account on the other one —
 * everywhere, not only on the screen that did the deleting.**
 *
 * **The diary is opened before the delete on purpose, and that is the whole
 * difference between this catching the defect and missing it.** A tab
 * mounted *after* the fact reads the stored id fresh, and an id naming a
 * sheet that no longer exists is already answered — `pickActivePet` falls
 * back to the oldest — so a Diario first opened here shows the survivor
 * however little Perfil did. What stayed wrong was a tab that was already
 * alive: Expo Router does not unmount it, its read hangs off `activePetId`,
 * and nothing re-runs until that id moves. Measured in red by taking the
 * fix back out: the last assertion still read "Nala", under a FAB writing
 * against a `pet_id` the server had dropped.
 */
test("falls back to the remaining dog when the one on screen is deleted", async ({
  page,
}) => {
  const { nala } = await seedTwoPets();
  await seedSession(page);
  await page.goto("/profile");

  await switchTo(page, nala);
  await expect(page.getByTestId("profile-title")).toHaveText("Nala");

  // Her diary, looked at and left behind the tabs. The empty log is where
  // this screen says a name — see the registration case for why not
  // `home-title` — and waiting for it is also what keeps the skeleton from
  // satisfying the assertion at the end of this test.
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-empty")).toContainText("Nala", {
    timeout: 15_000,
  });
  await page.getByRole("tab", { name: /Perfil/ }).click();

  await page.getByTestId("profile-edit-main").click();
  await page.getByTestId("profile-delete").click();
  await page.getByTestId("profile-delete-name").fill("Nala");
  await page.getByTestId("profile-delete-confirm").click();

  // The stored id now names nothing, and that is already answered: the
  // fallback is the oldest sheet left. What must not happen is the blank
  // screen or the trip to onboarding that a single-pet app would make.
  await expect(page.getByTestId("profile-title")).toHaveText("Loki", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("onboarding-name")).toHaveCount(0);

  // One sheet left, so the switcher is gone again with it.
  await expect(page.getByTestId("pet-switcher")).toHaveCount(0);
  await expect(page.getByTestId("profile-add-pet")).toBeVisible();

  // **And the tab that was never told.** This is the half the recovering
  // reload above cannot reach: the diary has been mounted since before the
  // delete, so it only reads again if the stored id moves to the survivor.
  // A dog on a header is the mild version of the failure — the FAB under it
  // writes against the id this screen is holding.
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-empty")).toContainText("Loki", {
    timeout: 15_000,
  });
});

/**
 * **A walk left open on one dog survives a look at the other.**
 *
 * The title says survives and not "does not show on the wrong dog", because
 * the second is not what this can catch and promising it would send the next
 * person after the wrong defect. The diary looks its running walk up among
 * the day's rows (`events.find(e => e.id === runningId)`), so a stale id
 * belonging to the other dog simply finds nothing and his button stays
 * quiet: **breaking only the read does not fail this test, and that is
 * measured.** What did the damage was the write — one slot on the device for
 * "the walk that is running" — because the effect that clears a walk the
 * server does not have then removed Nala's from under Loki's screen, and it
 * was gone when she came back. The last three assertions are the ones that
 * bite.
 */
test("keeps a walk left open on the dog whose walk it is", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { loki, nala } = await seedTwoPets();
  await seedSession(page);
  await page.goto("/");

  await switchTo(page, nala);
  await page.getByRole("tab", { name: /Diario/ }).click();
  // **Her empty log is the proof the switch has landed.** The control is on
  // screen throughout — it belongs to the header, not to the load — so
  // waiting for it to be visible waits for nothing, and the first run of this
  // test started the walk on Loki's bar a moment before Nala's arrived. The
  // empty state is the one line on this screen that says a name.
  await expect(page.getByTestId("home-empty")).toContainText("Nala");

  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();

  const entries = page.locator('[data-testid^="home-entry-"]');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("En marcha");

  // Loki's screen is quiet, which is worth saying but is not the catch: it
  // would be quiet with the defect in place too, because his day has no such
  // row to find. What matters is that this visit is where the clearing effect
  // used to reach across and delete her walk.
  await switchTo(page, loki);
  await page.getByRole("tab", { name: /Diario/ }).click();
  // The empty log again, for the same reason as above and a sharper one: the
  // three assertions below are all absences, and a skeleton satisfies every
  // one of them.
  await expect(page.getByTestId("home-empty")).toContainText("Loki");
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "De paseo",
  );
  await expect(page.getByTestId("home-goal-dot")).toHaveCount(0);
  await expect(entries).toHaveCount(0);

  // **And here is the whole test.** Her walk is still open, rather than
  // having been thrown away while nobody was looking at it. Against a device
  // store with one slot for every dog, this is where it fails — measured, by
  // putting that store back and watching it go red here.
  await switchTo(page, nala);
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("En marcha");
});

/**
 * **A walk closed on one dog does not play its ceremony over the other's bar.**
 *
 * **And one thing this case has never been seen to do.** The mutation that
 * proves it bites — dropping the pet half of the gate in `app/(tabs)/index.tsx`
 * — turns it red through the *measure*, not through the watch: a `closed`
 * that outlives the switch is handed to Nala's block with Loki's totals, and
 * `toContainText("Nala aún no ha salido")` fails before the quiet watch is
 * read. So the overlay assertions below have never failed on their own
 * account, and nobody should assume they are what caught a regression here
 * until they have seen them do it.
 */
test("does not replay a close over the other dog's bar", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");

  const { loki, nala } = await seedTwoPets();
  await seedSession(page);
  await page.goto("/");

  // **Written on before it is stopped, or there is no close to withhold.** A
  // walk stopped inside its first minute is deleted as a mis-tap and records
  // nothing, so this would pass over a gate that had been removed.
  await page.getByTestId("home-goal-control").click();
  const row = page.locator('[data-testid^="home-entry-"]').first();
  await expect(row).toContainText("En marcha");
  await row.click();
  await page.getByTestId("entry-note").fill("Ha bebido en la fuente");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);

  // Armed before the tap, because the overlay mounts on the stop and is gone
  // 760 ms later: a settled assertion afterwards would retry straight past
  // it, and then the rest of this test would be proving nothing.
  const mounted = page.waitForSelector('[data-testid="home-goal-close"]', {
    state: "attached",
  });
  await page.getByTestId("home-goal-control").click();
  await mounted;
  await expect(page.getByTestId("home-goal")).toContainText("1 min en 1 paseo");
  // **And let go of before the switch, or the rest of this proves nothing.**
  // The diary's screen stays mounted behind Perfil, so an overlay still
  // standing from his own close would satisfy the wait below without any
  // replay having happened — which is exactly how the first run of this test
  // failed.
  await expect(page.getByTestId("home-goal-close")).toHaveCount(0);

  // **Never, rather than "gone by the time we looked".** Nala's bar holds no
  // minutes at all, and a close let go of with the pet it belonged to is the
  // only thing that keeps her ground from animating a lap she never walked.
  // `toHaveCount(0)` cannot tell that apart from a 760 ms replay, so the
  // watch is armed before the navigation and read as a value at the end.
  //
  // The elapsed check is the other half: "quiet" means nothing if her bar
  // landed after the watch had already closed, and this is what says so when
  // it happens.
  //
  // **It covers a late arrival and not an early one.** The diary starts
  // reloading the moment the option inside `switchTo` is pressed, which is
  // before the watch is armed here, so a bar that landed in that gap would
  // take a replay with it unseen. The race is a narrow one on any ordinary
  // connection and it predates this watch, so it is left open deliberately
  // rather than closed with machinery — but "quiet" is "nobody replayed
  // while we were looking", not "nobody replayed".
  await switchTo(page, nala);
  const armedForHers = Date.now();
  const onHers = closeOverlayWithin(page, WATCH_MS);
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-goal")).toContainText(
    "Nala aún no ha salido",
    {
      timeout: WATCH_DEADLINE_MS,
    },
  );
  expect(
    Date.now() - armedForHers,
    "her bar landed after the watch had closed, so a quiet watch here would mean nobody was looking",
  ).toBeLessThan(WATCH_DEADLINE_MS);
  expect(await onHers).toBe("quiet");

  // Nor on the way back to the dog it did happen to, for the same reason the
  // day view does not replay one: the block unmounts behind the skeleton and
  // comes back with no memory of what it has already played.
  await switchTo(page, loki);
  const armedForHis = Date.now();
  const again = closeOverlayWithin(page, WATCH_MS);
  await page.getByRole("tab", { name: /Diario/ }).click();
  await expect(page.getByTestId("home-goal")).toContainText(
    "1 min en 1 paseo",
    {
      timeout: WATCH_DEADLINE_MS,
    },
  );
  expect(
    Date.now() - armedForHis,
    "his bar landed after the watch had closed, so a quiet watch here would mean nobody was looking",
  ).toBeLessThan(WATCH_DEADLINE_MS);
  expect(await again).toBe("quiet");
});
