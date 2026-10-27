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
 * **It is kept per pet, because the slot used to be one and a second animal
 * makes that a lie.** With one dog, "the walk that is running" had a single
 * answer. With two, the first blob would hold Loki's walk and Nala's button
 * would show it as running — the wrong dog, with no error, and a stop that
 * closes a walk the tutor never started for her. So the blob is a map from pet
 * id to walk id, and reading and writing it go through the helpers below
 * rather than through `setItem` on a bare key: the blob belongs to every pet at
 * once, so a write for one has to carry the others along.
 *
 * The rules below are here rather than in the screen for the reason the crop
 * maths is: a wrong answer does not throw. It deletes a walk the tutor meant
 * to keep, or stores a length that disagrees with the number they were
 * watching a second earlier.
 */

export const WALK_STORAGE_KEY = "petfile.walk.v1";

/**
 * The shape before there could be two pets: `{"id": "<walk>"}`. The key did not
 * change, so a phone updated with a walk open still holds one, and it is read
 * as the walk of whichever pet asks — it predates the question. The first write
 * leaves the new shape and drops it, which closes that ambiguity.
 */
type Stored = { walks?: unknown; id?: unknown };

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null
      ? (value as Stored)
      : null;
  } catch {
    return null;
  }
}

/** The walks the blob holds, whatever shape it was written in. */
function walksOf(raw: string | null): Record<string, string> {
  const value = parse(raw);
  const walks: Record<string, string> = {};
  if (value && typeof value.walks === "object" && value.walks !== null) {
    for (const [pet, id] of Object.entries(value.walks)) {
      if (typeof id === "string" && id.length > 0) walks[pet] = id;
    }
  }
  return walks;
}

/** Reads a stored blob without trusting it: anything unexpected is nothing. */
export function parseRunningWalk(
  raw: string | null,
  petId: string,
): string | null {
  const value = parse(raw);
  if (!value) return null;
  if (typeof value.id === "string" && value.id.length > 0) return value.id;
  return walksOf(raw)[petId] ?? null;
}

/** The blob to store once `petId` has `walkId` running; other pets are kept. */
export function withRunningWalk(
  raw: string | null,
  petId: string,
  walkId: string,
): string {
  return JSON.stringify({ walks: { ...walksOf(raw), [petId]: walkId } });
}

/**
 * What `withoutRunningWalk` returns once no pet has a walk open. A caller that
 * gets it back has nothing to keep and can drop the key instead of storing an
 * empty map — which is what the device held before there was a map at all.
 */
export const NO_RUNNING_WALKS = JSON.stringify({ walks: {} });

/** The blob to store once `petId` has no walk running; other pets are kept. */
export function withoutRunningWalk(raw: string | null, petId: string): string {
  const walks = walksOf(raw);
  delete walks[petId];
  return JSON.stringify({ walks });
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
