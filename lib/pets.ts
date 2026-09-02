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
