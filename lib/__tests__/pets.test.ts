import {
  validatePetDraft,
  withApproximateBirthDate,
  type PetDraft,
} from "../pets";

// `pets` reaches for the client at module scope, so the mock has to be in
// place before it loads. `jest.mock` is hoisted above the imports by babel,
// which is what makes this order safe as well as lint-clean.
jest.mock("../supabase");

const valid: PetDraft = {
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

const today = new Date("2026-09-02T00:00:00Z");

describe("validatePetDraft", () => {
  it("accepts a complete draft", () => {
    expect(validatePetDraft(valid, today)).toEqual({});
  });

  it("requires a name", () => {
    expect(validatePetDraft({ ...valid, name: "   " }, today)).toHaveProperty(
      "name",
    );
  });

  // Only the name and the birth date block a save. Sex and breed are useful
  // later (adult-weight estimation, heat-cycle tracking, the percentile weight
  // band) but nothing in v0 reads them, so requiring them would be asking for
  // data to satisfy a constraint rather than a need. Needs 0003_sex_optional.
  it("does not require a sex", () => {
    expect(validatePetDraft({ ...valid, sex: null }, today)).toEqual({});
  });

  it("does not require an activity level", () => {
    expect(validatePetDraft({ ...valid, activityLevel: null }, today)).toEqual(
      {},
    );
  });

  it("does not require a breed", () => {
    expect(validatePetDraft({ ...valid, breedPrimary: null }, today)).toEqual(
      {},
    );
  });

  it("rejects a birth date in the future", () => {
    expect(
      validatePetDraft({ ...valid, birthDate: "2026-12-01" }, today),
    ).toHaveProperty("birthDate");
  });

  it("rejects an unparseable birth date", () => {
    expect(
      validatePetDraft({ ...valid, birthDate: "14/09/2025" }, today),
    ).toHaveProperty("birthDate");
  });

  // Changed by decision, not by drift: the birth date used to be optional.
  // It is required now because later flows depend on it from the start and it
  // anchors the vaccine and deworming due dates. An approximate date still
  // supplies one — month and year, with the day flagged as a placeholder.
  it("requires a birth date", () => {
    expect(
      validatePetDraft({ ...valid, birthDate: null }, today),
    ).toHaveProperty("birthDate");
  });

  it("accepts an approximate date pinned to the first of the month", () => {
    expect(
      validatePetDraft(
        { ...valid, birthDate: "2025-09-01", birthDateApproximate: true },
        today,
      ),
    ).toEqual({});
  });

  it("rejects a second breed unless the dog is marked mixed", () => {
    expect(
      validatePetDraft(
        { ...valid, breedSecondary: "Beagle", isMixed: false },
        today,
      ),
    ).toHaveProperty("breedSecondary");
  });

  it("accepts a second breed on a mixed dog", () => {
    expect(
      validatePetDraft(
        { ...valid, breedSecondary: "Beagle", isMixed: true },
        today,
      ),
    ).toEqual({});
  });
});

describe("withApproximateBirthDate", () => {
  const draft = { birthDate: "2025-09-14", birthDateApproximate: false };

  it("pins the day to the 1st and keeps the month and the year", () => {
    // The defect this exists to prevent: the profile called the old
    // `(year, month)` signature the other way round and produced
    // "0009-2025-01", which parses as nothing and emptied the field.
    expect(withApproximateBirthDate(draft, true)).toEqual({
      birthDate: "2025-09-01",
      birthDateApproximate: true,
    });
  });

  it("leaves the date alone when the flag comes off", () => {
    const approximate = { birthDate: "2025-09-01", birthDateApproximate: true };
    expect(withApproximateBirthDate(approximate, false)).toEqual({
      birthDate: "2025-09-01",
      birthDateApproximate: false,
    });
  });

  it("has nothing to pin when there is no date yet", () => {
    expect(
      withApproximateBirthDate(
        { birthDate: null, birthDateApproximate: false },
        true,
      ),
    ).toEqual({ birthDate: null, birthDateApproximate: true });
  });

  it("carries the rest of the draft through untouched", () => {
    const full = { ...draft, name: "Loki", isMixed: true };
    expect(withApproximateBirthDate(full, true)).toMatchObject({
      name: "Loki",
      isMixed: true,
    });
  });
});
