import type { Database } from "./database.types";
import { parseISO, toISO } from "./dates";
import { describeFailure, withTimeout } from "./failures";
import { supabase } from "./supabase";

/**
 * Vaccines, deworming and antiparasitics — and when the next one is due.
 *
 * **The next date is stored, not computed.** The vet says "in three months"
 * and that instruction is the fact; an app that recalculated it from an
 * interval would quietly overrule a professional who had a reason. The form
 * *proposes* a date from the interval below so that nobody types one on an
 * ordinary visit, and the row keeps whatever was confirmed.
 */

export type PetTreatmentRow =
  Database["public"]["Tables"]["pet_treatments"]["Row"];

export type TreatmentKind = "vaccine" | "deworming" | "antiparasitic";

export const TREATMENT_KINDS: TreatmentKind[] = [
  "vaccine",
  "deworming",
  "antiparasitic",
];

const LABELS: Record<TreatmentKind, string> = {
  vaccine: "Vacuna",
  deworming: "Desparasitación",
  antiparasitic: "Antiparasitario",
};

export function treatmentLabel(kind: TreatmentKind): string {
  return LABELS[kind];
}

/**
 * What the form proposes for the next one, in days.
 *
 * The adult schedule, which is the one that repeats for years: a yearly
 * booster, internal deworming every three months, an external antiparasitic
 * monthly. **A proposal, never a rule** — a puppy's first year runs on its own
 * calendar and the vet may say something else entirely, so the date lands in
 * an editable field rather than in the row.
 */
export const TREATMENT_INTERVAL_DAYS: Record<TreatmentKind, number> = {
  vaccine: 365,
  deworming: 90,
  antiparasitic: 30,
};

/** How far ahead something stops being "later" and starts being "soon". */
export const DUE_SOON_DAYS = 14;

export type NewTreatment = {
  kind: TreatmentKind;
  /** "Polivalente", "Milbemax", "Seresto" — optional, and often unremembered. */
  name?: string | null;
  administeredOn: Date;
  /** Null is a real answer: a one-off with nothing scheduled after it. */
  nextDueOn?: Date | null;
  note?: string | null;
};

/** An ISO `YYYY-MM-DD` from a local Date, which is what a `date` column takes. */
export function dateKey(day: Date): string {
  return toISO({
    year: day.getFullYear(),
    month: day.getMonth() + 1,
    day: day.getDate(),
  });
}

/**
 * A local Date at midnight from an ISO day.
 *
 * Not `new Date("2026-09-11")`, which the language reads as **UTC midnight** —
 * an hour behind Madrid, so the day comes out as the 10th every evening east
 * of Greenwich. The same trap the calendar's cells hit from the other side.
 */
export function fromDateKey(iso: string): Date | null {
  const parts = parseISO(iso);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

/**
 * `days` after `from`, as a local date.
 *
 * Built from the calendar parts rather than by adding milliseconds: the clocks
 * move twice a year, and 90 days of 86,400,000ms across the October change
 * lands an hour early — which is the previous day, and therefore the wrong
 * date on the one field this module exists to get right.
 */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}

/** Whole days from `from` to `to`, negative when `to` is already past. */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** The date the form offers for the next one. */
export function proposeNextDue(
  kind: TreatmentKind,
  administeredOn: Date,
): Date {
  return addDays(administeredOn, TREATMENT_INTERVAL_DAYS[kind]);
}

export type DueStatus = "overdue" | "soon" | "later";

export function dueStatus(nextDueOn: string, today: Date): DueStatus | null {
  const due = fromDateKey(nextDueOn);
  if (!due) return null;
  const days = daysBetween(today, due);
  if (days < 0) return "overdue";
  return days <= DUE_SOON_DAYS ? "soon" : "later";
}

/**
 * The key a schedule belongs to.
 *
 * **Not the kind alone.** "Rabia" and "Polivalente" are both vaccines and they
 * run on different clocks, so grouping by kind would let whichever was given
 * last silently replace the other's due date — and the one it replaced is the
 * one nobody would be reminded about. The pair is the schedule; a treatment
 * with no name is its kind's only unnamed schedule.
 */
