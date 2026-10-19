# Goal Bar Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The goal bar says a walk is running while it runs, and says what was saved when it stops.

**Architecture:** Three independent pieces inside `components/ui/GoalBlock.tsx`. The tick's predicate gains one term. A looping sweep is a new sibling inside the track, its gradient drawn with `react-native-svg` and translated by Reanimated. The close is a one-shot whose three colour cases are decided by a pure function in `lib/`, driven by a `justClosed` prop the day view sets on a successful `closeWalk`.

**Tech Stack:** Expo SDK 57, React Native 0.86, `react-native-reanimated` 4.5.1, `react-native-svg` 15.15.4, NativeWind 5. No new dependency — `expo-linear-gradient` is deliberately not added, because a native module would force a recompile and a reinstall on both household phones.

**Spec:** `PRODUCT.md`, section **Decided, Not Yet Built** (commits `9f00efd`, `2ab070f`). Background on the bar's two tones and the measurements behind them: `DESIGN.md`, and `docs/specs/2026-10-15-walk-timer-design.md`.

## Global Constraints

- Read `AGENTS.md` first. Its platform gotchas are measured facts, not advice.
- **Every animation is absent under `useReducedMotion()`**, not slowed. `PulseDot` in the same file is the house pattern: guard the effect, and render nothing animated. This is a Brand Commitment in `PRODUCT.md`.
- **No raw hex.** Colours a React Native prop or an SVG prop needs come from `components/ui/tokens.ts`; anything a `className` can reach comes from `global.css`'s `@theme`.
- **No callback `style` on a `Pressable`.** `components/__tests__/function-styles.test.ts` fails on `style={(`.
- **Sizes in literal pixels**: `h-[4px]`, not `h-1`. `1rem` resolves to 14 on native.
- Template-literal class strings keep the separator outside the quotes.
- TypeScript strict, no `any`. Conventional Commits, imperative, lowercase, no trailing period.
- `pnpm lint`, `pnpm test` and `pnpm test:e2e` all pass. The e2e suite's dev server dies on long runs — a mass failure whose first error is `ERR_CONNECTION_REFUSED` means `pkill -f "expo start"` and run again, not a regression.
- Existing vocabulary, unchanged: `walkedMinutes` excludes the running walk; `met` therefore already means "the recorded minutes alone cover the goal", which is why it is the right term for "the goal was met before this walk began".

## Review Focus

Six conditions the spec implies and no task's happy path reaches. Each one's test is added to the task that owns the code.

1. **`goalMinutes` null or 0 at the moment of a close.** There is no bar, so there is nothing to animate; nothing may divide by it. → Task 1.
2. **A closed walk longer than what was left of the goal.** The stretch must stop at the bar's right edge rather than run past it. → Task 1.
3. **Reduced motion.** Neither animation may exist — not a faster one. The sweep must not render and the close must arrive at its final tone and thickness from props alone. Playwright reaches this with `page.emulateMedia({ reducedMotion: "reduce" })`, which `react-native-web` resolves into the same `useReducedMotion()` the device reads. → Tasks 3 and 4.
4. **The day changes while a close is still pending.** Yesterday's walk must not animate today's bar. → Task 4.
5. **Two walks closed in succession at the same length.** The second must replay; a value-equality check would swallow it. → Task 4.
6. **A stop the server refuses.** No animation of any kind, the walk still running, the control back from its spinner and still pressable. → Task 5.

---

### Task 1: The close's three cases, decided in `lib/`

A wrong colour here does not throw — it tells the tutor the goal was reached when it was not. That is this project's stated reason for pulling logic out of a component.

**Files:**

- Create: `lib/goalbar.ts`
- Test: `lib/__tests__/goalbar.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export type CloseMotion =
    | { kind: "none" }
    | { kind: "swell" }
    | { kind: "land"; stretch: { start: number; end: number }; met: boolean };

  export function closeMotion(input: {
    walkedMinutes: number; // already includes the walk just closed
    closedMinutes: number;
    goalMinutes: number | null;
  }): CloseMotion;
  ```

  `start` and `end` are percentages of the bar, `0`–`100`. `met` says the bar lands Aqua, which is also the signal that the stretch before `start` has to travel from the recorded grey rather than staying put.

