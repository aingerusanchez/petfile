# Walk timer implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tutor start a walk with one tap when they leave the house and close it with one tap when they get home, annotating it mid-walk, without inventing a provisional end time.

**Architecture:** No migration. A walk in progress is an ordinary `pet_events` row with `occurred_at` = the start and `duration_minutes` = `null`; the fact that it is _running_ is the walk's id in AsyncStorage on the tutor's own device. The entry sheet's one unconditional rule — HASTA is required — is lifted into "a walk needs two times, or one time and a length", which is the mirror of the rule `startWithinDay` already encodes and which also makes a walk across midnight saveable for the first time.

**Tech Stack:** Expo SDK 57 / React Native 0.86, Expo Router, NativeWind 5 + Tailwind 4, Supabase (`pet_events`), `@react-native-async-storage/async-storage`, `react-native-reanimated`, Jest, Playwright.

**Spec:** `docs/specs/2026-10-15-walk-timer-design.md`

## Global Constraints

- pnpm only; never run `pnpm install` without `node-linker=hoisted` in place.
- TypeScript strict; **no `any`** in committed code.
- No raw hex in components. Colours a `className` can reach come from `global.css`; colours a React Native prop needs come from `components/ui/tokens.ts`.
- The only accent this feature spends is **Aqua Glaciar** (`accent`). Aurora Boreal (`accent-focus`) does not enter — The Scarce Accent Rule, DESIGN.md.
- The goal bar keeps **Mist** while walking. Aqua on that bar means "goal met" and nothing else.
- Touch targets from `TOUCH_TARGET` in `tokens.ts`, never `min-h-12`.
- A `Pressable` never takes a callback `style`. Plain object for numbers, `active:opacity-70` in the class list.
- `Text` is imported from `components/ui`, never from `react-native`.
- No screen or component imports `@supabase/supabase-js`; all access goes through `lib/`.
- Conventional Commits. **Never** `--no-verify`.
- `package.json` version bump and the `CHANGELOG.md` entry land in the same commit as the feature (Task 7).
- The in-progress flag is never written to Postgres, as a column or as a key in `details`.
- STOP computes from instants (`getTime()`), never by re-reading the text fields.
- e2e needs Node 22+. Tests derive every clock time from a "now" they own; a fixed morning time on today is a test that fails half the day.

## Review Focus

1. **A clock that went backwards.** The October rollback keeps instants monotonic, but a tutor correcting the device clock does not. Closing a walk must never produce a negative duration or delete a real walk. — Task 2.
2. **Exactly sixty seconds.** The boundary between "mis-tap, delete it" and "a one-minute walk" is a boundary, and the displayed counter and the stored minutes must agree on which side a value falls. — Task 2.
3. **Closing a walk that no longer exists**, because the other tutor deleted it from their phone. The stop must not strand the block in a walking state it can never leave. — Tasks 3 and 6.
4. **Closing a walk must not erase what was written during it.** `updateEvent` sends every field including nulls; using it to close a walk would wipe the note and the stool chips added at 09:45. — Task 3.
5. **A walk that is only a start, reopened and saved untouched.** This is both the running walk and every walk that crossed midnight, and today the sheet refuses it. — Task 4.

---

### Task 1: `endWithinDay`

The mirror of `startWithinDay`. A walk's HASTA is a time of day with no date, so an end that falls on the next day has no time of day that means it on the screen's form.

**Files:**

- Modify: `lib/events.ts` (beside `startWithinDay`, around line 264)
- Test: `lib/__tests__/events.test.ts`

**Interfaces:**

- Consumes: `shiftMinutes`, `dayKey` (both already in `lib/events.ts`)
- Produces: `endWithinDay(start: Date, minutes: number): Date | null`

- [ ] **Step 1: Write the failing tests**

Add to `lib/__tests__/events.test.ts`, importing `endWithinDay` alongside the existing imports. `at` is the helper the file already defines.

```ts
describe("endWithinDay", () => {
  it("returns the end when it falls on the start's day", () => {
    const end = endWithinDay(at("2026-09-11T10:00:00"), 45);
    expect(end?.getHours()).toBe(10);
    expect(end?.getMinutes()).toBe(45);
  });

  it("returns null when the end lands on the next day", () => {
    expect(endWithinDay(at("2026-09-11T23:40:00"), 45)).toBeNull();
  });

  it("keeps an end that lands exactly on 23:59", () => {
    const end = endWithinDay(at("2026-09-11T23:14:00"), 45);
    expect(end?.getHours()).toBe(23);
    expect(end?.getMinutes()).toBe(59);
  });

  it("returns null at exactly midnight, which belongs to the next day", () => {
    expect(endWithinDay(at("2026-09-11T23:15:00"), 45)).toBeNull();
  });

  it("returns null for a full day, which always crosses", () => {
    expect(endWithinDay(at("2026-09-11T10:00:00"), 24 * 60)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- events.test.ts`
Expected: FAIL, `endWithinDay is not a function`.

- [ ] **Step 3: Implement it**

In `lib/events.ts`, immediately after `startWithinDay`:

