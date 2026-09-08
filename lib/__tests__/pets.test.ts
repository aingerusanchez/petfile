// Mock supabase before importing pets
jest.mock("../supabase");

import { validatePetDraft, type PetDraft } from "../pets";

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
    expect(validatePetDraft({ ...valid, name: "   " }, today)).toHaveProperty("name");
  });

  it("requires a sex", () => {
    expect(validatePetDraft({ ...valid, sex: null }, today)).toHaveProperty("sex");
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
    expect(validatePetDraft({ ...valid, birthDate: null }, today)).toHaveProperty(
      "birthDate",
    );
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
      validatePetDraft({ ...valid, breedSecondary: "Beagle", isMixed: false }, today),
    ).toHaveProperty("breedSecondary");
  });

  it("accepts a second breed on a mixed dog", () => {
    expect(
      validatePetDraft({ ...valid, breedSecondary: "Beagle", isMixed: true }, today),
    ).toEqual({});
  });
});
