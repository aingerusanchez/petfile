/**
 * What the phone knows about a walk it was told to stop and could not yet say
 * so to the server.
 *
 * **`pressedAt` is the datum this whole file rests on**: the moment the tutor
 * pressed, read off the phone's clock at that moment. `minutes` was already
 * computed against it, so replaying the intent never consults the clock again
 * — a stop replayed from the lift and a stop replayed from the street write
 * the same length, which is the entire point. Press, lose signal, climb the
 * stairs: the stairs are not walking.
 *
 * The queue lives where `lib/walk.ts` keeps the running walk, for the same
 * reason: it is a fact about the app, not about the dog. It is keyed by walk
 * id, because a walk has one ending — a second press on the same walk is a
 * correction of the first, not another event.
 *
 * The rules are here rather than in the screen because a wrong answer does not
 * throw. It writes a walk 40 minutes longer than it was, or counts a deleted
 * walk in the "pending" tally for a row that will never exist.
 */

export const PENDING_STORAGE_KEY = "petfile.pending.v1";

export type PendingStop =
  | { kind: "close"; id: string; minutes: number; pressedAt: string }
  | { kind: "delete"; id: string; pressedAt: string };

/** Past this, a pending mark stops being discreet — see `agedPending`. */
const AGED_AFTER_MS = 6 * 60 * 60_000;

const isInstant = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(new Date(value).getTime());

/** One stored element, or null when it is not a stop `parsePending` can keep. */
function parseStop(value: unknown): PendingStop | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || item.id.length === 0) return null;
  if (!isInstant(item.pressedAt)) return null;
  if (item.kind === "delete") {
    return { kind: "delete", id: item.id, pressedAt: item.pressedAt };
  }
  if (
    item.kind === "close" &&
    typeof item.minutes === "number" &&
    Number.isFinite(item.minutes) &&
    item.minutes >= 0
  ) {
    return {
      kind: "close",
      id: item.id,
      minutes: item.minutes,
      pressedAt: item.pressedAt,
    };
  }
  return null;
}

/**
 * Reads a stored blob without trusting it: anything unexpected is an empty
 * queue, and nothing in here can throw — this runs on launch, so a parse that
 * threw on a corrupt value would take the day view down with it.
 *
 * **An element that is not a stop is skipped, and its neighbours are kept.**
 * Each one is validated on its own by `parseStop`, so a survivor is well-formed
 * by definition — keeping it is not keeping something suspect. Emptying the
 * queue over one bad element would throw away every valid stop beside it, and
 * a pending stop is a walk the tutor already took: nothing here is discarded
 * in silence, least of all the many for the sake of the one.
 *
 * A bad element is close to impossible, and that is why this is defensive
 * rather than expected: the key is versioned (`petfile.pending.v1`), so a
 * format change takes a new key instead of leaving garbage under the old one.
 * Do not simplify the guard away on the strength of that.
 */
export function parsePending(raw: string | null): PendingStop[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((element) => parseStop(element) ?? []);
  } catch {
    return [];
  }
}

export function serialisePending(queue: PendingStop[]): string {
  return JSON.stringify(queue);
}

/** A second stop for the same walk replaces the first: the later press wins. */
export function enqueueStop(
  queue: PendingStop[],
  item: PendingStop,
): PendingStop[] {
  return [...withoutStop(queue, item.id), item];
}

export function withoutStop(queue: PendingStop[], id: string): PendingStop[] {
  return queue.filter((stop) => stop.id !== id);
}

/** Minutes the server has not heard about yet. A delete contributes none. */
export function pendingMinutes(queue: PendingStop[]): number {
  return queue.reduce(
    (sum, stop) => (stop.kind === "close" ? sum + stop.minutes : sum),
    0,
  );
}

/**
 * Walks that will become rows. A delete is not one: it is a walk that stops
 * existing, so counting it would announce a walk nobody will ever see.
 */
export function pendingWalks(queue: PendingStop[]): number {
  return queue.filter((stop) => stop.kind === "close").length;
}

/**
 * Six hours after the press. Not a deadline to give up at — the stop is kept
 * however long it takes — but the point where the mark stops being discreet:
 * the tutor opens the app several times a day, so six hours still pending
 * means the retries are failing, again and again, and they should be told.
 */
export function agedPending(item: PendingStop, now: Date): boolean {
  return now.getTime() - new Date(item.pressedAt).getTime() > AGED_AFTER_MS;
}
