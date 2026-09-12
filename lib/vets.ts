import type { Database } from "./database.types";
import { describeFailure, withTimeout } from "./failures";
import { supabase } from "./supabase";

/**
 * The two clinics, and how to reach them.
 *
 * **`jsonb` and not columns, by the rule the rest of the schema follows.** The
 * app computes nothing from a vet: it lists a name, dials a number and opens a
 * map. What it *does* is grow — a second phone, an appointment, a chip number
 * the clinic asked for — and a shape that grows without a migration is what
 * `jsonb` is for. See `0001_initial_schema.sql`.
 *
 * **Two, always, and never more.** "Regular" and "urgencias" are not a list
 * with two entries in it; they are two questions a tutor asks in two different
 * states of mind. Often the same clinic answers both, and writing it twice is
 * cheaper than a flag that has to be read before either can be shown.
 */

export type PetRow = Database["public"]["Tables"]["pets"]["Row"];

/** Which of the two a card is. */
export type VetKind = "primary" | "emergency";

export const VET_KINDS: VetKind[] = ["primary", "emergency"];

const LABELS: Record<VetKind, string> = {
  // **"Veterinaria" is the clinic, not the person.** The card's own field asks
  // for "la veterinaria o el veterinario" you ask for by name; this names the
  // practice — la clínica veterinaria — which is what the tab switches between
  // and what the household calls it.
  primary: "Veterinaria",
  emergency: "Urgencias",
};

export function vetLabel(kind: VetKind): string {
  return LABELS[kind];
}

/**
 * What the toast says once it is saved.
 *
 * Spelled out per kind rather than built as `${label} guardado`, which
 * produced "Urgencias guardado" — the app talking about a feminine plural in
 * the masculine singular. A template that has to agree with the gender and
 * number of whatever is dropped into it is a template that will be wrong
 * again the next time a label is added.
 */
const SAVED: Record<VetKind, string> = {
  primary: "Veterinaria guardada",
  emergency: "Urgencias guardadas",
};

export function vetSaved(kind: VetKind): string {
  return SAVED[kind];
}

/** The column each one lives in. */
export function vetColumn(kind: VetKind): "vet_primary" | "vet_emergency" {
  return kind === "primary" ? "vet_primary" : "vet_emergency";
}

export type Vet = {
  /** The clinic: "Clínica Veterinaria Los Burros". */
  clinic: string;
  /** The person, when there is one you ask for. */
  vet: string;
  phone: string;
  address: string;
  /**
   * Free text, over as many lines as the clinic has different days, rendered
   * as Markdown. Nobody computes from it.
   */
  hours: string;
};

export const EMPTY_VET: Vet = {
  clinic: "",
  vet: "",
  phone: "",
  address: "",
  hours: "",
};

/**
 * Reads one card out of the pet's row.
 *
 * Everything is optional and everything arrives as `unknown`, so a field that
 * is not a string is a field that is not there — a card half-written by an
 * older version of the app should render the half that exists rather than
 * throw on the half that does not.
 */
export function readVet(value: unknown): Vet {
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: keyof Vet) =>
    typeof raw[key] === "string" ? (raw[key] as string).trim() : "";

  return {
    clinic: text("clinic"),
    vet: text("vet"),
    phone: text("phone"),
    address: text("address"),
    hours: text("hours"),
  };
}

/** Whether there is anything to show. */
export function hasVet(vet: Vet): boolean {
  return Object.values(vet).some((value) => value.trim().length > 0);
}

/**
 * What goes into the column.
 *
 * Empty fields are dropped rather than stored as `""`: a card cleared back to
 * nothing should read as `null` to `hasVet`, not as an object full of blanks
 * that renders an empty row for every one of them.
 */
export function writeVet(vet: Vet): Record<string, string> | null {
  const kept = Object.entries(vet).reduce<Record<string, string>>(
    (out, [key, value]) => {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
      return out;
    },
    {},
  );
  return Object.keys(kept).length > 0 ? kept : null;
}

/**
 * A Spanish number, grouped the way a Spanish number is written.
 *
 * **3-2-2-2, which is how both of the clinics on the fridge are written.**
 * "944 26 00 51" is the shape people read a landline in, and a nine-digit run
 * with no spaces is the shape a phone's contact list hands you — the grouping
 * is what turns one into the other.
 *
 * **Anything that is not nine digits is returned untouched.** An international
 * number, an extension, a clinic that wrote two numbers in one field: all of
 * them are somebody's real answer, and a formatter that reshaped them would be
 * guessing at a convention it does not know. A `+34` prefix keeps its place
 * and the nine behind it still group.
 */
export function formatPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";

  // **The national number is the last nine digits, not the ones after a
  // prefix of guessed length.** Matching `+\d{1,3}` greedily ate the first
  // digit of the number itself — "+34944260051" became a "+349" prefix and an
  // eight-digit rest, which then failed the check and rendered unformatted.
  // Counting from the end needs to know nothing about which country it is.
  const digits = trimmed.replace(/\D/g, "");
  const international = trimmed.startsWith("+");

  if (digits.length < 9) return trimmed;
  if (digits.length > 9 && !international) return trimmed;

  const national = digits.slice(-9);
  const prefix = international ? `+${digits.slice(0, -9)} ` : "";
  const grouped = `${national.slice(0, 3)} ${national.slice(
    3,
    5,
  )} ${national.slice(5, 7)} ${national.slice(7, 9)}`;

  return `${prefix}${grouped}`;
}

/**
 * The number, ready to dial.
 *
 * **No country code is invented.** "944 26 00 51" dials from a Spanish SIM
 * exactly as written, and prefixing +34 to a number somebody typed without one
 * is the app guessing at which country the phone is in — wrong once and the
 * call fails at the moment it matters most. A number typed *with* a prefix
 * keeps it.
 */
export function telHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `tel:${plus}${digits}` : null;
}

/**
 * The address, ready to open.
 *
 * Google's documented cross-platform search URL rather than a `geo:` intent:
 * `geo:` needs coordinates to be useful and a typed address has none, while
 * this hands the text to whichever maps app the phone actually uses.
 */
export function mapsHref(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    trimmed,
  )}`;
}

/**
 * Writes one card, leaving the other and the rest of the pet alone.
 *
 * A patch rather than `updatePet`: that one takes the whole registration draft
 * and validates it, so saving a phone number would mean sending the dog's
 * breed and birth date back with it — and failing on a pet whose form has
 * something else wrong with it.
 */
export async function saveVet(
  petId: string,
  kind: VetKind,
  vet: Vet,
): Promise<{ error: string | null }> {
  // Spelled out per kind rather than with a computed key: a computed one
  // widens the patch to an index signature, and the generated types reject
  // any object that could carry a column they do not know about.
  const value = writeVet(
    vet,
  ) as Database["public"]["Tables"]["pets"]["Update"]["vet_primary"];
  const patch =
    kind === "primary" ? { vet_primary: value } : { vet_emergency: value };

  const query = supabase.from("pets").update(patch).eq("id", petId);

  try {
    const { error } = await withTimeout(query, "saveVet");
    return { error: error ? describeFailure(error, "saveVet") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "saveVet") };
  }
}