```ts
/**
 * The end `minutes` after `start`, or null when that end is another day.
 *
 * The mirror of `startWithinDay`, and here for the same reason: HASTA is a
 * time of day with no date, so an end computed on the *next* day comes back —
 * when that text is re-parsed against the day on screen — as a clock time
 * *before* its start. A walk from 23:40 to 00:10 has no HASTA the form can
 * hold, and null is the honest answer. The duration carries the walk instead,
 * which is the same answer `startWithinDay` gives in the other direction.
 */
export function endWithinDay(start: Date, minutes: number): Date | null {
  const end = shiftMinutes(start, minutes);
  return dayKey(end) === dayKey(start) ? end : null;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm test -- events.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/events.ts lib/__tests__/events.test.ts
git commit -m "feat(paseo): an end that lands on the next day is not a time of day"
```

---

### Task 2: the walk's rules, in `lib/walk.ts`

Everything the timer decides, as pure functions. In `lib/` for the reason the crop maths and the clock face are: a wrong answer here does not throw, it deletes a walk or stores a duration that disagrees with the number the tutor was just watching.

**Files:**

- Create: `lib/walk.ts`
- Test: `lib/__tests__/walk.test.ts`

**Interfaces:**

- Consumes: `MAX_WALK_MINUTES` from `lib/events.ts`
- Produces: `WALK_STORAGE_KEY`, `parseRunningWalk(raw: string | null): string | null`, `serialiseRunningWalk(id: string): string`, `elapsedMinutes(startedAt: Date, now: Date): number`, `type WalkOutcome`, `walkOutcome(startedAt: Date, now: Date): WalkOutcome`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/walk.test.ts`:

```ts
import {
  elapsedMinutes,
  parseRunningWalk,
  serialiseRunningWalk,
  walkOutcome,
} from "../walk";

const at = (iso: string) => new Date(iso);
const after = (from: Date, ms: number) => new Date(from.getTime() + ms);
const MINUTE = 60_000;

describe("parseRunningWalk", () => {
  it("reads back what it wrote", () => {
    expect(parseRunningWalk(serialiseRunningWalk("walk-1"))).toBe("walk-1");
  });

  it("returns null for nothing stored", () => {
    expect(parseRunningWalk(null)).toBeNull();
  });

  it("returns null for a corrupt blob rather than throwing", () => {
    expect(parseRunningWalk("{not json")).toBeNull();
  });

  it("returns null when the id is not a string", () => {
    expect(parseRunningWalk(JSON.stringify({ id: 7 }))).toBeNull();
  });
});

describe("elapsedMinutes", () => {
  const start = at("2026-10-15T11:02:00");

  it("counts whole minutes only", () => {
    expect(elapsedMinutes(start, after(start, 18 * MINUTE + 59_000))).toBe(18);
  });

  it("never goes negative", () => {
    expect(elapsedMinutes(start, after(start, -5 * MINUTE))).toBe(0);
  });
});

describe("walkOutcome", () => {
  const start = at("2026-10-15T11:02:00");

  it("discards a walk under a minute", () => {
    expect(walkOutcome(start, after(start, 59_000))).toEqual({
      action: "discard",
    });
  });

  it("closes a walk at exactly one minute", () => {
    expect(walkOutcome(start, after(start, MINUTE))).toEqual({
      action: "close",
      minutes: 1,
    });
  });

  it("stores the same number the counter was showing", () => {
    const now = after(start, 29 * MINUTE + 45_000);
    expect(elapsedMinutes(start, now)).toBe(29);
    expect(walkOutcome(start, now)).toEqual({ action: "close", minutes: 29 });
  });

  it("closes a walk that crossed midnight", () => {
    const night = at("2026-10-15T23:40:00");
    expect(walkOutcome(night, at("2026-10-16T00:10:00"))).toEqual({
      action: "close",
      minutes: 30,
    });
  });

  it("abandons a walk past the column's ceiling", () => {
    expect(walkOutcome(start, after(start, 1441 * MINUTE))).toEqual({
      action: "abandon",
    });
  });

  it("abandons rather than discards when the clock went backwards", () => {
    expect(walkOutcome(start, after(start, -MINUTE))).toEqual({
      action: "abandon",
    });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- walk.test.ts`
Expected: FAIL, cannot find module `../walk`.

- [ ] **Step 3: Implement it**

Create `lib/walk.ts`:

```ts
import { MAX_WALK_MINUTES } from "./events";

/**
 * What the app knows about a walk that is still happening.
 *
 * **It lives on the device, and that is the design.** Whether a walk is
 * running is a fact about the app, not about the walk — once it ends, it never
 * mattered — so it belongs where `lib/settings.tsx` already keeps what is the
 * phone's rather than the dog's. No migration, no RLS policy, no round trip
 * before the first frame.
 *
 * **What is stored is the walk's id, not its start.** The start lives in the
 * row, where it is the fact; keeping a second copy here would be a clock the
 * app could contradict itself with.
 *
 * The rules below are here rather than in the screen for the reason the crop
 * maths is: a wrong answer does not throw. It deletes a walk the tutor meant
 * to keep, or stores a length that disagrees with the number they were
 * watching a second earlier.
 */

export const WALK_STORAGE_KEY = "petfile.walk.v1";

/** Reads a stored blob without trusting it: anything unexpected is nothing. */
export function parseRunningWalk(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown };
    return typeof value.id === "string" && value.id.length > 0
      ? value.id
      : null;
  } catch {
    return null;
  }
}

export function serialiseRunningWalk(id: string): string {
  return JSON.stringify({ id });
}

/**
 * Whole minutes since the walk began.
 *
 * **Floored, not rounded, and `walkOutcome` uses this same function.** The
 * block shows this number while the walk runs and the row stores what
 * `walkOutcome` returns; rounding in one place and flooring in the other would
 * put "29 min" on screen and 30 in the row, which is the kind of disagreement
 * nobody reports and everybody notices.
 */
export function elapsedMinutes(startedAt: Date, now: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - startedAt.getTime()) / 60_000),
  );
}