- [ ] **Step 1: Write the failing tests**

```ts
describe("closeMotion", () => {
  it("lands the stretch the walk just added", () => {
    expect(
      closeMotion({ walkedMinutes: 60, closedMinutes: 20, goalMinutes: 180 }),
    ).toEqual({
      kind: "land",
      stretch: { start: (40 / 180) * 100, end: (60 / 180) * 100 },
      met: false,
    });
  });

  it("says the bar lands Aqua when the walk reached the goal", () => {
    const motion = closeMotion({
      walkedMinutes: 185,
      closedMinutes: 30,
      goalMinutes: 180,
    });
    expect(motion).toMatchObject({ kind: "land", met: true });
  });

  it("stops the stretch at the bar's edge rather than past it", () => {
    const motion = closeMotion({
      walkedMinutes: 300,
      closedMinutes: 200,
      goalMinutes: 180,
    });
    expect(motion).toEqual({
      kind: "land",
      stretch: { start: (100 / 180) * 100, end: 100 },
      met: true,
    });
  });

  it("keeps the swell and drops the rest when the goal was already met", () => {
    // 200 recorded before this walk, against a 180 goal: the bar was full and
    // Aqua when it started, and the minutes it added cannot be shown.
    expect(
      closeMotion({ walkedMinutes: 230, closedMinutes: 30, goalMinutes: 180 }),
    ).toEqual({ kind: "swell" });
  });

  it("does nothing without a bar to animate", () => {
    expect(
      closeMotion({ walkedMinutes: 30, closedMinutes: 30, goalMinutes: null }),
    ).toEqual({ kind: "none" });
    expect(
      closeMotion({ walkedMinutes: 30, closedMinutes: 30, goalMinutes: 0 }),
    ).toEqual({ kind: "none" });
  });

  it("does nothing for a walk that added no minutes", () => {
    expect(
      closeMotion({ walkedMinutes: 60, closedMinutes: 0, goalMinutes: 180 }),
    ).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest lib/__tests__/goalbar.test.ts`
Expected: FAIL, `closeMotion` is not exported.

- [ ] **Step 3: Implement `closeMotion` in `lib/goalbar.ts`**

`start` is derived from `walkedMinutes - closedMinutes` and both ends are clamped to `0`–`100`. `swell` is the case where that difference alone already covers the goal. The module comment carries the sentence the animation speaks — "this much has just been saved" — and why a full bar has no _this much_ to point at.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest lib/__tests__/goalbar.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/goalbar.ts lib/__tests__/goalbar.test.ts
git commit -m "feat(goal-bar): decide a close's three cases in lib, where they can be tested"
```

---

### Task 2: The tick loses its one wrong case

**Files:**

- Modify: `components/ui/GoalBlock.tsx` (the `walkingSince && !met` condition and the comment above it)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. The predicate is internal.

- [ ] **Step 1: Write the failing test**

Added beside the existing tick specs, in their style — the day is reached with `‹` where a fixed morning time is needed, per this file's own rule.

```ts
test("draws no tick on the first walk of the day, where nothing is recorded yet", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  // Nothing recorded, so there is no junction: the line would sit on the
  // bar's left edge, 1 dp outside the track, separating nothing from the
  // walk in progress.
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-walk").click();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-tick")).toBeHidden();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "first walk of the day"`
Expected: FAIL — the tick is visible.

- [ ] **Step 3: Add `recorded > 0` to the condition**

Replace the overhang paragraph written at `GoalBlock.tsx` with the reason it is gone: nothing recorded is nothing to separate, and that was the only position where the tick left the track.

- [ ] **Step 4: Run the tick specs**

Run: `npx playwright test e2e/home.spec.ts -g "tick|junction|first walk"`
Expected: PASS, including the three that already exist.

- [ ] **Step 5: Commit**

```bash
git add components/ui/GoalBlock.tsx e2e/home.spec.ts
git commit -m "fix(goal-bar): draw no tick on the first walk, where there is no junction"
```

---

### Task 3: The sweep, while a walk runs

**Files:**

- Modify: `components/ui/GoalBlock.tsx` (new `Sweep` component beside `PulseDot`, rendered inside the track)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `function Sweep({ met, testID }: { met: boolean; testID?: string })`, absolutely positioned, filling its parent. Rendered only while `walkingSince` is set; `met` picks the band's tone.

- [ ] **Step 1: Write the failing tests**

```ts
test("sweeps the bar while a walk runs, and only then", async ({ page }) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  await expect(page.getByTestId("home-goal-sweep")).toBeHidden();
  await page.getByTestId("home-goal-walk").click();
  await expect(page.getByTestId("home-goal-sweep")).toBeVisible();
});

