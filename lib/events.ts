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
    .order("occurred_at", { ascending: false });

  try {
    const { data, error } = await withTimeout(query, "eventsForDay");
    if (error)
      return { events: [], error: describeFailure(error, "eventsForDay") };
    return { events: data ?? [], error: null };
  } catch (cause) {
    return { events: [], error: describeFailure(cause, "eventsForDay") };
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