export type WalkOutcome =
  | { action: "discard" }
  | { action: "close"; minutes: number }
  | { action: "abandon" };

/**
 * What to do with a walk that is being stopped, or that was found still open.
 *
 * - `discard`: under a minute. A start and a stop inside the same minute is a
 *   mis-tap, and the honest record of a mis-tap is nothing.
 * - `abandon`: past `MAX_WALK_MINUTES`, which the column refuses anyway, or a
 *   clock that moved backwards. The row keeps its start and no length — an
 *   incomplete record the tutor can fix, rather than an invented 24-hour walk
 *   or a deletion decided by a wrong clock.
 * - `close`: everything else.
 */
export function walkOutcome(startedAt: Date, now: Date): WalkOutcome {
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed < 0) return { action: "abandon" };
  if (elapsed < 60_000) return { action: "discard" };
  const minutes = elapsedMinutes(startedAt, now);
  return minutes > MAX_WALK_MINUTES
    ? { action: "abandon" }
    : { action: "close", minutes };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm test -- walk.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/walk.ts lib/__tests__/walk.test.ts
git commit -m "feat(paseo): the rules a walk in progress follows, where they can be tested"
```

---

### Task 3: `startWalk` and `closeWalk`

Two writes the sheet cannot make. `startWalk` needs the new row's id back, which `logEvent` does not return; `closeWalk` must touch **only** the duration, which `updateEvent` cannot do.

**Files:**

- Modify: `lib/events.ts` (after `updateEvent`)
- Test: `lib/__tests__/events.write.test.ts` (create)

**Interfaces:**

- Consumes: `supabase`, `withTimeout`, `describeFailure` (already imported in `lib/events.ts`)
- Produces: `startWalk(petId: string): Promise<{ id: string | null; error: string | null }>`, `closeWalk(id: string, minutes: number): Promise<{ error: string | null }>`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/events.write.test.ts`. The `jest.mock` factory builds its spies inline, the pattern `pets.rpc.test.ts` records.

```ts
import { closeWalk, startWalk } from "../events";
import { supabase } from "../supabase";

jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as unknown as jest.Mock;

beforeEach(() => mockFrom.mockReset());

describe("startWalk", () => {
  it("inserts a walk with no duration and returns its id", async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: "walk-1" },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    mockFrom.mockReturnValue({ insert });

    const result = await startWalk("pet-1");

    expect(mockFrom).toHaveBeenCalledWith("pet_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pet_id: "pet-1",
        kind: "walk",
        duration_minutes: null,
      }),
    );
    expect(result).toEqual({ id: "walk-1", error: null });
  });

  it("returns a message and no id when the insert fails", async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    mockFrom.mockReturnValue({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single })) })),
    });

    const result = await startWalk("pet-1");

    expect(result.id).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("closeWalk", () => {
  it("writes the duration and nothing else", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    mockFrom.mockReturnValue({ update });

    const result = await closeWalk("walk-1", 30);

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.duration_minutes).toBe(30);
    expect(Object.keys(payload).sort()).toEqual([
      "duration_minutes",
      "updated_at",
    ]);
    expect(eq).toHaveBeenCalledWith("id", "walk-1");
    expect(result).toEqual({ error: null });
  });

  it("reports a failure rather than throwing", async () => {
    mockFrom.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: { message: "gone" } }),
      })),
    });

    const result = await closeWalk("walk-1", 30);

    expect(result.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- events.write.test.ts`
Expected: FAIL, `startWalk is not a function`.

- [ ] **Step 3: Implement them**

In `lib/events.ts`, after `updateEvent`:

