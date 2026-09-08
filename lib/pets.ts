import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type PetRow = Database["public"]["Tables"]["pets"]["Row"];

export type PetDraft = {
  name: string;
  sex: "male" | "female" | null;
  breedPrimary: string | null;
  /**
   * The second breed of a mixed dog. Only meaningful when `isMixed` is true —
   * the column existed from the initial migration but was hardcoded to null,
   * so a record could say "mixed" and still name only one breed.
   */
  breedSecondary: string | null;
  isMixed: boolean;
  /** Always ISO `YYYY-MM-DD`; build it with `lib/dates.ts`, never by hand. */
  birthDate: string | null;
  birthDateApproximate: boolean;
  spayedNeutered: boolean | null;
  activityLevel: "low" | "moderate" | "high";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePetDraft(
  draft: PetDraft,
  today: Date = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.name.trim()) {
    // A question is friendlier than a regulation and says the same thing:
    // the field is empty and the form needs it filled.
    errors.name = "¿Cómo se llama?";
  }

  // Sex stays required. It was briefly made optional on the reasoning that it
  // is an identification datum like breed, but `pets.sex` is `not null` in the
  // initial schema, so the app cannot relax it without a migration — and
  // relaxing it here alone produces a save the database rejects. Revisit
  // together with that migration, not before.
  if (!draft.sex) {
    errors.sex = "¿Cómo se identifica?";
  }

  // The birth date is required, unlike the fields that only matter once a
  // tutor cares about weight or nutrition: many later flows depend on it from
  // the start, and it anchors the vaccine and deworming due dates. An
  // approximate date is still a date — the picker collects month and year and
  // pins the day to the 1st, which `birthDateApproximate` marks as a
  // placeholder rather than a fact.
  if (!draft.birthDate) {
    errors.birthDate = "¿Cuándo nació?";
  } else {
    if (!ISO_DATE.test(draft.birthDate)) {
      errors.birthDate = "Esa fecha no existe";
    } else {
      const parsed = new Date(`${draft.birthDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.birthDate = "Esa fecha no existe";
      } else if (parsed.getTime() > today.getTime()) {
        // A question treats a future date as the slip it almost always is,
        // rather than as a rule the tutor broke.
        errors.birthDate = "¿Aún no ha nacido?";
      }
    }
  }

  // A second breed only means something on a mixed dog. Rather than silently
  // dropping it, say so — the tutor typed it deliberately.
  if (draft.breedSecondary && !draft.isMixed) {
    errors.breedSecondary = "Marca \"Es mestizo\" para poder añadir otra raza";
  }

  return errors;
}

export async function createPet(
  draft: PetDraft,
): Promise<{ petId: string | null; error: string | null }> {
  const errors = validatePetDraft(draft);
  const firstError = Object.values(errors)[0];
  if (firstError) {
    return { petId: null, error: firstError };
  }

  const { data, error } = await supabase.rpc("create_pet_with_owner", {
    pet: {
      name: draft.name.trim(),
      sex: draft.sex,
      breed_primary: draft.breedPrimary,
      breed_secondary: draft.isMixed ? draft.breedSecondary : null,
      is_mixed: draft.isMixed,
      birth_date: draft.birthDate,
      birth_date_approximate: draft.birthDateApproximate,
      spayed_neutered: draft.spayedNeutered,
      activity_level: draft.activityLevel,
    },
  });

  if (error) {
    return { petId: null, error: error.message };
  }

  return { petId: (data as { id: string }).id, error: null };
}

export async function getMyPet(): Promise<{
  pet: PetRow | null;
  error: string | null;
}> {
  // Explicit ordering: without it, `limit(1)` picks an arbitrary row once the
  // account has more than one pet, so "the" pet would differ between calls.
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { pet: null, error: error.message };
  }

  return { pet: data, error: null };
}
