# Goal Tiers and the Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The goal bar reads two tiers, and a finished walk fills it from the tick instead of stumbling and then swelling.

**Architecture:** One scalar carries the whole model. `barProgress` turns the day's minutes into a number whose integer part is the tier reached and whose fraction is progress through it — `0.5` is halfway to the goal, `1.0` is the goal, `2.0` is double. The bar's ground is the integer part and its fill is the fraction; the close is a single interpolation between two of those numbers, which crosses a tier boundary without any special case. Both ends are known at the tap, so the `fresh` gate goes and the 400 ms hole with it.

**Tech Stack:** Expo SDK 57, React Native 0.86, `react-native-reanimated` 4.5.1, `react-native-svg` 15.15.4, NativeWind 5. No new dependency and **no migration** — Tier 2 is derived.

**Spec:** `docs/specs/2026-10-20-goal-tiers-and-close-design.md`. Read it; this plan argues from it and does not repeat its reasoning.

## Global Constraints

- Read `AGENTS.md` first. Its platform notes are measured facts, not advice.
- **Tier 1 is `pets.exercise_goal_minutes`, unchanged. Tier 2 is `2 × Tier 1`, computed.** No column, no form field, no generated types, no migration.
- **A tutor with no goal keeps today's behaviour exactly**: no bar, no calendar underline.
- **Aqua is still "objetivo conseguido"**, on the bar and in the calendar's miniature of it. Aurora Boreal (`accentFocus`) is Tier 2, on both surfaces.
- Copy, provisional and fixed for now: Tier 1 `"Objetivo conseguido"`, Tier 2 `"Objetivo conseguido x2"`. The measure reads the day's total against the **top** tier — `"3h de 4h"`.
- **Every animation is absent under `useReducedMotion()`, not slowed** — a Brand Commitment. For the close that means the bar is painted at the fill's **end state immediately**, not left to the old behaviour, or the 400 ms hole comes back for those tutors.
- No raw hex: colours from `components/ui/tokens.ts` or `global.css`. Literal pixels, never rem (`1rem` is 14 on native). No `style={(` callback on a `Pressable`. Template-literal class strings keep the separator outside the quotes. `react-hooks/exhaustive-deps` and `react-hooks/set-state-in-effect` are errors. TypeScript strict, no `any`.
- Conventional Commits, imperative, lowercase, no trailing period. One version for the whole branch, cut in Task 8.
- The e2e dev server dies on long runs: a bulk failure whose first error is `ERR_CONNECTION_REFUSED` is the server. `pkill -f "expo start"` and run again. Never run the whole suite from a task; run the specs you touched.

## Review Focus

Five conditions the spec implies that no happy path reaches. Each one's test is added to the task that owns the code.

1. **A walk that crosses both tiers in one close** — from below the goal to past double. The fill must cross two boundaries in one animation, and the confetti must fire once, not twice. → Task 1 and Task 3.
2. **The reload fails after a successful close.** The fill has animated to a value the data never confirms; it must hold, not snap back. → Task 4.
3. **The tutor edits the goal while a walk is running.** `goalMinutes` changes under a live bar and every derived number moves at once. → Task 2.
4. **Reduced motion on a tier-crossing close.** The end state painted must carry the right _ground_, not just the right width. → Task 3.
5. **A day already past Tier 2.** More minutes cannot be shown; the close must be `none` and the bar must not flicker. → Task 1 and Task 3.

---

### Task 1: The tier model and the new close, in `lib/`

A wrong case here does not throw: it paints the day's effort at the wrong tier, or in the wrong colour. That is this project's stated reason for keeping such logic in `lib/`.

**Files:**

