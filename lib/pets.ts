import { meansMixedBreed, MIXED_BREED_LABEL } from "./breeds";
import { describeFailure, withTimeout } from "./failures";
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
  /**
   * Null until the tutor chooses. It used to default to "moderate", which the
   * database then stored as if it had been answered — the same failure the
   * `spayedNeutered` tri-state exists to avoid. Requires
   * `0004_activity_level_optional.sql`: without it the column is
   * `not null default 'moderate'` and the RPC coalesces a missing value, so a
   * null here still lands as "moderate".
   */
  activityLevel: "low" | "moderate" | "high" | null;
};

/**
 * Everything the profile can change: the registration draft plus the fields
 * that were never worth asking for at signup.
 *
 * `exerciseGoalMinutes` lives here rather than in `PetDraft` because
 * registration does not ask for it — a tutor cannot set a daily target for a
 * dog they are still introducing — and the create RPC has no argument for it.
 * The column keeps its null until this screen sets one.
 */
export type PetEdit = PetDraft & {
  exerciseGoalMinutes: number | null;
};

/** The longest daily exercise target the form will accept, in minutes. */
export const MAX_EXERCISE_GOAL_MINUTES = 300;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One validator for both forms.
 *
 * Takes the union rather than the base type so a `PetEdit` literal is accepted
 * as itself: registration has no exercise goal to check, the profile does, and
 * two validators would be two places for the required fields to drift apart.
 */
export function validatePetDraft(
  draft: PetDraft | PetEdit,
  today: Date = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.name.trim()) {
    // A question is friendlier than a regulation and says the same thing:
    // the field is empty and the form needs it filled.
    errors.name = "¿Cómo se llama?";
  }

  // Sex is deliberately not required, and neither is breed. Nothing in v0
  // reads either one: sex becomes useful later for adult-weight estimation in
  // nutrition and for tracking heat cycles in females, breed for the
  // percentile weight band. Blocking a registration on data the app cannot yet
  // use would be asking for it to satisfy a constraint rather than a need.
  //
  // Requires `0003_sex_optional.sql`: `pets.sex` was `not null` in the initial
  // schema, so without that migration this validation passes and the database
  // rejects the insert.

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
  // dropping it, say so — the tutor typed it deliberately. "Mixed" counts the
  // typed form too, so this layer and the RPC boundary below agree on what
  // makes a dog mixed.
  if (draft.breedSecondary && !isMixedDraft(draft)) {
    errors.breedSecondary = 'Marca "Es mestizo" para poder añadir otra raza';
  }

  // A goal is a number of minutes, so the two ways to get it wrong are a
  // non-number and a number nobody walks. Five hours is the ceiling: past it
  // the tutor has mistyped rather than trained an Iditarod team.
  const goal =
    "exerciseGoalMinutes" in draft ? draft.exerciseGoalMinutes : undefined;
  if (goal !== undefined && goal !== null) {
    if (!Number.isInteger(goal) || goal <= 0) {
      errors.exerciseGoalMinutes = "¿Cuántos minutos al día?";
    } else if (goal > MAX_EXERCISE_GOAL_MINUTES) {
      errors.exerciseGoalMinutes = `Como mucho ${MAX_EXERCISE_GOAL_MINUTES} minutos`;
    }
  }

  return errors;
}

/**
 * Whether the form should show the dog as mixed.
 *
 * The checkbox and the breed field are two faces of one fact, and both the
 * onboarding form and the profile form have to agree on it — so the coupling
 * lives here, unit-tested, rather than being re-derived in each screen. That is
 * the part of a duplicated form that actually hurts when it drifts; the layout
 * around it is inert.
 */
export function isMixedShown(draft: PetDraft): boolean {
  return draft.isMixed || meansMixedBreed(draft.breedPrimary);
}

/**
 * The draft after ticking or unticking "Es mestizo".
 *
 * Ticking writes the word into the breed field; unticking takes it away again
 * rather than leaving a breed nobody typed. A breed the tutor did type is left
 * alone, because unticking is not a reason to lose it.
 */
export function withMixed<T extends PetDraft>(draft: T, next: boolean): T {
  return {
    ...draft,
    isMixed: next,
    breedPrimary: next
      ? MIXED_BREED_LABEL
      : meansMixedBreed(draft.breedPrimary)
        ? null
        : draft.breedPrimary,
    breedSecondary: null,
  };
}

/** The editable shape of a stored pet, for the profile form's initial state. */
export function petEditFromRow(row: PetRow): PetEdit {
  return {
    name: row.name,
    sex: row.sex === "male" || row.sex === "female" ? row.sex : null,
    breedPrimary: row.breed_primary,
    breedSecondary: row.breed_secondary,
    isMixed: row.is_mixed,
    birthDate: row.birth_date,
    birthDateApproximate: row.birth_date_approximate,
    spayedNeutered: row.spayed_neutered,
    activityLevel:
      row.activity_level === "low" ||
      row.activity_level === "moderate" ||
      row.activity_level === "high"
        ? row.activity_level
        : null,
    exerciseGoalMinutes: row.exercise_goal_minutes,
  };
}

/**
 * Whether the draft describes a mixed dog, by the flag or by the breed field.
 *
 * Both readings have to agree: validation refuses a second breed on a dog that
 * is not marked mixed, and the payload builder drops one for the same reason.
 * If only one of them recognised a typed "Mestizo", a draft could pass
 * validation and lose data on the way out, or vice versa.
 */
