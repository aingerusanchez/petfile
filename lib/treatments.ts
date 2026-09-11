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

/**
 * The words on screen.
 *
 * **The qualifier is load-bearing.** Bare, "Desparasitación" and
 * "Antiparasitario" name the same idea twice to anybody who has not had the
 * vet explain it — the pipette on the neck against the pill for worms — and
 * the tutor who asked for this could not tell them apart either. Int./Ext. is
 * the contrast in the fewest characters, which keeps the three kinds on one
 * row of chips; the brand names in the field below carry the rest of the
 * teaching, because "Seresto" and "Milbemax" are what a tutor actually
 * recognises.
 */
const LABELS: Record<TreatmentKind, string> = {
  vaccine: "Vacuna",
  deworming: "Desparasitación (Int.)",
  antiparasitic: "Antiparasitario (Ext.)",
};

/**
 * What to write in the name field, per kind.
 *
 * **The examples are the other half of the label.** "(Int.)" says which of the
 * two this is in two letters; "Milbemax, Drontal" says it in the words off the
 * box in the cupboard. A tutor who has never heard "endoparásito" has
 * absolutely heard of the pipette they put on the dog's neck last month.
 */
const NAME_EXAMPLES: Record<TreatmentKind, string> = {
  vaccine: "Polivalente, Rabia…",
  deworming: "Milbemax, Drontal… (giardias, lombrices)",
  antiparasitic: "Seresto, Frontline… (pulgas, garrapatas)",
};

export function treatmentNameExamples(kind: TreatmentKind): string {
  return NAME_EXAMPLES[kind];
}

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

/**
 * The interval in words: "cada 3 meses".
 *
 * **Derived from the same constant that fills the date, never typed beside
 * it.** A hint reading "cada 3 meses" next to a 90 somebody later changes to
 * 120 is worse than no hint at all — it would be the app stating a schedule it
 * no longer follows, on the one screen whose job is remembering schedules.
 *
 * It says what is *usual*, not what is set, so it stays true after the tutor
 * overrules the proposal: the vet's own instruction wins on the field above
 * and this still answers "how often is this normally?".
 */
export function treatmentCadence(kind: TreatmentKind): string {
  const days = TREATMENT_INTERVAL_DAYS[kind];

  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "cada año" : `cada ${years} años`;
  }

  const months = Math.round(days / 30);
  if (months >= 1) return months === 1 ? "cada mes" : `cada ${months} meses`;
  return days === 1 ? "cada día" : `cada ${days} días`;
}

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
 * The key a schedule belongs to, and it is not the same question for all three.
 *
 * **A vaccine is a disease; a deworming is a habit.** Rabia and Pentavalente
 * protect against different things on different clocks, so replacing one with
 * the other would drop a reminder nobody would miss until it was a year late —
 * the name is part of the schedule there. But "Panacur", "Panacur 500mg" and
 * "Milbemax" are not three schedules: they are whatever the vet handed over
 * that month for *the internal deworming*, which is one habit with one clock.
 *
 * **This was keyed on the name for all three, and a real year of records
 * showed what that costs.** Nine months of a puppy's history put five rows in
 * "lo que toca", three of them the same internal deworming under three product
 * names, one of those shouting in red that it had expired in April — five
 * months after the dose that had already replaced it. A superseded record
 * claiming to be pending is worse than no reminder at all: it teaches the
 * tutor to distrust the section that exists to be trusted.
 */
export function scheduleKey(row: {
  kind: string;
  name: string | null;
}): string {
  if (row.kind !== "vaccine") return row.kind;
  return `vaccine·${(row.name ?? "").trim().toLocaleLowerCase("es")}`;
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
