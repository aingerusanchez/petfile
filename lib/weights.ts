import type { Database } from "./database.types";
import { toISO } from "./dates";
import { describeFailure, withTimeout } from "./failures";
import { supabase } from "./supabase";

/**
 * The weight line.
 *
 * **A date, not an instant, and one value per day.** Nobody cares that the
 * scale happened at 19:42, and weighing him twice on a Tuesday is a correction
 * rather than two data points — the table says so with a unique constraint, so
 * saving upserts rather than inserts. A tutor who reweighs because the first
 * number looked wrong gets the number they meant, not a zigzag in the line.
 *
 * **Grams in the row, kilograms on the screen.** The column is an integer
 * because a float weight is a rounding argument waiting to happen; the display
 * side rounds to one decimal, which is what a household scale reads and what
 * anybody says out loud.
 */

export type PetWeightRow = Database["public"]["Tables"]["pet_weights"]["Row"];

/** Matches the CHECK constraint: 200kg, which no dog reaches. */
export const MAX_GRAMS = 200000;

export type NewWeight = {
  /** The day it was measured, local. */
  measuredOn: Date;
  grams: number;
  note?: string | null;
};

/**
 * Kilograms from what somebody typed, in grams.
 *
 * **Both separators, because a phone gives you whichever it gives you.** The
 * Spanish keyboard's decimal key is a comma and the numeric pad's is a full
 * stop, and the same tutor hits both depending on which field opened which
 * keyboard. Rejecting one of them would be rejecting the number they meant.
 *
 * Null is "not a weight yet", which is what a half-typed "12," is — the same
 * rule the walk's duration follows, and for the same reason: a real keyboard
 * fires one change per key, so everything on the way to a number arrives here
 * first.
 */
export function parseWeight(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(cleaned)) return null;

  const kilos = Number(cleaned);
  if (!Number.isFinite(kilos) || kilos <= 0) return null;

  const grams = Math.round(kilos * 1000);
  return grams > 0 && grams <= MAX_GRAMS ? grams : null;
}

/** "12,4 kg" — one decimal, the comma this locale writes. */
export function formatWeight(grams: number): string {
  const kilos = grams / 1000;
  const rounded = Math.round(kilos * 10) / 10;
  return `${rounded.toFixed(1).replace(".", ",")} kg`;
}

/** What the field shows when it opens on an existing weight: "12,4". */
export function weightInput(grams: number): string {
  return (Math.round(grams / 100) / 10).toFixed(1).replace(".", ",");
}

/**
 * The difference against the measurement before it, in grams.
 *
 * Null when there is nothing to compare against, which is the first weigh-in
 * and is not a zero — "0 g" would claim he has not changed since a measurement
 * that does not exist.
 */
export function weightChange(
  rows: PetWeightRow[],
  at = 0,
): { grams: number; since: string } | null {
  const current = rows[at];
  const previous = rows[at + 1];
  if (!current || !previous) return null;
  return {
    grams: current.grams - previous.grams,
    since: previous.measured_on,
  };
}

/** "+300 g" / "−150 g" / "igual" — the sign is the message. */
export function formatChange(grams: number): string {
  if (grams === 0) return "igual";
  // A true minus sign, not a hyphen: it reads as arithmetic at this size and
  // a hyphen reads as a dash.
  const sign = grams > 0 ? "+" : "−";
  const magnitude = Math.abs(grams);
  return magnitude >= 1000
    ? `${sign}${formatWeight(magnitude)}`
    : `${sign}${magnitude} g`;
}

export function validateWeight(weight: NewWeight): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!Number.isInteger(weight.grams) || weight.grams <= 0) {
    errors.grams = "¿Cuánto pesa?";
  } else if (weight.grams > MAX_GRAMS) {
    errors.grams = "Eso son más de 200 kg";
  }

  return errors;
}

/** The ISO day a `date` column takes, from a local Date. */
export function measuredKey(day: Date): string {
  return toISO({
    year: day.getFullYear(),
    month: day.getMonth() + 1,
    day: day.getDate(),
  });
}

/**
 * Writes the weight for a day, replacing whatever that day already held.
 *
 * `upsert` on the pair, not an insert: the table's unique constraint would
 * reject the second one with a message about a constraint, and a tutor
 * correcting a typo has not done anything wrong.
 */
export async function saveWeight(
  petId: string,
  weight: NewWeight,
): Promise<{ error: string | null }> {
  const errors = validateWeight(weight);
  const firstError = Object.values(errors)[0];
  if (firstError) return { error: firstError };

  const query = supabase.from("pet_weights").upsert(
    {
      pet_id: petId,
      measured_on: measuredKey(weight.measuredOn),
      grams: weight.grams,
      note: weight.note?.trim() || null,
    },
    { onConflict: "pet_id,measured_on" },
  );

  try {
    const { error } = await withTimeout(query, "saveWeight");
    return { error: error ? describeFailure(error, "saveWeight") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "saveWeight") };
  }
}

/**
 * The line, newest first.
 *
 * Newest first because every reader of this list starts at the last weight —
 * the screen shows that one big, and the chart reverses what it needs. A limit
 * rather than the whole history: the line is a shape, not an archive, and a
 * dog weighed weekly for ten years is 520 rows nobody scrolls.
 */
export async function weightsFor(
  petId: string,
  limit = 60,
): Promise<{ weights: PetWeightRow[]; error: string | null }> {
  const query = supabase
    .from("pet_weights")
    .select("*")
    .eq("pet_id", petId)
    .order("measured_on", { ascending: false })
    .limit(limit);

  try {
    const { data, error } = await withTimeout(query, "weightsFor");
    if (error)
      return { weights: [], error: describeFailure(error, "weightsFor") };
    return { weights: data ?? [], error: null };
  } catch (cause) {
    return { weights: [], error: describeFailure(cause, "weightsFor") };
  }
}

export async function deleteWeight(
  id: string,
): Promise<{ error: string | null }> {
  const query = supabase.from("pet_weights").delete().eq("id", id);

  try {
    const { error } = await withTimeout(query, "deleteWeight");
    return { error: error ? describeFailure(error, "deleteWeight") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "deleteWeight") };
  }
}