function isMixedDraft(draft: PetDraft): boolean {
  return draft.isMixed || meansMixedBreed(draft.breedPrimary);
}

export async function createPet(
  draft: PetDraft,
): Promise<{ petId: string | null; error: string | null }> {
  const errors = validatePetDraft(draft);
  const firstError = Object.values(errors)[0];
  if (firstError) {
    return { petId: null, error: firstError };
  }

  // "Mestizo" is an answer to the breed question, not a breed, and the field
  // takes free text — so the tutor can reach here having typed it past the
  // offer to record it as the flag. Normalising at the boundary keeps the same
  // fact in one place: `is_mixed`, with no breed named. Nothing is lost, since
  // a mixed dog with no breeds reads back as "Mestizo" anyway.
  const typedMixed = meansMixedBreed(draft.breedPrimary);
  const isMixed = isMixedDraft(draft);
  const breedPrimary = typedMixed ? null : draft.breedPrimary;

  const call = supabase.rpc("create_pet_with_owner", {
    pet: {
      name: draft.name.trim(),
      sex: draft.sex,
      breed_primary: breedPrimary,
      breed_secondary: isMixed ? draft.breedSecondary : null,
      is_mixed: isMixed,
      birth_date: draft.birthDate,
      birth_date_approximate: draft.birthDateApproximate,
      spayed_neutered: draft.spayedNeutered,
      activity_level: draft.activityLevel,
    },
  });

  // Bounded, and the failure answers in the app's voice: a save that never
  // comes back is indistinguishable from a hang, and the transport's own
  // message names neither the problem nor the recovery.
  try {
    const { data, error } = await withTimeout(call, "create_pet_with_owner");
    if (error)
      return { petId: null, error: describeFailure(error, "createPet") };
    return { petId: (data as { id: string }).id, error: null };
  } catch (cause) {
    return { petId: null, error: describeFailure(cause, "createPet") };
  }
}

/**
 * Saves an edit to a pet that already exists.
 *
 * Deliberately not the create RPC's twin: creation is atomic across two tables
 * and needs a `security definer` function, while an update touches one row that
 * RLS already guards — `pets writable by their owners`, hardened in
 * `0002_harden_update_policies.sql` with the `WITH CHECK` that stops an owner
 * handing their pet to someone else. A plain `update` is the whole job.
 *
 * The mixed-breed normalisation is the same one `createPet` applies, so the
 * word "Mestizo" cannot enter `breed_primary` through this door either.
 */
export async function updatePet(
  petId: string,
  edit: PetEdit,
): Promise<{ error: string | null }> {
  const errors = validatePetDraft(edit);
  const firstError = Object.values(errors)[0];
  if (firstError) {
    return { error: firstError };
  }

  const typedMixed = meansMixedBreed(edit.breedPrimary);
  const isMixed = isMixedDraft(edit);

  const query = supabase
    .from("pets")
    .update({
      name: edit.name.trim(),
      sex: edit.sex,
      breed_primary: typedMixed ? null : edit.breedPrimary,
      breed_secondary: isMixed ? edit.breedSecondary : null,
      is_mixed: isMixed,
      birth_date: edit.birthDate,
      birth_date_approximate: edit.birthDateApproximate,
      spayed_neutered: edit.spayedNeutered,
      activity_level: edit.activityLevel,
      exercise_goal_minutes: edit.exerciseGoalMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", petId);

  try {
    const { error } = await withTimeout(query, "updatePet");
    return { error: error ? describeFailure(error, "updatePet") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "updatePet") };
  }
}

/**
 * Deletes a pet, and with it every row that hangs off it.
 *
 * `pet_owners.pet_id` cascades, so the membership goes with the animal and no
 * orphan can outlive it. The photo in storage does not cascade — Postgres has
 * no foreign key into the object store — so the caller removes it first; a
 * missed one is a file nobody can read, since the storage policies resolve
 * ownership through `pet_owners`, which is already gone.
 */
export async function deletePet(
  petId: string,
): Promise<{ error: string | null }> {
  const query = supabase.from("pets").delete().eq("id", petId);

  try {
    const { error } = await withTimeout(query, "deletePet");
    return { error: error ? describeFailure(error, "deletePet") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "deletePet") };
  }
}

/**
 * Writes only the photo column.
 *
 * Separate from `updatePet` because the photo is not part of the form's draft:
 * it is stored the moment it is picked, so a tutor who changes the picture and
 * then walks away from the form still has the picture. Folding it into the
 * draft would make an unsaved form able to lose it — or, worse, make picking a
 * photo commit every other edit on screen.
 */
export async function updatePetPhoto(
  petId: string,
  path: string | null,
): Promise<{ error: string | null }> {
  const query = supabase
    .from("pets")
    .update({ photo_url: path, updated_at: new Date().toISOString() })
    .eq("id", petId);

  try {
    const { error } = await withTimeout(query, "updatePetPhoto");
    return { error: error ? describeFailure(error, "updatePetPhoto") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "updatePetPhoto") };
  }
}

export async function getMyPet(): Promise<{
  pet: PetRow | null;
  error: string | null;
}> {
  // Explicit ordering: without it, `limit(1)` picks an arbitrary row once the
  // account has more than one pet, so "the" pet would differ between calls.
  const query = supabase
    .from("pets")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  try {
    const { data, error } = await withTimeout(query, "getMyPet");
    if (error) return { pet: null, error: describeFailure(error, "getMyPet") };
    return { pet: data, error: null };
  } catch (cause) {
    return { pet: null, error: describeFailure(cause, "getMyPet") };
  }
}
