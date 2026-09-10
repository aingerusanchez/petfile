import {
  isMixedShown,
  MAX_EXERCISE_GOAL_MINUTES,
  petEditFromRow,
  validatePetDraft,
  withMixed,
  type PetDraft,
  type PetEdit,
  type PetRow,
} from "../pets";

const row: PetRow = {
  id: "pet-1",
  name: "Loki",
  species: "dog",
  sex: "male",
  breed_primary: "Husky Siberiano",
  breed_secondary: null,
  is_mixed: false,
  birth_date: "2025-09-14",
  birth_date_approximate: false,
  photo_url: null,
  spayed_neutered: false,
  activity_level: "high",
  exercise_goal_minutes: 60,
  vet_primary: null,
  vet_emergency: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const draft: PetDraft = {
  name: "Loki",
  sex: "male",
  breedPrimary: "Husky Siberiano",
  breedSecondary: null,
  isMixed: false,
  birthDate: "2025-09-14",
  birthDateApproximate: false,
  spayedNeutered: false,
  activityLevel: "high",
};

describe("petEditFromRow", () => {
  it("round-trips a stored pet into the form's shape", () => {
    expect(petEditFromRow(row)).toEqual({
      name: "Loki",
      sex: "male",
      breedPrimary: "Husky Siberiano",
      breedSecondary: null,
      isMixed: false,
      birthDate: "2025-09-14",
      birthDateApproximate: false,
      spayedNeutered: false,
      activityLevel: "high",
      exerciseGoalMinutes: 60,
    });
  });

  it("refuses a value the check constraint would allow but the app would not", () => {
    // The columns are plain text with a CHECK, so a row written by anything
    // other than this app can hold something the union does not cover. The
    // form has to land on "unanswered" rather than on an impossible state.
    const odd = { ...row, sex: "unknown", activity_level: "extreme" };
    const edit = petEditFromRow(odd);
    expect(edit.sex).toBeNull();
    expect(edit.activityLevel).toBeNull();
  });
});

describe("the mixed-breed coupling", () => {
  it("reads as mixed from either face of the fact", () => {
    expect(isMixedShown(draft)).toBe(false);
    expect(isMixedShown({ ...draft, isMixed: true })).toBe(true);
    expect(isMixedShown({ ...draft, breedPrimary: "mestizo" })).toBe(true);
  });

  it("writes the word when ticked and takes it away when unticked", () => {
    const ticked = withMixed(draft, true);
    expect(ticked.isMixed).toBe(true);
    expect(ticked.breedPrimary).toBe("Mestizo");

    const unticked = withMixed(ticked, false);
    expect(unticked.isMixed).toBe(false);
    expect(unticked.breedPrimary).toBeNull();
  });

  it("leaves a breed the tutor typed alone", () => {
    // Unticking is not a reason to lose "Husky Siberiano".
    const unticked = withMixed({ ...draft, isMixed: true }, false);
    expect(unticked.breedPrimary).toBe("Husky Siberiano");
  });

  it("drops the second breed either way", () => {
    const crossed = { ...draft, isMixed: true, breedSecondary: "Beagle" };
    expect(withMixed(crossed, true).breedSecondary).toBeNull();
    expect(withMixed(crossed, false).breedSecondary).toBeNull();
  });
});

describe("validatePetDraft, on the profile's extra field", () => {
  const edit: PetEdit = { ...draft, exerciseGoalMinutes: null };

  it("accepts no goal at all", () => {
    expect(validatePetDraft(edit)).toEqual({});
  });

  it("accepts a real number of minutes", () => {
    expect(validatePetDraft({ ...edit, exerciseGoalMinutes: 90 })).toEqual({});
  });

  it("asks again for zero, for a negative, and for a fraction", () => {
    for (const goal of [0, -30, 12.5]) {
      expect(
        validatePetDraft({ ...edit, exerciseGoalMinutes: goal }),
      ).toHaveProperty("exerciseGoalMinutes", "¿Cuántos minutos al día?");
    }
  });

  it("caps a mistyped goal", () => {
    const errors = validatePetDraft({
      ...edit,
      exerciseGoalMinutes: MAX_EXERCISE_GOAL_MINUTES + 1,
    });
    expect(errors.exerciseGoalMinutes).toBe(
      `Como mucho ${MAX_EXERCISE_GOAL_MINUTES} minutos`,
    );
  });

  it("still enforces everything registration enforced", () => {
    // The profile shares the validator, so the required fields stay required:
    // a tutor cannot empty a name here either.
    expect(validatePetDraft({ ...edit, name: "  " })).toHaveProperty("name");
    expect(validatePetDraft({ ...edit, birthDate: null })).toHaveProperty(
      "birthDate",
    );
  });
});
