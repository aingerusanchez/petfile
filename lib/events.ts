import type { Database } from "./database.types";
import { describeFailure, withTimeout } from "./failures";
import { supabase } from "./supabase";

/**
 * The day's log: walks, meals, medication and incidents.
 *
 * One table for all four because they are the same kind of fact — something
 * happened at a time, and the day view reads it back as a list. What separates
 * them from weights and treatments is not the subject matter but that nothing
 * is computed from them; the one exception is a walk's minutes, which the
 * exercise goal is measured against, and that is why `duration_minutes` is a
 * column rather than a key in `details`. See
 * `0006_events_weights_treatments.sql`.
 */

export type PetEventRow = Database["public"]["Tables"]["pet_events"]["Row"];

export type EventKind = "walk" | "meal" | "medication" | "incident";

export type NewEvent = {
  kind: EventKind;
  /** When it happened, which is rarely when it is logged. */
  occurredAt: Date;
  /** Walks only, in minutes. */
  durationMinutes?: number | null;
  note?: string | null;
  /** Per-kind specifics the app lists rather than calculates from. */
  details?: Record<string, unknown>;
};

/** The longest a single walk can be logged as, matching the CHECK constraint. */
export const MAX_WALK_MINUTES = 1440;

export function validateEvent(event: NewEvent): Record<string, string> {
  const errors: Record<string, string> = {};

  if (event.kind === "walk") {
    const minutes = event.durationMinutes;
    if (minutes !== undefined && minutes !== null) {
      if (!Number.isInteger(minutes) || minutes <= 0) {
        errors.durationMinutes = "¿Cuánto duró?";
      } else if (minutes > MAX_WALK_MINUTES) {
        errors.durationMinutes = "Eso son más de 24 horas";
      }
    }
  }

  // A future entry is almost always a mistyped time rather than a plan, and
  // the day view would file it under a day that has not happened.
  if (event.occurredAt.getTime() > Date.now() + 60_000) {
    errors.occurredAt = "¿Todavía no ha pasado?";
  }

  return errors;
}

/**
 * The local day's bounds, as instants.
 *
 * Local, not UTC: "today" is the tutor's day. A walk logged at 00:30 belongs
 * to the night that just ended in their head and to the calendar day the
 * device shows, and building the range from `setHours` is what keeps those two
 * the same thing across the whole timezone offset — including the offsets that
 * are not whole hours.
 */
export function dayBounds(day: Date): { from: string; to: string } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * The local month's bounds, as instants. Same reasoning as `dayBounds`.
 *
 * `setDate(1)` before `setMonth(+1)` on purpose: incrementing the month from
 * the 31st lands on a date the next month does not have, and the runtime
 * rolls it forward — asking for a month from the 31st of March would have
 * returned a range starting in March and ending in May.
 */
export function monthBounds(day: Date): { from: string; to: string } {
  const from = new Date(day);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * The bounds covering `months` whole months back through the end of `day`'s.
 *
 * **The calendar reads a window, not a month, and the library is why.** Its
 * header arrows change the displayed month by dispatching internal state and
 * calling nobody — `onMonthChange` fires only from the month *list* — so a
 * per-month fetch could not know it had to run again. Paging back one month
 * left every cell falling through to the unlogged branch, which had the
 * calendar asserting that nothing happened all August. Measured: one seeded
 * incident, zero marks after one tap.
 *
 * A year of one dog's entries is a few thousand rows at the very most and one
 * request, so the window is the cheap fix and the honest one. Past its edge
 * the marks stop, which is a bounded limit rather than a lie that moves.
 */
export function monthsBackBounds(
  day: Date,
  months: number,
): { from: string; to: string } {
  const from = new Date(day);
  from.setDate(1);
  from.setMonth(from.getMonth() - months);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: monthBounds(day).to };
}