test("sweeps nothing for a tutor who asked for no animation", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-walk").click();
  // The walk is running — the dot proves the state is real — and the band
  // is absent rather than slow.
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-sweep")).toBeHidden();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "sweeps the bar"`
Expected: FAIL — no such testID.

- [ ] **Step 3: Implement `Sweep`**

The band is `SWEEP_WIDTH = 70` dp of `react-native-svg`: a `Rect` filled by a `LinearGradient` running transparent → tone → transparent. The tone is `colors.textPrimary` at `0.55` over the dark track, `colors.onAccent` at `0.35` when `met`, because the band is always the opposite tone to the ground it crosses. Reanimated translates it from `-SWEEP_WIDTH` to the track's width, `SWEEP_MS = 2400`, `Easing.linear`, `withRepeat(..., -1)`; the track's width comes from `onLayout` on `Sweep` itself rather than a percentage transform. Guarded by `useReducedMotion()` exactly as `PulseDot` is, and hidden from a reader the same way — the measure already says "De paseo".

The comment above it carries why the band crosses the whole track rather than the in-progress segment: that segment is 3.6 dp at two minutes, and the same hole opens from the other end when a walk starts a minute short of the goal. And the cost accepted: this is the idiom for _indeterminate_ progress, on a bar that knows exactly where it is.

- [ ] **Step 4: Run the walk specs**

Run: `npx playwright test e2e/home.spec.ts -g "sweeps the bar|starts a walk"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/GoalBlock.tsx e2e/home.spec.ts
git commit -m "feat(goal-bar): a sweep across the track while a walk is running"
```

---

### Task 4: The close, in four beats

**Files:**

- Modify: `components/ui/GoalBlock.tsx` (new `justClosed` prop, the swell, the sheen, the landing overlay)
- Modify: `app/(tabs)/index.tsx` (set `justClosed` on a successful `closeWalk`; clear it when the day changes)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: `closeMotion` from Task 1.
- Produces: a new optional prop on `GoalBlock`:

  ```ts
  /**
   * The walk just closed, or null. The id is what makes it fire once: two
   * walks of the same length are a different animation, and a value check
   * would swallow the second.
   */
  justClosed?: { id: string; minutes: number } | null;
  ```

- [ ] **Step 1: Write the failing tests**

Three, covering the happy path and two of the Review Focus conditions. Each asserts the settled end state rather than a frame, because Playwright cannot be made to wait on a running animation safely in this project — `page.clock` is measured not to work here.

```ts
test("lands a closed walk in the recorded tone, and clears the live segment", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-walk").click();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await page.getByTestId("home-goal-walk").click();
  await expect(page.getByTestId("home-goal-dot")).toBeHidden();
  await expect(page.getByTestId("home-goal-close")).toBeHidden();
  await expect(page.getByTestId("home-goal-tick")).toBeHidden();
});

test("does not animate a close onto a day that is not the walk's", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-walk").click();
  await page.getByTestId("home-goal-walk").click();
  await page.getByTestId("day-prev").click();
  await expect(page.getByTestId("home-goal-close")).toBeHidden();
});
```

And a unit test for the replay rule, where it can be asserted without a frame — the day view's state, not the animation:

```ts
// e2e: two walks closed in succession both leave the bar settled, which is
// the observable half of "the second one replayed".
test("settles twice when two walks are closed in succession", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  for (const _ of [0, 1]) {
    await page.getByTestId("home-goal-walk").click();
    await expect(page.getByTestId("home-goal-dot")).toBeVisible();
    await page.getByTestId("home-goal-walk").click();
    await expect(page.getByTestId("home-goal-dot")).toBeHidden();
  }
  await expect(page.getByTestId("home-goal-close")).toBeHidden();
});

test("lands a close with no animation at all for a tutor who asked for none", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-walk").click();
  await page.getByTestId("home-goal-walk").click();
  // No overlay is ever mounted, and the bar is still right: the tone and
  // the thickness come from props, which is what makes "absent" true rather
  // than "too quick to catch".
  await expect(page.getByTestId("home-goal-close")).toBeHidden();
  await expect(page.getByTestId("home-goal-bar")).toBeVisible();
  await expect(page.getByTestId("home-goal-dot")).toBeHidden();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/home.spec.ts -g "lands a closed walk|not the walk's|in succession"`
Expected: FAIL — no `home-goal-close` testID.

- [ ] **Step 3: Set `justClosed` in the day view**

In `stop`, after the `if (error) return` guard — the only point where the server has said yes. The minutes are `1` for a touched discard, `outcome.minutes` for a close, and nothing at all for an abandon or a delete, which add no minutes and must not fire. Clear it in the effect that already reacts to the displayed day changing, so a close never animates another day's bar.

- [ ] **Step 4: Implement the four beats in `GoalBlock`**

A `useEffect` keyed on `justClosed?.id`, holding the last id it played in a ref so a repeat of the same length fires and a re-render does not. Under `useReducedMotion()` it returns before starting anything, and no overlay renders: the bar is already at its destination tone and thickness from props alone, which is what makes "absent, not fast" true here rather than aspirational.

- `CLOSE_MS = 760`, with the beats at the proportions the board settled: swell by 120 ms, sheen crossing to 400, landed by 760.
- **Swell** is `scaleY` 1 → 1.75 → 1 on the track itself, never on the wrapper — the tick is the wrapper's other child and would scale with it.
- **Sheen** is the Task 3 gradient at `colors.textPrimary`, inside a view clipped to `stretch`, crossing once.
- **Landing** is an overlay over `stretch` animating `colors.textTertiary` → the destination, which is `colors.accent` when `motion.met` and `colors.textSecondary` otherwise. When `motion.met`, a second overlay covers `0` → `stretch.start` and travels `colors.textSecondary` → `colors.accent`, because reaching the goal turns the whole bar Aqua and not only the new stretch. Both are removed when the animation ends; the fill underneath already holds the destination tone, so there is no frame where it jumps.
- `kind: "swell"` runs the swell alone, in Aqua, with no sheen and no overlay.
- `testID`-`close` marks the overlay, so its absence is the settled state.

- [ ] **Step 5: Run the close specs, then the whole home file**

Run: `npx playwright test e2e/home.spec.ts`
Expected: PASS. A bulk failure whose first error is `ERR_CONNECTION_REFUSED` is the dev server, not this change.

- [ ] **Step 6: Commit**

```bash
git add components/ui/GoalBlock.tsx "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(goal-bar): say what was saved when a walk stops, in four beats"
```

---

### Task 5: The failure shakes the control that failed

The success path says where the minutes went. The failure path says it in a
toast at the top of the screen, which names what went wrong and not _where_.
The control that was pressed is the one place the eye already is.

**Files:**

- Modify: `components/ui/GoalBlock.tsx` (a `failed` token prop, the shake)
- Modify: `app/(tabs)/index.tsx` (set it on the error branch of `stop`, and of `start`)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: one more optional prop on `GoalBlock`:
  ```ts
  /**
   * Bumped each time a start or a stop came back with an error. A counter
   * rather than a boolean, for the reason `justClosed` carries an id: two
   * failures in a row are two shakes.
   */
  failed?: number;
  ```

**Already true, and not to be rebuilt:** the button returns from its spinner
to STOP on its own — `stop` clears `walkBusy` and `walkInFlight` in a
`finally` — and the error toast is already raised and already persists. This
task adds the shake and nothing else.

- [ ] **Step 1: Write the failing test**

```ts
test("shakes the control and keeps it pressable when a stop cannot be saved", async ({
  page,
}) => {
  test.skip(!ready, "requires 0006_events_weights_treatments.sql");
  await seedSession(page);
  await page.goto("/");
  await page.getByTestId("home-goal-walk").click();
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();

  // The close fails at the transport, which is the one failure a tutor
  // actually meets: a stop pressed where there is no signal.
  await page.route("**/rest/v1/pet_events*", (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.continue(),
  );
  await page.getByTestId("home-goal-walk").click();

  await expect(page.getByTestId("toast")).toBeVisible();
  // The walk is still running and the control is still a stop, because
  // nothing was saved — and no close animation ran.
  await expect(page.getByTestId("home-goal-dot")).toBeVisible();
  await expect(page.getByTestId("home-goal-close")).toBeHidden();
  await expect(page.getByTestId("home-goal-walk")).toBeEnabled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "cannot be saved"`
Expected: FAIL. If it fails only on the enabled/dot assertions, the shake is
still missing and the rest already held — implement step 3 regardless.

- [ ] **Step 3: Implement the shake**

`translateX` over `SHAKE_MS = 400`: three decaying oscillations to ±4 dp and
back to zero, driven from one `withTiming` and a `useAnimatedStyle`, keyed on
`failed` in a `useEffect` the way the close is keyed on `justClosed.id`.
Guarded by `useReducedMotion()` like everything else in this file, and the
control keeps its own `TOUCH_TARGET` height — the shake moves the pill, so
the comment records that ±4 dp was chosen to stay well inside the 48 dp the
thumb is aiming at.

- [ ] **Step 4: Run the walk specs**

Run: `npx playwright test e2e/home.spec.ts -g "cannot be saved|starts a walk|lands a closed walk"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/GoalBlock.tsx "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(goal-bar): shake the control when a walk could not be saved"
```

---

### Task 6: Ship it

**Files:**

- Modify: `package.json`, `CHANGELOG.md`, `DESIGN.md`, `PRODUCT.md`

- [ ] **Step 1: Bump to `0.14.0` and write the entry**

One version for the whole branch, not one per task. The changelog says what changed and why the old thing was wrong, in the voice of the other entries: that the bar could not say a walk was running without the tutor reading the number, and that the most important moment of the dog's day — the walk landing in the record — was the least visible thing the app did.

- [ ] **Step 2: Record the motion rules in `DESIGN.md`**

The sweep's tone is always the opposite of the ground it crosses. The close animates in the tone the bar is about to keep, never a flourish — the first design lit the stretch Aqua and let it fall back to grey, which spends the accent on something that is not a conclusion and contradicts the rule that the bar speaks Mist while read and Aqua as conclusion.

- [ ] **Step 3: Move the two entries out of `PRODUCT.md`'s Decided, Not Yet Built**

That section's own rule: an item leaves when it ships, and the changelog entry is the exit.

- [ ] **Step 4: Verify the whole suite**

Run: `pnpm lint && pnpm test && pnpm test:e2e`
Expected: all three green. Then `npx expo prebuild -p android && pnpm android:apk` — `android/app/build.gradle` keeps the last prebuild's `versionName`, so without it the APK lies about which build it is.

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md DESIGN.md PRODUCT.md lib/changelog.generated.ts
git commit -m "chore(release): v0.14.0"
```

**Not done at a keyboard.** Both animations are motion on a 4 dp bar, and this project's rule is that a change which has to hold on the device is verified on the device, with `adb exec-out screencap -p`. The sweep's visibility against the dark track, and whether 760 ms reads as an answer or as a wait, are both open until somebody walks with it.
