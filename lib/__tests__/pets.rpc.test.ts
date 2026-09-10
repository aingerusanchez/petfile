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
  breedSecondary: null,
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
    expect(result.error).toBe("¿Cómo se llama?");
  });

  it("sends the second breed only when the dog is marked mixed", async () => {
    mockRpc.mockResolvedValue({ data: { id: "pet-2" }, error: null });

    await createPet({ ...draft, isMixed: true, breedSecondary: "Beagle" });

    expect(mockRpc.mock.calls[0][1].pet).toMatchObject({
      is_mixed: true,
      breed_secondary: "Beagle",
    });
  });

  it("sends a null activity level rather than inventing one", async () => {
    mockRpc.mockResolvedValue({ data: { id: "pet-3" }, error: null });

    await createPet({ ...draft, activityLevel: null });

    // The RPC used to coalesce a missing value to "moderate", so an untouched
    // selector was stored as if answered. 0004 removed that.
    expect(mockRpc.mock.calls[0][1].pet.activity_level).toBeNull();
  });

  it("answers a rejected save in the app's voice, not the transport's", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "not authenticated" },
    });

    const result = await createPet(draft);

    // The raw message names neither the problem nor the recovery for a tutor;
    // it goes to the console instead.
    expect(result.petId).toBeNull();
    expect(result.error).toBe(
      "Algo ha ido mal por nuestro lado. Vuelve a intentarlo.",
    );
  });

  it("names a lost connection as one", async () => {
    mockRpc.mockRejectedValue(
      new Error("Network request failed: java.net.ConnectException"),
    );

    const result = await createPet(draft);

    expect(result.error).toBe(
      "Parece que no hay conexión. Inténtalo otra vez cuando vuelva.",
    );
  });
  it('records a typed "Mestizo" as the mixed flag, not as a breed', async () => {
    mockRpc.mockResolvedValue({ data: { id: "pet-1" }, error: null });

    await createPet({ ...draft, breedPrimary: "Mestizo", isMixed: false });

    const payload = mockRpc.mock.calls[0][1].pet;
    expect(payload.breed_primary).toBeNull();
    expect(payload.is_mixed).toBe(true);
  });

  it("keeps the second breed when the flag arrives from the typed value", async () => {
    mockRpc.mockResolvedValue({ data: { id: "pet-1" }, error: null });

    await createPet({
      ...draft,
      breedPrimary: "mestizo",
      breedSecondary: "Beagle",
      isMixed: false,
    });

    const payload = mockRpc.mock.calls[0][1].pet;
    expect(payload.breed_secondary).toBe("Beagle");
  });
});