/** The local calendar day an instant falls on, as `YYYY-MM-DD`. */
export function dayKey(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

/**
 * What a calendar cell needs to know about one day.
 *
 * **It does not know about the exercise goal**, and that is the point: the
 * goal is a single current value on the pet, so whether a day "met" it is a
 * question about today's target rather than a fact about that day. The
 * aggregate reports minutes; the caller compares. See PRODUCT.md.
 */
export type DaySummary = {
  /** `YYYY-MM-DD`, local. */
  day: string;
  /** Minutes walked, for the caller to measure against the current goal. */
  walkedMinutes: number;
  hasIncident: boolean;
  hasMedication: boolean;
};

/**
 * A month of entries, reduced to one summary per day that has any.
 *
 * A day with no entries is **absent from the map**, not present with zeroes:
 * "nothing was logged" and "logged, and he did not walk enough" are different
 * things on the calendar, and a zero would collapse them.
 */
export function summariseMonth(events: PetEventRow[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();

  for (const event of events) {
    const key = dayKey(new Date(event.occurred_at));
    const summary =
      days.get(key) ??
      ({
        day: key,
        walkedMinutes: 0,
        hasIncident: false,
        hasMedication: false,
      } satisfies DaySummary);

    if (event.kind === "walk") {
      summary.walkedMinutes += event.duration_minutes ?? 0;
    } else if (event.kind === "incident") {
      summary.hasIncident = true;
    } else if (event.kind === "medication") {
      summary.hasMedication = true;
    }

    days.set(key, summary);
  }

  return days;
}

/**
 * "09:15" on a given day, as an instant — or null when it is not a time.
 *
 * **Permissive on purpose, because the keyboard is not.** Android's number pad
 * offers digits and nothing else — `decimal-pad` would add only a full stop —
 * so a tutor cannot type the colon the field displays. `900` and `0900` are
 * therefore first-class input, and the last two digits are always the minutes.
 *
 * A live mask that inserted the colon as the digits arrived was written, tested
 * and removed: **a focused `TextInput` on Android ignores a value the JS layer
 * rewrites.** Typing `9000` left `9000` on screen while state held `90:00`.
 * The browser applies the correction, so it worked on web and in the e2e suite
 * and not on the phone. The field normalises on blur instead, which the
 * platform does honour.
 *
 * A typed time rather than a picker: the entry sheet opens with the current
 * time already in the field, so the common case is confirming it and the
 * retrospective case is changing two digits. A wheel would be more taps for
 * both. Spanish writes 24-hour time, which is also the only way to say 21:00
 * without a meridiem control.
 */
export function parseTimeOfDay(text: string, day: Date): Date | null {
  const match = /^\s*(\d{1,2})[:.]?(\d{2})\s*$/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const at = new Date(day);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

/**
 * The time of day a stored instant happened.
 *
 * **`"12h"` is for reading, never for a field.** Spanish writes 24-hour time
 * and Android's number pad cannot express a meridiem, so the two time fields
 * always speak `"24h"` — the preference changes how a time is written down,
 * not how it is typed. Ajustes says so under the option.
 */
export function formatTimeOfDay(
  at: Date,
  format: "24h" | "12h" = "24h",
): string {
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, "0");

  if (format === "12h") {
    // Midnight and noon are 12, not 0 — the one place a modulo needs help.
    return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "a.m." : "p.m."}`;
  }
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

/**
 * Minutes from one time to another, or null when the second is not after the
 * first.
 *
 * Null rather than a negative number or an assumed midnight crossing: a
 * "HASTA" before its "DESDE" is a mistyped digit far more often than a walk
 * that ran past midnight, and guessing which would file the entry on a day the
 * tutor did not choose. The form says so instead.
 */
export function minutesBetween(from: Date, to: Date): number | null {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60_000);
  return minutes > 0 ? minutes : null;
}

/** The time `minutes` after `at`. */
export function shiftMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * 60_000);
}

/**
 * The start `minutes` before `end`, or null when that start is another day.
 *
 * **The day boundary is the whole point.** A walk's DESDE is shown as a time
 * of day with no date, so a start computed on the previous day comes back —
 * when that text is re-parsed against the day on screen — as the same clock
 * time *after* the end. Stepping a walk that finished at 00:20 up to 45
 * minutes produced exactly that, and the entry sheet then emptied its own
 * duration field. Null is the honest answer: there is no time of day that
 * means "23:35 yesterday" on today's form.
 *
 * Here rather than in the screen because it is arithmetic about a boundary,
 * and arithmetic can be checked without a screen.
 */
export function startWithinDay(end: Date, minutes: number): Date | null {
  const start = shiftMinutes(end, -minutes);
  return dayKey(start) === dayKey(end) ? start : null;
}

/** Minutes walked across a set of entries. Pure, so the day view can trust it. */
export function walkedMinutes(events: PetEventRow[]): number {
  return events.reduce(
    (total, event) =>
      event.kind === "walk" ? total + (event.duration_minutes ?? 0) : total,
    0,
  );
}

export async function logEvent(
  petId: string,
  event: NewEvent,
): Promise<{ error: string | null }> {
  const errors = validateEvent(event);
  const firstError = Object.values(errors)[0];
  if (firstError) return { error: firstError };

  const query = supabase.from("pet_events").insert({
    pet_id: petId,
    kind: event.kind,
    occurred_at: event.occurredAt.toISOString(),
    duration_minutes: event.durationMinutes ?? null,
    note: event.note?.trim() || null,
    details: (event.details ??
      {}) as Database["public"]["Tables"]["pet_events"]["Insert"]["details"],
  });

  try {
    const { error } = await withTimeout(query, "logEvent");
    return { error: error ? describeFailure(error, "logEvent") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "logEvent") };
  }
}

/**
 * Rewrites one entry.
 *
 * A correction, not a new fact: the row keeps its id, so the day's list does
 * not gain a duplicate and `created_by` still says who logged it. Everything
 * the sheet can ask for is sent, including the nulls — a tutor clearing the
 * duration means the walk has no duration, not that the old one should stay.
 */
export async function updateEvent(
  id: string,
  event: NewEvent,
): Promise<{ error: string | null }> {
  const errors = validateEvent(event);
  const firstError = Object.values(errors)[0];
  if (firstError) return { error: firstError };

  const query = supabase
    .from("pet_events")
    .update({
      occurred_at: event.occurredAt.toISOString(),
      duration_minutes: event.durationMinutes ?? null,
      note: event.note?.trim() || null,
      details: (event.details ??
        {}) as Database["public"]["Tables"]["pet_events"]["Update"]["details"],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  try {
    const { error } = await withTimeout(query, "updateEvent");
    return { error: error ? describeFailure(error, "updateEvent") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "updateEvent") };
  }
}

export async function eventsForDay(
  petId: string,
  day: Date,
): Promise<{ events: PetEventRow[]; error: string | null }> {
  const { from, to } = dayBounds(day);

  const query = supabase
    .from("pet_events")
    .select("*")
    .eq("pet_id", petId)
    .gte("occurred_at", from)
    .lt("occurred_at", to)
    // Chronological, earliest first: the day view is read as a diary of what
    // has happened so far, and a diary runs forwards. Newest-first is the
    // right order for a feed the reader dips into, which this is not — the
    // list is short, bounded by one day, and read whole.
    .order("occurred_at", { ascending: true });

  try {
    const { data, error } = await withTimeout(query, "eventsForDay");
    if (error)
      return { events: [], error: describeFailure(error, "eventsForDay") };
    return { events: data ?? [], error: null };
  } catch (cause) {
    return { events: [], error: describeFailure(cause, "eventsForDay") };
  }
}

/**
 * Every entry in a month, for the calendar's marks.
 *
 * One request for the whole window rather than one per month, let alone one
 * per day: thirty round trips to draw one calendar is the kind of thing that
 * works on a desk and not in a vet's waiting room — and a per-month fetch
 * cannot know when to run again, which is what `monthsBackBounds` explains.
 */
export async function eventsForMonths(
  petId: string,
  month: Date,
  monthsBack: number,
): Promise<{ days: Map<string, DaySummary>; error: string | null }> {
  const { from, to } = monthsBackBounds(month, monthsBack);

  const query = supabase
    .from("pet_events")
    .select("*")
    .eq("pet_id", petId)
    .gte("occurred_at", from)
    .lt("occurred_at", to);

  try {
    const { data, error } = await withTimeout(query, "eventsForMonths");
    if (error)
      return {
        days: new Map(),
        error: describeFailure(error, "eventsForMonths"),
      };
    return { days: summariseMonth(data ?? []), error: null };
  } catch (cause) {
    return {
      days: new Map(),
      error: describeFailure(cause, "eventsForMonths"),
    };
  }
}

export async function deleteEvent(
  id: string,
): Promise<{ error: string | null }> {
  const query = supabase.from("pet_events").delete().eq("id", id);

  try {
    const { error } = await withTimeout(query, "deleteEvent");
    return { error: error ? describeFailure(error, "deleteEvent") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "deleteEvent") };
  }
}
