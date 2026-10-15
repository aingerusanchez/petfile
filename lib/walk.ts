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
