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
 * a pending stop is a walk the tutor already took, so the many are not thrown
 * away for the sake of the one. **The bad element itself does go, quietly**,
 * and that is the one place this module parts company with the rule that
 * nothing is discarded in silence — an element that cannot be read cannot be
 * announced either, because there is nothing left in it to name.
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

/**
 * The day's rows, as much of them as this file needs: whether a walk exists
 * and whether it already has a length.
 *
 * Structural rather than `PetEventRow`, so the queue stays a module about the
 * phone and knows nothing about the shape of a row.
 */
export type DayRow = { id: string; duration_minutes: number | null };

/**
 * The queued stops the day in view has to account for.
 *
 * **The queue cannot answer this on its own.** It is a fact about the phone
 * and carries no day: added whole, last night's pending walk would land on
 * whatever day the arrows reach. The day's rows are what say which stops are
 * this day's, because a queued stop is always an intent over a row that
 * already exists on the server.
 *
 * **A row that already has a length is not one of them, and that is the two
 * tutor case.** Tutor A presses stop on the hill with no signal and the walk
 * is queued; tutor B closes the same walk from their own phone; the row comes
 * back carrying the length. `walkedMinutes` counts it from the row, and
 * counting the queued stop beside it would read 90 min in 2 paseos for one
 * walk — on the one line of the screen whose whole job is a single honest
 * total. Whichever close landed first wins, which is the only rule that needs
 * no guessing.
 *
 * A row that has gone — deleted on the other phone — is not one either: there
 * is no walk left to count. **The test is the same for a delete**, which
 * costs nothing: a delete contributes neither minutes nor a walk, so the only
 * thing this decides for it is nothing at all.
 *
 * It is here rather than in the screen for the reason the crop maths is: a
 * wrong answer does not throw. It counts the dog's minutes twice, or counts
 * them on a day he was not walked.
 */
export function pendingForDay(
  queue: PendingStop[],
  rows: DayRow[],
): PendingStop[] {
  return queue.filter((stop) =>
    rows.some((row) => row.id === stop.id && row.duration_minutes === null),
  );
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
 * What the server said about one replayed intent.
 *
 * **A network failure and a rejection are not the same thing**, and keeping
 * them apart is the whole reason this is three words rather than a boolean.
 *
 * - `done` — the intent holds now. Either this write landed, or the server
 *   already agreed with it: the other tutor closed the same walk first, or
 *   the row a delete was aimed at is already gone. Whichever close landed
 *   first wins, which is the only rule that needs no guessing.
 * - `gone` — the row no longer exists, so a close can never be written. This
 *   intent will not be fulfilled however long it waits.
 * - `failed` — the request did not get through. Nothing is known about the
 *   row, so the intent is exactly as pending as it was.
 */
export type StopOutcome = "done" | "gone" | "failed";

/**
 * How a queued intent reaches the server.
 *
 * **Injected rather than imported**, so this module stays the pure one it
 * says it is: the rules here can be tested against a writer that answers on
 * demand, and the only Supabase import site in app code stays `lib/supabase.ts`
 * — the screen passes `replayStop` from `lib/events.ts`, which is where the
 * conditional write that makes `done` honest actually lives.
 */
export type ReplayStop = (stop: PendingStop) => Promise<StopOutcome>;

/**
 * The replays in flight, by walk id.
 *
 * **Two replays at once must not write the same intent twice**, and they can
 * overlap for real: coming back to the app and a day read that ends well are
 * two triggers that happen within the same second of each other. A second
 * replay of an element already in the air waits on the first and reports its
 * answer, so the queue is replayed once however many callers ask.
 *
 * **Per element rather than one flag over the whole replay**, which is the
 * stronger guard and not the more complicated one: a replay whose queue has
 * grown since the first started still writes the element the first does not
 * carry, instead of being dropped whole.
 *
 * It holds nothing once a write settles — this is a guard against overlap,
 * not a memory of what the server said.
 */
const replaying = new Map<string, Promise<StopOutcome>>();

function replayOnce(stop: PendingStop, replay: ReplayStop) {
  const held = replaying.get(stop.id);
  if (held) return held;
  const run = (async () => {
    try {
      return await replay(stop);
    } catch {
      // A writer that throws is a request that did not get through, which is
      // the safe side of the only mistake this can make: the intent stays and
      // is tried again, rather than being dropped on an exception nobody
      // classified.
      return "failed" as const;
    } finally {
      replaying.delete(stop.id);
    }
  })();
  replaying.set(stop.id, run);
  return run;
}

/**
 * Replays the queue. Returns the elements that are still pending and the ones
 * the server rejected for good, **which are two different things**.
 *
 * What is in neither list is done, and the caller may stop holding it: the
 * walk is in the diary with the length the tutor pressed for.
 *
 * Nothing here reads the clock. `minutes` was computed against `pressedAt`
 * when the tutor pressed, so a stop replayed from the lift and a stop
 * replayed from the street write the same length.
 */
export async function flushPending(
  queue: PendingStop[],
  replay: ReplayStop,
): Promise<{ left: PendingStop[]; rejected: PendingStop[] }> {
  const replayed = await Promise.all(
    queue.map(async (stop) => ({
      stop,
      outcome: await replayOnce(stop, replay),
    })),
  );
  return {
    left: replayed.flatMap(({ stop, outcome }) =>
      outcome === "failed" ? stop : [],
    ),
    rejected: replayed.flatMap(({ stop, outcome }) =>
      outcome === "gone" ? stop : [],
    ),
  };
}
