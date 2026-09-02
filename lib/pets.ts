import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type PetRow = Database["public"]["Tables"]["pets"]["Row"];

export type PetDraft = {
  name: string;
  sex: "male" | "female" | null;
  breedPrimary: string | null;
  isMixed: boolean;
  birthDate: string | null; // YYYY-MM-DD
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
    errors.name = "El nombre es obligatorio";
  }

  if (!draft.sex) {
    errors.sex = "Indica el sexo";
  }

  if (draft.birthDate !== null) {
    if (!ISO_DATE.test(draft.birthDate)) {
      errors.birthDate = "Usa el formato AAAA-MM-DD";
    } else {
      const parsed = new Date(`${draft.birthDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.birthDate = "Fecha no válida";
      } else if (parsed.getTime() > today.getTime()) {
        errors.birthDate = "La fecha no puede ser futura";
      }
    }
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
      breed_secondary: null,
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
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return { pet: null, error: error.message };
  }

  return { pet: data, error: null };
}