```ts
/**
 * Opens a walk: a start, and no length yet.
 *
 * **Not `logEvent`, because the id has to come back.** The device remembers
 * which walk is running, and it can only do that if the insert says which row
 * it made. The rest of the shape is the same row `logEvent` would write.
 *
 * `validateEvent` is not consulted: there is nothing to validate. The start is
 * now, which is never in the future, and there is no duration yet.
 */
export async function startWalk(
  petId: string,
): Promise<{ id: string | null; error: string | null }> {
  const query = supabase
    .from("pet_events")
    .insert({
      pet_id: petId,
      kind: "walk",
      occurred_at: new Date().toISOString(),
      duration_minutes: null,
    })
    .select("id")
    .single();

  try {
    const { data, error } = await withTimeout(query, "startWalk");
    if (error) return { id: null, error: describeFailure(error, "startWalk") };
    return { id: data?.id ?? null, error: null };
  } catch (cause) {
    return { id: null, error: describeFailure(cause, "startWalk") };
  }
}

/**
 * Closes a walk by giving it its length.
 *
 * **Only the duration, which is why this is not `updateEvent`.** That function
 * sends every field the sheet can ask for, nulls included, on purpose — a
 * tutor clearing a field means the field is empty. Closing a walk is not that:
 * the note and the stool chips written at 09:45 are exactly what a walk in
 * progress is for, and a full update would wipe them on the way home.
 */
export async function closeWalk(
  id: string,
  minutes: number,
): Promise<{ error: string | null }> {
  const query = supabase
    .from("pet_events")
    .update({
      duration_minutes: minutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  try {
    const { error } = await withTimeout(query, "closeWalk");
    return { error: error ? describeFailure(error, "closeWalk") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "closeWalk") };
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm test -- events.write.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/events.ts lib/__tests__/events.write.test.ts
git commit -m "feat(paseo): open a walk and close it without rewriting the rest of it"
```

---

### Task 4: a walk may be a start and a length

Lift HASTA's unconditional requirement in the entry sheet, so a walk that crossed midnight — and the walk in progress, which is the same shape — can be opened and saved.

**Files:**

