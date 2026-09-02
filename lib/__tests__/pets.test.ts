// Mock supabase before importing pets
jest.mock("../supabase");

import { validatePetDraft, type PetDraft } from "../pets";

const valid: PetDraft = {
  name: "Loki",
  sex: "male",
  breedPrimary: "Husky Siberiano",
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

  it("allows an unknown birth date", () => {
    expect(validatePetDraft({ ...valid, birthDate: null }, today)).toEqual({});
  });
});