- Modify: `lib/goalbar.ts` (rewritten; `CloseMotion`'s three cases do not survive)
- Test: `lib/__tests__/goalbar.test.ts`

**Interfaces:**

- Produces:

  ```ts
  /**
   * The bar as one number: the integer part is the tier reached, the fraction
   * is progress through it. Null when there is no bar to draw.
   */
  export function barProgress(
    walkedMinutes: number,
    goalMinutes: number | null,
  ): number | null;

  export type BarState = { tier: 0 | 1 | 2; fill: number };

  /** Any point of that scale as something to draw: a ground and a 0–100 fill. */
  export function barStateAt(progress: number): BarState;

  export type CloseMotion =
    { kind: "none" } | { kind: "fill"; from: number; to: number };

  /**
   * `recordedBefore` is the total *before* this walk closed — the value the
   * component already holds while the reload is in flight. The minutes are
   * added to it, never subtracted from a total that may or may not include
   * them yet.
   */
  export function closeMotion(input: {
    recordedBefore: number;
    closedMinutes: number;
    goalMinutes: number | null;
  }): CloseMotion;
  ```

- [x] **Step 1: Write the failing tests**

```ts
describe("barProgress", () => {
  it("is the fraction of the goal below it", () => {
    expect(barProgress(60, 120)).toBeCloseTo(0.5);
  });
  it("is exactly 1 at the goal", () => {
    expect(barProgress(120, 120)).toBe(1);
  });
  it("counts the second lap as the fraction past the goal", () => {
    expect(barProgress(180, 120)).toBeCloseTo(1.5);
  });
  it("stops at 2 — a day past double cannot be shown further", () => {
    expect(barProgress(600, 120)).toBe(2);
  });
  it("has no bar without a goal", () => {
    expect(barProgress(60, null)).toBeNull();
    expect(barProgress(60, 0)).toBeNull();
  });
});

describe("barStateAt", () => {
  it("reads a ground and a fill", () => {
    expect(barStateAt(0.5)).toEqual({ tier: 0, fill: 50 });
    expect(barStateAt(1.25)).toEqual({ tier: 1, fill: 25 });
  });
  it("puts an exact tier at the foot of its own lap, not the head of the last", () => {
    expect(barStateAt(1)).toEqual({ tier: 1, fill: 0 });
  });
  it("fills the top tier rather than starting a third lap", () => {
    expect(barStateAt(2)).toEqual({ tier: 2, fill: 100 });
  });
});

describe("closeMotion", () => {
  it("fills from where the saved minutes stopped to where they now stop", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 30, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.5, to: 0.75 });
  });
  it("crosses a tier inside one fill", () => {
    const m = closeMotion({
      recordedBefore: 90,
      closedMinutes: 60,
      goalMinutes: 120,
    });
    expect(m).toEqual({ kind: "fill", from: 0.75, to: 1.25 });
  });
  it("crosses both tiers inside one fill", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 240, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.5, to: 2 });
  });
  it("says nothing on a day already past the top tier", () => {
    expect(
      closeMotion({ recordedBefore: 300, closedMinutes: 40, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
  it("says nothing without a goal, and nothing for a walk that added nothing", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 30, goalMinutes: null }),
    ).toEqual({ kind: "none" });
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 0, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
});
```

- [x] **Step 2: Run to verify they fail**

Run: `npx jest lib/__tests__/goalbar.test.ts`
Expected: FAIL — `barProgress` is not exported.

- [x] **Step 3: Implement the three in `lib/goalbar.ts`**

Keep the module's block comment and rewrite it for the new contract: say that the scale is one number so a tier crossing needs no special case, and say — because it is the defect this inverts — that `recordedBefore` is the pre-close total and the minutes are _added_, where the previous contract subtracted from a total that might already contain them.

- [x] **Step 4: Run to verify they pass**

Run: `npx jest lib/__tests__/goalbar.test.ts`
Expected: PASS, 14 tests.

- [x] **Step 5: Commit**

```bash
git add lib/goalbar.ts lib/__tests__/goalbar.test.ts
git commit -m "feat(goal-bar): one scale for both tiers, and a close that adds instead of subtracting"
```

---

### Task 2: The bar paints the tier it reached

**Files:**

- Modify: `components/ui/GoalBlock.tsx`
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: `barProgress`, `barStateAt`, `BarState` from Task 1.
- Produces: nothing new on `GoalBlock`'s props. Tier 2 is derived inside from `goalMinutes`.

**The rule:** the ground is the tier reached, the fill is progress toward the next.

| state          | ground                      | fill          |
| -------------- | --------------------------- | ------------- |
| below Tier 1   | the empty track             | Mist          |
| Tier 1 reached | the whole bar Aqua          | Aurora Boreal |
| Tier 2 reached | the whole bar Aurora Boreal | —             |

Within the current lap the saved minutes stay a tone above the ones accumulating, with the tick between them, exactly as now. Lap two's pair is `accentFocus` and a live tone a step below it; add that one colour to `tokens.ts` and `global.css` beside its siblings. `met` keeps its meaning — the recorded minutes alone cover Tier 1 — and gains `metX2` for the top.

- [ ] **Step 1: Write the failing tests**

```ts
test("turns Aqua at the goal and starts the second lap over it", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  const { earlier } = tickMoments();
  test.skip(earlier === null, "the first minutes of the day have no room");

  await resetE2EPets();
  const petId = await seedE2EPet({ exercise_goal_minutes: 120 });
  await seedE2EEvents(petId, [
    { kind: "walk", occurredAt: earlier!, durationMinutes: 180 },
  ]);
  await seedSession(page);
  await page.goto("/");

  // 180 of 120 is lap two, half way: the ground is Aqua and the fill violet.
  await expect(page.getByTestId("home-goal-measure")).toContainText("de 4h");
  const ground = await groundColour(page);
  const fill = await fillColour(page);
  expect(ground).toBe(colors.accent);
  expect(fill).toBe(colors.accentFocus);
});

test("a day exactly at the goal is Aqua with no second lap showing", async ({
  page,
}) => {
  // 120 of 120: the whole bar Aqua, the violet fill zero-width.
  // Asserts the column the artboard settled: Aqua is still the signal for met.
});

test("a day past double is violet throughout", async ({ page }) => {
  // 260 of 120: ground violet, no further fill.
});

test("re-reads every tier when the goal is edited under a running walk", async ({
  page,
}) => {
  // Review Focus 3. Seed 150 recorded against a 120 goal (lap two), start a
  // walk, change the goal to 300 in Perfil, come back: the bar is lap one at
  // half, the measure says "de 10h", and nothing is left painted violet.
});

test("draws no bar at all for a pet with no goal, as before", async ({
  page,
}) => {
  // The constraint that a tutor without a goal keeps today's behaviour
  // exactly. Seed a pet with exercise_goal_minutes null and walks logged:
  // no bar on the day view, no underline in the calendar, and the measure
  // says what it says today. This is the regression the tiers could
  // silently break, since every new branch keys off a goal that is there.
});
```

`groundColour` and `fillColour` are helpers in this file's style, reading `getComputedStyle` off the bar's own testIDs; give the ground and the fill distinct testIDs so they can be read apart.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/home.spec.ts -g "second lap|exactly at the goal|past double|goal is edited"`
Expected: FAIL — the bar has one tone.

- [ ] **Step 3: Implement the ground-and-fill rendering in `GoalBlock`**

The measure's denominator becomes the top tier. `"Objetivo conseguido"` stays where it is and `"Objetivo conseguido x2"` joins it at the top tier.

- [ ] **Step 4: Run them, and the existing bar specs with them**

Run: `npx playwright test e2e/home.spec.ts -g "second lap|exactly at the goal|past double|goal is edited|goal|tick|sweep"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/GoalBlock.tsx components/ui/tokens.ts global.css e2e/home.spec.ts
git commit -m "feat(goal-bar): the ground is the tier reached, the fill is the way to the next"
```

---

### Task 3: The close fills from the tick

**Files:**

- Modify: `components/ui/GoalBlock.tsx` (the close replaces the swell and the sheen)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: `closeMotion` from Task 1; the ground/fill rendering from Task 2.
- Produces: `justClosed` changes shape — see Task 4's Interfaces, which owns the prop.

**What it does.** One interpolation from `motion.from` to `motion.to` on Task 1's scale, over `CLOSE_MS`. Along the way:

- The **live segment is held painted** and the fill converts it left to right. It does not grow into empty track: a fill that started at the junction would open on the frame the tutor's video shows as _"the bar has lost the walk"_, and the whole point is that that frame stops existing.
- The **tick rides the fill's leading edge**, because during the conversion that edge _is_ the saved/live boundary. Its existing predicate still governs it, which is what makes a tier crossing need no special case: the new lap has nothing saved, so no tick, and it reappears as the fill advances.
- **Crossing a tier** turns the ground and restarts the fill at zero, inside the same animation. The confetti fires **once**, at the first crossing of Tier 1 and nowhere else.
- The **swell and the sheen go**, with their constants.

The live segment's right edge is **not** the fill's end — `running` is refreshed every `TICK_MS` while the end is `recordedBefore + closedMinutes` — so the fill travels to the true end, past or short of where the segment was painted.

- [ ] **Step 1: Write the failing tests**

Polled with `waitForFunction` at `raf`, the way `shakeTranslation` already does in this file; the settled state is asserted separately.

```ts
test("fills from the tick without the bar ever shrinking", async ({ page }) => {
  // The defect this whole task replaces, and the one assertion that pins it.
  // Poll the painted width at `raf` from the moment of the stop until the
  // bar settles, keep the running minimum, and assert it never falls below
  // the width at the stop:
  //
  //   expect(minWidth).toBeGreaterThanOrEqual(widthAtStop - 0.5);
  //
  // Measured against today's build this drops from 403 px to 207 for about
  // 400 ms, so the spec goes red on HEAD before a line is written — run it
  // there first and report that run.
});

test("crosses the goal inside one fill, with one confetti", async ({
  page,
}) => {
  // Seed just under the goal, run a walk that crosses it, stop: the ground
  // becomes Aqua, the violet fill ends above zero, and the celebration
  // fires exactly once.
});

test("crosses both tiers in one close and still celebrates once", async ({
  page,
}) => {
  // Review Focus 1.
});

test("says nothing when the day is already past the top tier", async ({
  page,
}) => {
  // Review Focus 5: no overlay mounts and the bar does not flicker —
  // sample the ground's colour across the close and assert it never changes.
});

test("paints the end state at once for a tutor who asked for no animation", async ({
  page,
}) => {
  // Review Focus 4. With reducedMotion, a tier-crossing close leaves the
  // right GROUND as well as the right width, with no overlay ever mounted.
});
```

Each must be verified red by disabling what it covers, and the red run reported.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/home.spec.ts -g "fills from the tick|crosses the goal inside|crosses both tiers|already past the top|paints the end state"`
Expected: FAIL.

- [ ] **Step 3: Implement the fill**

- [ ] **Step 4: Run the close specs and the bar specs**

Run: `npx playwright test e2e/home.spec.ts -g "close|fill|tick|goal|sweep|lap"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/GoalBlock.tsx e2e/home.spec.ts
git commit -m "feat(goal-bar): a close that fills from the tick instead of stumbling and swelling"
```

---

### Task 4: The day view hands over the close without waiting

**Files:**

- Modify: `app/(tabs)/index.tsx`
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Produces:
  ```ts
  /**
   * The walk just closed. `recordedBefore` is the total at the moment the
   * server accepted, which is what makes the fill computable before the
   * reload lands.
   */
  justClosed?: { id: string; minutes: number; recordedBefore: number } | null;
  ```

**`stop` stays purely additive.** It has rewritten a real walk's start twice in this project's history; both previous rounds were held to "no existing line moved" and verified line by line. Hold to it.

The `fresh` gate goes: the fill no longer waits for the reload. What replaces it is the handover, and it has **two halves** —

- **Width.** When the reload lands, the fill must already be painted where the data is about to say. Slower reload: nothing moves on arrival. Faster: the fill does not restart.
- **Tone.** When it lands mid-animation, `met` flips and the ground turns _before_ the fill has arrived there. Today `fresh` makes this impossible. A builder who fixes only the width ships a bar that changes colour a quarter of a second early.

**No frame may show the bar in two minds, in width or in tone.**

- [ ] **Step 1: Write the failing test**

```ts
test("holds the fill when the reload never comes", async ({ page }) => {
  // Review Focus 2. Let the close succeed, then abort the reload's reads:
  // the bar holds at the fill's end state and does not snap back to the
  // pre-close width. The failure is the toast's job, not the bar's.
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "reload never comes"`
Expected: FAIL.

- [ ] **Step 3: Carry `recordedBefore` out of `stop` and drop the gate**

- [ ] **Step 4: Run the close and walk specs**

Run: `npx playwright test e2e/home.spec.ts -g "reload never comes|close|fill|starts a walk|stop"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(goal-bar): hand the close its own numbers so it need not wait for the reload"
```

---

### Task 5: The calendar marks the top tier

**Files:**

- Modify: `components/ui/MonthCalendar.tsx` and its legend
- Test: `e2e/home.spec.ts`

The day's bar under the number is the day view's bar in miniature and must stay so: **Aqua for Tier 1, Aurora Boreal for Tier 2.** That is The Shared Mark Rule — one record, one colour, wherever it appears — and it is why the tutor's choice of violet on both surfaces is the right one.

The legend gains a fourth entry in a row that already wraps at a large font scale; check it at `font_scale` 1.45, which is where the tutor runs their phone's maximum.

- [ ] **Step 1: Write the failing test**

```ts
test("marks a double day in the accent and an ordinary one in Aqua", async ({
  page,
}) => {
  // Two seeded days in one month, one at 130 and one at 260 against a 120
  // goal; read both cells' bar colours and the legend's fourth entry.
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "marks a double day"`
Expected: FAIL.

- [ ] **Step 3: Implement the mark and the legend entry**

- [ ] **Step 4: Run the calendar specs**

Run: `npx playwright test e2e/home.spec.ts -g "calendar|marks a double day|birthday"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/MonthCalendar.tsx e2e/home.spec.ts
git commit -m "feat(calendar): a day that doubled the goal wears the accent"
```

---

### Task 6: A failed action does not take the diary away

**Files:**

- Modify: `app/(tabs)/index.tsx`
- Test: `e2e/home.spec.ts`

Recorded in `PRODUCT.md` under **Decided, Not Yet Built**, found on the device in airplane mode: pressing the walk control raises the toast and shakes the control correctly, and about seven seconds later the whole screen becomes the connection error. The error branch bumps `attempt`, the refetch includes the pet read, and offline that fails too.

**The tutor's rule: a failed _action_ is not a failed _navigation_.** The wide fix, which is the one they chose: **`petError` takes the screen only when there is nothing already showing.** Not the narrow one (stop bumping `attempt` from the error branches) — the wide one covers every future caller rather than the two that exist.

The e2e suite cannot see this today because it aborts only the write route, so the pet read survives and the screen never falls over. **The new test must cut every route**, not one.

- [ ] **Step 1: Write the failing test**

```ts
test("keeps the diary on screen when a walk cannot be saved offline", async ({
  page,
}) => {
  // Load the day, then abort every Supabase route, then press the control:
  // the toast appears, the control shakes, and the day's entries are still
  // on screen several seconds later. Cutting only the write route is what
  // made the old suite miss this.
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "cannot be saved offline"`
Expected: FAIL — the error view replaces the diary.

- [ ] **Step 3: Gate `petError` on having nothing to show**

- [ ] **Step 4: Run it with the error-path specs**

Run: `npx playwright test e2e/home.spec.ts -g "cannot be saved offline|error|Reintentar|shake"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "fix(home): a failed action keeps the diary that was already loaded"
```

---

### Task 7: The diary's times line up

**Files:**

- Modify: `app/(tabs)/index.tsx` (the entry row's time column)
- Test: `e2e/home.spec.ts`

Measured on the device at the tutor's own font scale: the three entry titles start at x=288, 280 and 280 — a spread of 2.5 dp, which becomes about 15 dp at 170%. The time column is sized to its content and the comment beside it justifies that with _"24-hour times are all five characters"_. Five characters, not five widths: Outfit's digits are proportional, so `09:40` — which has no narrow `1` — is the widest of the three and pushes its title right.

The fix is `fontVariant: ["tabular-nums"]` on the time's `Text`, which makes the comment's premise true. A fixed width in dp is the wrong fix: at 170% it would clip the time.

**Verify on the device**, not only in the browser: if Outfit ships no `tnum` table the prop changes nothing, and that cannot be seen from the web target.

- [ ] **Step 1: Write the failing test**

```ts
test("starts every entry's title at the same place whatever the hour", async ({
  page,
}) => {
  // Seed three entries at 09:40, 10:20 and 13:51 and assert the three
  // titles' bounding boxes share an x within half a pixel.
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "same place whatever the hour"`
Expected: FAIL — the three differ.

- [ ] **Step 3: Set the figures tabular, and correct the comment's premise**

- [ ] **Step 4: Run it**

Run: `npx playwright test e2e/home.spec.ts -g "same place whatever the hour|log|entry"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "fix(home): tabular figures, so the log's titles share an edge"
```

---

### Task 8: Ship it

**Files:**

- Modify: `package.json`, `CHANGELOG.md`, `DESIGN.md`, `PRODUCT.md`, `README.md` if the maintenance table says so

- [ ] **Step 1: Bump to `0.15.0` and write the entry**

One version for the branch, carrying both rounds of motion and everything here. The voice of the other entries: what changed and why the old thing was wrong, with the measurements. The ones that belong: the band over the recorded fill lifting the channel by 20 where the dark track got 123; the bar shrinking for 400 ms before the old close; 09:40 being the widest of three five-character times.

- [ ] **Step 2: Record the rules in `DESIGN.md`**

The ground is the tier reached and the fill is the way to the next; Aqua stays "met" and the accent is the top tier on both surfaces, which is The Shared Mark Rule and not an exception to the Scarce Accent Rule — **and note that violet on this bar was tried and rejected once before, for the everyday met state at eighteen days a month, which is why the frequency is the whole argument.**

- [ ] **Step 3: Move the two entries out of `PRODUCT.md`'s Decided, Not Yet Built**

The goal bar's animations and the failed-action rule. That section's own rule: an item leaves when it ships and the changelog entry is the exit.

- [ ] **Step 4: Verify everything**

Run: `pnpm lint && pnpm test && pnpm test:e2e`, then `npx expo prebuild -p android && pnpm android:apk`. Without the prebuild `android/app/build.gradle` keeps the last version name and the APK lies about which build it is.

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md DESIGN.md PRODUCT.md lib/changelog.generated.ts
git commit -m "chore(release): v0.15.0"
```

**Not finished at a keyboard.** Every visual decision here was settled on an artboard and must be confirmed on the phone: the ground and fill of each tier, the violet against the Aqua at full saturation, the close crossing a tier, the tick travelling and reappearing, and the tabular figures — which may do nothing at all if the typeface has no `tnum`.