- Modify: `app/(tabs)/index.tsx` — `EntrySheet` (the `at` initialiser and `opened` around lines 960–1000, `applyMinutes` and `editDuration` around 1133–1176, `save` around 1202–1270)
- Test: `e2e/home.spec.ts` (Task 7 adds the end-to-end case; the unit coverage is Task 1's `endWithinDay`)

**Interfaces:**

- Consumes: `endWithinDay` (Task 1)
- Produces: `EntrySheet` gains a prop `timeMeans?: "start" | "end"`, default `"end"`

- [ ] **Step 1: Add the prop and the start-aware initialisers**

In `EntrySheet`'s props type add:

```ts
  /**
   * What a walk's lone `occurred_at` means when there is no duration.
   *
   * **Default `"end"`, which is what every stored row meant before the
   * timer.** "I got back at 20:15 and did not write a length" is the fastest
   * valid entry there is, and the sheet has always read it that way. A walk in
   * progress has exactly the same shape and the opposite meaning, so the day
   * view — which is the only thing that knows — says so.
   */
  timeMeans?: "start" | "end";
```

Replace the `at` and `from` initialisers, and the matching fields in `opened`, with these. All four read from one helper so the sheet and its dirty check cannot disagree:

```ts
// One source for the three places that need it: `at`, `from`, and `opened`.
const [initial] = useState(() => {
  const now = new Date();
  if (!occurred) return { at: formatTimeOfDay(now), from: "" };
  if (storedMinutes) {
    const end = endWithinDay(occurred, storedMinutes);
    // A walk that crossed midnight has no HASTA this form can hold, so the
    // duration carries it — `startWithinDay`'s rule, in the other direction.
    return {
      at: end ? formatTimeOfDay(end) : "",
      from: formatTimeOfDay(occurred),
    };
  }
  return timeMeans === "start"
    ? { at: "", from: formatTimeOfDay(occurred) }
    : { at: formatTimeOfDay(occurred), from: "" };
});

const [at, setAt] = useState(initial.at);
const [from, setFrom] = useState(initial.from);
```

and in `opened`, use `at: initial.at` and `from: initial.from` in place of the two recomputations.

- [ ] **Step 2: Teach the steppers to count forward**

`applyMinutes` and `editDuration` both end with `setFrom(startOnDay(at, day, total))`, which needs HASTA. Add this helper next to `startOnDay` (around line 176):

```ts
/** The clock time `total` minutes after `at` — or "" when that leaves the day. */
function endOnDay(atText: string, day: Date, total: number): string {
  const start = parseTimeOfDay(atText, day);
  if (!start) return "";
  const end = endWithinDay(start, total);
  return end ? formatTimeOfDay(end) : "";
}
```

and in both callbacks replace that last line with:

```ts
// With no HASTA the walk is a start plus a length, so the steppers move
// the end instead of the start. Exactly the mirror of the other case.
if (at.trim()) setFrom(startOnDay(at, day, total));
else if (from.trim()) setAt(endOnDay(from, day, total));
```

Add `from` to both callbacks' dependency arrays.

- [ ] **Step 3: Make HASTA conditional in `save`**

Replace the opening guard and the two walk branches of `save` with:

```ts
const end = parseTimeOfDay(at, day);
const start = isWalk && from.trim() ? parseTimeOfDay(from, day) : null;

// **HASTA is required unless DESDE can stand in for it.** A walk needs two
// times, or one time and a length; everything else still needs the hour it
// happened at.
if (!end && !(isWalk && from.trim())) {
  setAtError("Escríbela como 09:15");
  return false;
}
if (end && end.getTime() > Date.now() + 60_000) {
  setAtError(isWalk ? "¿Todavía no habéis vuelto?" : "¿Todavía no ha pasado?");
  return false;
}
setAtError(null);

if (isWalk && from.trim() && !start) {
  setFromError("Escríbela como 09:15");
  return false;
}
setFromError(null);

let occurredAt = end as Date;
let walkMinutes: number | null = null;

if (isWalk && start && end) {
  walkMinutes = minutesBetween(start, end);
  if (walkMinutes === null) {
    // Still refused, and deliberately: a HASTA typed before its DESDE is a
    // mistyped digit far more often than a walk across midnight. What the
    // app now records is a crossing it *measured*, where it holds both
    // instants and guesses nothing.
    setFromError("Tiene que ser antes de la hora de vuelta");
    return false;
  }
  occurredAt = start;
} else if (isWalk) {
  const typed = parseDuration(durationText);
  if (durationText.trim() && (typed === null || typed <= 0)) {
    setDurationError("Escríbela como 45 min o 1h 30m");
    return false;
  }
  if (typed !== null && typed > MAX_WALK_MINUTES) {
    setDurationError("Como mucho 24 horas");
    return false;
  }
  walkMinutes = typed;
  // A walk known only by its start: `occurred_at` is that start, and the
  // length is the fact. This is the walk in progress, and the walk that
  // crossed midnight, which are the same row.
  if (start) occurredAt = start;
}
```

The `payload` below is unchanged.

- [ ] **Step 4: Run lint and the suite**

Run: `pnpm lint && pnpm test`
Expected: PASS. If `react-hooks/exhaustive-deps` reports the two callbacks, add the missing dependency rather than silencing the rule.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "fix(paseo): a walk needs two times, or one time and a length"
```

---

### Task 5: `GoalBlock`

The goal block becomes a component, because it is gaining three states, a control and an animation, and `app/(tabs)/index.tsx` is already 1600 lines. Shared UI lives in `components/ui/`, never in `app/`.

**Files:**

- Create: `components/ui/GoalBlock.tsx`
- Modify: `components/ui/index.ts` (add the export beside the others)
- Test: `components/__tests__/class-strings.test.ts` and `function-styles.test.ts` already scan every component; no new unit test — the states are verified in Task 7 on the device and in e2e.

**Interfaces:**

- Consumes: `elapsedMinutes` from `lib/walk.ts`, `formatDuration` from `lib/duration.ts`, `colors` and `TOUCH_TARGET` from `./tokens`, `Text` from `./Text`, `Play`/`Square` from `lucide-react-native`, `useReducedMotion` and friends from `react-native-reanimated`
- Produces:

```ts
export function GoalBlock(props: {
  walkedMinutes: number;
  goalMinutes: number | null;
  durationFormat: DurationFormat;
  /** The walk in progress's start, or null when none is running. */
  walkingSince: Date | null;
  /** Absent on a past day, which has nothing to start. */
  onStart?: () => void;
  onStop?: () => void;
  busy?: boolean;
  testID?: string;
}): JSX.Element;
```

- [ ] **Step 1: Write the component**

Create `components/ui/GoalBlock.tsx`:

```tsx
import { Play, Square } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { formatDuration } from "../../lib/duration";
import type { DurationFormat } from "../../lib/settings";
import { elapsedMinutes } from "../../lib/walk";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * How often the counter catches up with the clock, in ms.
 *
 * Half a minute, so a displayed minute is never more than thirty seconds
 * stale, and nothing on this screen re-renders every second for an hour.
 */
const TICK_MS = 30_000;

/**
 * How long one breath of the in-progress segment takes.
 *
 * **Slower than `Skeleton`'s 900ms, and that is the point.** A skeleton
 * breathes for a few hundred milliseconds while something arrives; this
 * breathes for the length of a walk. An animation that runs for an hour has to
 * be calmer than one that runs for a second, or it stops being a signal and
 * becomes a nag.
 */
const BREATH_MS = 2400;
const DIM = 0.35;

/**
 * The day's walking, and the control that starts and stops it.
 *
 * **The only place on this screen that already talks about walks**, which is
 * why it gains the control by changing state rather than by growing one.
 * Nothing floats: the floating action keeps the corner it has.
 *
 * **The bar stays Mist while walking.** Aqua on this fill means "goal met" and
 * nothing else (DESIGN.md), so the state change is carried by the text. The
 * minutes of the walk in progress are not stored, so they are a dimmer segment
 * at the head of the fill rather than part of it — the measure keeps measuring
 * what is recorded, and the segment shows what is merely happening.
 *
 * **The block renders with no goal too.** `exercise_goal_minutes` is nullable
 * and the activity question is optional, so gating the whole block on a goal
 * left those tutors with nowhere for the control to live. The goal and the bar
 * come and go; the block does not.
 */
export function GoalBlock({
  walkedMinutes,
  goalMinutes,
  durationFormat,
  walkingSince,
  onStart,
  onStop,
  busy = false,
  testID,
}: {
  walkedMinutes: number;
  goalMinutes: number | null;
  durationFormat: DurationFormat;
  walkingSince: Date | null;
  onStart?: () => void;
  onStop?: () => void;
  busy?: boolean;
  testID?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!walkingSince) return;
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [walkingSince]);

  const running = walkingSince ? elapsedMinutes(walkingSince, now) : 0;
  const met = goalMinutes !== null && walkedMinutes >= goalMinutes;
  const control = walkingSince ? onStop : onStart;

  const recorded =
    goalMinutes === null || goalMinutes === 0
      ? 0
      : Math.min(100, (walkedMinutes / goalMinutes) * 100);
  const inProgress =
    goalMinutes === null || goalMinutes === 0
      ? 0
      : Math.min(100 - recorded, (running / goalMinutes) * 100);

  return (
    <View testID={testID} className="mb-8">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text
          testID={testID ? `${testID}-measure` : undefined}
          numberOfLines={1}
          className={`flex-1 font-semibold ${walkingSince ? "text-accent" : "text-text-primary"}`}
        >
          {walkingSince
            ? `De paseo · ${formatDuration(running, durationFormat)}`
            : goalMinutes === null
              ? `${formatDuration(walkedMinutes, durationFormat)} paseados hoy`
              : `${formatDuration(walkedMinutes, durationFormat)} de ${formatDuration(goalMinutes, durationFormat)} paseados`}
        </Text>

        {control ? (
          <Pressable
            testID={testID ? `${testID}-control` : undefined}
            onPress={control}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              walkingSince ? "Terminar paseo" : "Empezar paseo"
            }
            accessibilityState={{ disabled: busy }}
            style={{ minHeight: TOUCH_TARGET }}
            className="shrink-0 flex-row items-center gap-2 pl-3 active:opacity-70"
          >
            {walkingSince ? (
              <Square size={16} strokeWidth={2.5} color={colors.accent} />
            ) : (
              <Play size={16} strokeWidth={2.5} color={colors.accent} />
            )}
            <Text className="font-semibold text-accent">Paseo</Text>
          </Pressable>
        ) : met ? (
          <Text className="shrink-0 font-semibold text-xs text-accent">
            Objetivo conseguido
          </Text>
        ) : null}
      </View>

      {goalMinutes !== null ? (
        // `h-[4px]`, not `h-1`: the calendar draws this bar in miniature and
        // sizes it in literal pixels, and 0.25rem resolves to 3.38dp on native.
        <View className="h-[4px] flex-row overflow-hidden rounded-xl bg-surface">
          <View
            testID={testID ? `${testID}-bar` : undefined}
            style={{ width: `${recorded}%` }}
            className={`h-[4px] ${met ? "bg-accent" : "bg-text-secondary"}`}
          />
          {inProgress > 0 ? <Breath width={inProgress} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The minutes that are happening rather than recorded.
 *
 * Opacity only, and it holds at the dim end under "remove animations" — the
 * line `Skeleton` and `Celebration` both draw. A left-to-right shimmer was
 * considered and rejected: this app's only loading idiom is a pulse, and a
 * traverse would say "cargando" on a bar that is not loading anything.
 */
function Breath({ width }: { width: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(0, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: DIM + progress.value * (1 - DIM),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[{ width: `${width}%` }, style]}
      className="h-[4px] bg-text-tertiary"
    />
  );
}
```

- [ ] **Step 2: Export it**

Add to `components/ui/index.ts`, in the file's existing alphabetical position:

```ts
export { GoalBlock } from "./GoalBlock";
```

- [ ] **Step 3: Run lint and the component guards**

Run: `pnpm lint && pnpm test`
Expected: PASS. `function-styles.test.ts` fails on any `style={(`; `class-strings.test.ts` fails on a template literal with no space before an interpolation. Both must stay green.

- [ ] **Step 4: Commit**

```bash
git add components/ui/GoalBlock.tsx components/ui/index.ts
git commit -m "feat(paseo): the goal block carries the walk instead of only measuring it"
```

---

### Task 6: wire the day view

**Files:**

- Modify: `app/(tabs)/index.tsx` (the imports, the day-view component's state and effects, the goal block's two render branches around lines 575–615, the `Entry` call around line 666, and `Entry` itself around line 769)

**Interfaces:**

- Consumes: `GoalBlock` (Task 5); `startWalk`, `closeWalk`, `deleteEvent` (Task 3 and existing); `WALK_STORAGE_KEY`, `parseRunningWalk`, `serialiseRunningWalk`, `walkOutcome`, `elapsedMinutes` (Task 2); `EntrySheet`'s `timeMeans` (Task 4)
- Produces: nothing other tasks consume

- [ ] **Step 1: Hold the running walk**

Add to the day view's state, beside the existing `useState` calls:

```ts
/** The walk this device has open, or null. Read once, then kept in step. */
const [runningId, setRunningId] = useState<string | null>(null);
const [walkBusy, setWalkBusy] = useState(false);

useEffect(() => {
  let cancelled = false;
  AsyncStorage.getItem(WALK_STORAGE_KEY).then((raw) => {
    if (!cancelled) setRunningId(parseRunningWalk(raw));
  });
  return () => {
    cancelled = true;
  };
}, []);
```

Import `AsyncStorage` from `@react-native-async-storage/async-storage` at the top.

- [ ] **Step 2: Resolve it against the day's rows**

After `events` is in hand, derive the walk and drop a flag that no longer points anywhere:

```ts
/**
 * The row this device thinks is running, if it is on the day in view.
 *
 * **Derived, never a second piece of state.** An effect keeping one state in
 * step with another is the defect `react-hooks/set-state-in-effect` exists
 * to report, and the walk's start is already in the row.
 */
const runningWalk =
  runningId !== null
    ? (events.find((event) => event.id === runningId) ?? null)
    : null;
const walkingSince = runningWalk ? new Date(runningWalk.occurred_at) : null;

// Two ways a flag stops meaning anything, and both drop it without writing:
// the row is gone — deleted on the other phone — or the walk has been open
// past the column's ceiling, which is the forgotten stop. Only once the
// day's rows have actually loaded, or every reload would clear it on the way
// past, and only on the day the walk belongs to, or paging back a week would
// clear a walk that is running fine.
useEffect(() => {
  if (!runningId || loading || logError || !isToday) return;
  const row = events.find((event) => event.id === runningId);
  const stale =
    !row ||
    walkOutcome(new Date(row.occurred_at), new Date()).action === "abandon";
  if (!stale) return;
  AsyncStorage.removeItem(WALK_STORAGE_KEY).then(() => setRunningId(null));
}, [runningId, events, loading, logError, isToday]);
```

A walk abandoned this way keeps its start and no length. Never clamp it to
1440: that invents a 24-hour walk, and the CHECK would be satisfied by a lie.

- [ ] **Step 3: Start and stop**

```ts
const start = useCallback(async () => {
  if (!petId || walkBusy) return;
  setWalkBusy(true);
  // The write comes first and the state follows it. A block that says "De
  // paseo" over a walk the server never accepted is worse than a tap that
  // visibly did nothing.
  const { id, error } = await startWalk(petId);
  setWalkBusy(false);
  if (error || !id) {
    toast.show({
      variant: "error",
      message: error ?? "No se ha podido empezar el paseo",
      persist: true,
    });
    return;
  }
  await AsyncStorage.setItem(WALK_STORAGE_KEY, serialiseRunningWalk(id));
  setRunningId(id);
  setAttempt((n) => n + 1);
}, [petId, walkBusy, toast]);

const stop = useCallback(async () => {
  if (!runningWalk || !walkingSince || walkBusy) return;
  setWalkBusy(true);
  const outcome = walkOutcome(walkingSince, new Date());
  const { error } =
    outcome.action === "discard"
      ? await deleteEvent(runningWalk.id)
      : outcome.action === "close"
        ? await closeWalk(runningWalk.id, outcome.minutes)
        : { error: null };
  setWalkBusy(false);
  if (error) {
    // The walk stays running so the tutor can press stop again.
    toast.show({ variant: "error", message: error, persist: true });
    return;
  }
  await AsyncStorage.removeItem(WALK_STORAGE_KEY);
  setRunningId(null);
  setAttempt((n) => n + 1);

  // The same threshold the sheet's `onSaved` crosses, with simpler
  // arithmetic: a running walk contributes null to `walked`, so there is no
  // old value to take out before the new one goes in. `isToday` is what
  // stops a walk closed after midnight throwing confetti over a day nobody
  // is looking at.
  if (
    outcome.action === "close" &&
    isToday &&
    goal !== null &&
    goal > 0 &&
    !met &&
    walked + outcome.minutes >= goal
  ) {
    celebrate();
  }
}, [
  runningWalk,
  walkingSince,
  walkBusy,
  toast,
  celebrate,
  isToday,
  goal,
  met,
  walked,
]);
```

`toast` comes from `useToast()` and `celebrate` from `useCelebration()`, both already held by this component (around line 230). `setAttempt` is what `reload` increments; use it directly so a successful walk does not clear the pet's error banner.

- [ ] **Step 4: Replace both goal-block branches**

Delete the `goal !== null && loading` skeleton branch and the `goal !== null && !loading` block, and render instead:

```tsx
{
  loading ? (
    <View testID="home-goal-skeleton" className="mb-8">
      <View className="mb-2">
        <Skeleton width="58%" height={16} />
      </View>
      {goal !== null ? <Skeleton width="100%" height={4} /> : null}
    </View>
  ) : (
    <GoalBlock
      testID="home-goal"
      walkedMinutes={walked}
      goalMinutes={goal}
      durationFormat={settings.durationFormat}
      walkingSince={walkingSince}
      busy={walkBusy}
      onStart={isToday && !walkingSince ? start : undefined}
      onStop={walkingSince ? stop : undefined}
    />
  );
}
```

- [ ] **Step 5: Pin the day while a walk is open, and mark the live row**

In the `AppState` effect, do not advance `day` while this device has a walk open — the tutor is holding something half-finished and moving them off it loses the row they would tap:

```ts
if (daysAgo(day, today) === 0 && !runningId) setDay(now);
```

Add `runningId` to that effect's dependency array.

Pass the running flag down to the row and to the sheet:

```tsx
<Entry
  key={event.id}
  event={event}
  running={event.id === runningId}
  onPress={() => setEditing({ kind: event.kind as EventKind, event })}
/>
```

and on the sheet:

```tsx
          timeMeans={editing.event?.id === runningId ? "start" : "end"}
```

In `Entry`, take `running = false` and use it for the two places it shows:

```tsx
const described = running
  ? `En marcha · ${formatDuration(elapsedMinutes(new Date(event.occurred_at), new Date()), settings.durationFormat)}`
  : spec?.describe(event, settings.durationFormat);
```

and give the time and the glyph the accent while it runs — `className={running ? "text-accent" : "text-text-tertiary"}` on the time, and `color={running ? colors.accent : …}` on the icon, keeping the existing colour expression as the false branch.

- [ ] **Step 6: Run everything**

Run: `pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat(paseo): empezar y terminar un paseo desde el bloque del objetivo"
```

---

### Task 7: prove it, version it, write it down

**Files:**

- Modify: `e2e/home.spec.ts`, `package.json`, `CHANGELOG.md`
- Regenerate: `lib/changelog.generated.ts`

- [ ] **Step 1: Write the end-to-end test**

Add to `e2e/home.spec.ts`. Every time comes from a `now` the test owns; nothing types a fixed morning hour onto today.

```ts
test("un paseo se empieza y se termina desde el objetivo", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("home-goal-control").click();

  await expect(page.getByTestId("home-goal-measure")).toContainText("De paseo");
  const row = page.locator('[data-testid^="home-entry-"]').last();
  await expect(row).toContainText("En marcha");

  await page.getByTestId("home-goal-control").click();
  await expect(page.getByTestId("home-goal-measure")).not.toContainText(
    "De paseo",
  );
  // Under a minute is a mis-tap, so the row goes with it.
  await expect(row).toHaveCount(0);
});

test("un paseo sin hora de vuelta se guarda", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("home-prev-day").click();
  await page.getByTestId("home-add").click();
  await page.getByTestId("home-add-walk").click();
  // HASTA is `entry-to`; DESDE is `entry-from`. Clearing a field with a real
  // keyboard fires one change per key, so the device path differs from
  // `fill("")` — which is exactly why this case is also checked on the phone
  // in Step 6.
  await page.getByTestId("entry-to").fill("");
  await page.getByTestId("entry-from").fill("2340");
  await page.getByTestId("entry-duration").fill("30 min");
  await page.getByTestId("entry-save").click();
  await expect(page.getByTestId("entry-title")).toHaveCount(0);
});
```

The sheet has no container `testID`; `entry-scrim` and `entry-title` are what
the existing specs assert on when it closes.

- [ ] **Step 2: Run the suite**

Run: `node -v` (must be 22+), then `pnpm test:e2e`
Expected: PASS. A mass failure whose first error is `net::ERR_CONNECTION_REFUSED` is a dead dev server, not the code: `pkill -f "expo start"` and run again.

- [ ] **Step 3: Bump the version and write the entry**

`package.json`: `0.9.0` → `0.10.0`. `versionCode` derives to 1000, which stays above 0.9.0's 900.

Add to `CHANGELOG.md`, above the previous version, in the file's voice — what changed and why it was wrong, not "fixed a bug":

```markdown
## 0.10.0

- **Los paseos se pueden cronometrar.** El bloque del objetivo gana un botón:
  al salir de casa se pulsa y el paseo queda abierto con su hora de inicio
  real, al volver se pulsa otra vez. Hasta ahora la única forma de no perder
  esa hora era crear el paseo en la calle con una hora de vuelta provisional y
  corregirla al llegar.
- **El paseo en marcha se puede anotar sin esperar.** Aparece en el registro
  como una fila más, así que la kaka de mitad de paseo se apunta donde se
  apunta siempre.
- **Un paseo que cruza medianoche ya se puede guardar.** Antes la hoja exigía
  la hora de vuelta y la leía contra el día en pantalla, así que un paseo de
  23:40 a 00:10 se rechazaba a sí mismo al abrirlo y volver a guardarlo sin
  tocar nada. Ahora un paseo necesita dos horas, o una hora y una duración.
- **El bloque del objetivo aparece aunque no haya objetivo.** La actividad
  diaria es un campo opcional, y quien no lo había rellenado no veía el bloque
  — ni, por tanto, tendría dónde empezar un paseo.
```

- [ ] **Step 4: Regenerate the changelog module and run the suite**

Run: `node scripts/changelog.mjs && pnpm test`
Expected: PASS. `changelog.test.ts` fails when `lib/changelog.generated.ts` is behind the markdown.

- [ ] **Step 5: Commit**

```bash
git add e2e/home.spec.ts package.json CHANGELOG.md lib/changelog.generated.ts
git commit -m "feat(paseo): v0.10.0, el cronómetro de paseo"
```

- [ ] **Step 6: Verify on the device**

The web target hides all of this, so the change is verified on the phone with a screenshot, not by eye in the browser.

```bash
pnpm android:usb
```

Check and capture with `adb exec-out screencap -p > /tmp/walk-<state>.png`:

1. The idle line at `font_scale` 1.0 **and 1.3** — `34 min de 3h paseados` beside the control. If it clips, the control moves below the bar in **both** states so the block does not jump.
2. Both controls measured at 48dp or more.
3. The breathing segment, with "remove animations" off and on. Off it holds dim; it never traverses.
4. A walk started, the row showing `En marcha` last in the log, tapped, a stool chip ticked, saved, then stopped — and the note still there afterwards.
5. The block with the goal cleared on the profile, to see the no-goal state.

**The real diary is not a test fixture.** Use a walk you start and stop deliberately; do not edit or delete anything that was already there.
