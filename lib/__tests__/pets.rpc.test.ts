import { createPet, type PetDraft } from "../pets";
import { supabase } from "../supabase";

// `jest.mock` is hoisted above the imports, so `createPet` sees the mock even
// though both modules are imported statically. The factory creates the spy
// inline rather than closing over an outer `const`, which would still be in
// its temporal dead zone when the hoisted factory runs.
jest.mock("../supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as unknown as jest.Mock;

const draft: PetDraft = {
  name: "Loki",
  sex: "male",
  breedPrimary: "Husky Siberiano",
  isMixed: false,
  birthDate: "2025-09-14",
  birthDateApproximate: false,
  spayedNeutered: false,
  activityLevel: "high",
};

beforeEach(() => mockRpc.mockReset());

describe("createPet", () => {
  it("sends the draft as a snake_case payload and returns the new id", async () => {
    mockRpc.mockResolvedValue({ data: { id: "pet-1" }, error: null });

    const result = await createPet(draft);

    expect(mockRpc).toHaveBeenCalledWith("create_pet_with_owner", {
      pet: {
        name: "Loki",
        sex: "male",
        breed_primary: "Husky Siberiano",
        breed_secondary: null,
        is_mixed: false,
        birth_date: "2025-09-14",
        birth_date_approximate: false,
        spayed_neutered: false,
        activity_level: "high",
      },
    });
    expect(result).toEqual({ petId: "pet-1", error: null });
  });

  it("rejects an invalid draft without calling the database", async () => {
    const result = await createPet({ ...draft, name: "" });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.petId).toBeNull();
    expect(result.error).toBe("El nombre es obligatorio");
  });

  it("surfaces a database error message", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "not authenticated" } });

    const result = await createPet(draft);

    expect(result).toEqual({ petId: null, error: "not authenticated" });
  });
});