export function scheduleKey(row: {
  kind: string;
  name: string | null;
}): string {
  return `${row.kind}·${(row.name ?? "").trim().toLocaleLowerCase("es")}`;
}

/**
 * What is actually pending, soonest first.
 *
 * Only the **latest** administration of each schedule counts: last year's
 * booster is history the moment this year's is logged, and listing both would
 * put a date from 2025 permanently at the top of a screen whose whole job is
 * saying what is coming. Rows with no next date never appear — a one-off is
 * not pending, it is done.
 */
export function pending(rows: PetTreatmentRow[]): PetTreatmentRow[] {
  const latest = new Map<string, PetTreatmentRow>();

  for (const row of rows) {
    const key = scheduleKey(row);
    const held = latest.get(key);
    if (!held || row.administered_on > held.administered_on) {
      latest.set(key, row);
    }
  }

  return [...latest.values()]
    .filter((row) => row.next_due_on !== null)
    .sort((a, b) => (a.next_due_on ?? "").localeCompare(b.next_due_on ?? ""));
}

export function validateTreatment(
  treatment: NewTreatment,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (
    treatment.nextDueOn &&
    daysBetween(treatment.administeredOn, treatment.nextDueOn) < 0
  ) {
    errors.nextDueOn = "La próxima no puede ser antes que esta";
  }

  return errors;
}

function payload(petId: string, treatment: NewTreatment) {
  return {
    pet_id: petId,
    kind: treatment.kind,
    name: treatment.name?.trim() || null,
    administered_on: dateKey(treatment.administeredOn),
    next_due_on: treatment.nextDueOn ? dateKey(treatment.nextDueOn) : null,
    note: treatment.note?.trim() || null,
  };
}

export async function logTreatment(
  petId: string,
  treatment: NewTreatment,
): Promise<{ error: string | null }> {
  const firstError = Object.values(validateTreatment(treatment))[0];
  if (firstError) return { error: firstError };

  const query = supabase
    .from("pet_treatments")
    .insert(payload(petId, treatment));

  try {
    const { error } = await withTimeout(query, "logTreatment");
    return { error: error ? describeFailure(error, "logTreatment") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "logTreatment") };
  }
}

/** A correction, not a new fact: the row keeps its id and its `created_by`. */
export async function updateTreatment(
  id: string,
  petId: string,
  treatment: NewTreatment,
): Promise<{ error: string | null }> {
  const firstError = Object.values(validateTreatment(treatment))[0];
  if (firstError) return { error: firstError };

  const query = supabase
    .from("pet_treatments")
    .update(payload(petId, treatment))
    .eq("id", id);

  try {
    const { error } = await withTimeout(query, "updateTreatment");
    return { error: error ? describeFailure(error, "updateTreatment") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "updateTreatment") };
  }
}

/**
 * Every treatment, most recent first.
 *
 * The whole history in one request rather than a page: a dog accumulates a
 * handful of these a year, and `pending` has to see all of them to know which
 * administration of each schedule is the current one.
 */
export async function treatmentsFor(
  petId: string,
): Promise<{ treatments: PetTreatmentRow[]; error: string | null }> {
  const query = supabase
    .from("pet_treatments")
    .select("*")
    .eq("pet_id", petId)
    .order("administered_on", { ascending: false });

  try {
    const { data, error } = await withTimeout(query, "treatmentsFor");
    if (error)
      return { treatments: [], error: describeFailure(error, "treatmentsFor") };
    return { treatments: data ?? [], error: null };
  } catch (cause) {
    return { treatments: [], error: describeFailure(cause, "treatmentsFor") };
  }
}

export async function deleteTreatment(
  id: string,
): Promise<{ error: string | null }> {
  const query = supabase.from("pet_treatments").delete().eq("id", id);

  try {
    const { error } = await withTimeout(query, "deleteTreatment");
    return { error: error ? describeFailure(error, "deleteTreatment") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "deleteTreatment") };
  }
}
