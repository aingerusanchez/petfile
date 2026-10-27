import { getMyPet, listMyPets, type PetRow } from "../pets";
import { supabase } from "../supabase";

// The query builder is a thenable ending in `.order(...)`, so the mock stops
// there: `from().select().order()` resolves to whatever the test says.
jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as unknown as jest.Mock;
const mockOrder = jest.fn();

const loki = { id: "p1", name: "Loki" } as PetRow;
const nala = { id: "p2", name: "Nala" } as PetRow;

beforeEach(() => {
  mockOrder.mockReset();
  mockFrom.mockReset();
  mockFrom.mockReturnValue({ select: () => ({ order: mockOrder }) });
  // describeFailure logs the raw text for the console; keep the run quiet.
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("getMyPet", () => {
  it("still answers with the oldest pet when called with no argument", async () => {
    mockOrder.mockResolvedValue({ data: [loki, nala], error: null });
    expect(await getMyPet()).toEqual({ pet: loki, error: null });
  });

  it("answers with the stored pet when there is one", async () => {
    mockOrder.mockResolvedValue({ data: [loki, nala], error: null });
    expect(await getMyPet("p2")).toEqual({ pet: nala, error: null });
  });

  // The seven screens that call this show the sentence as it comes. Reading
  // the list underneath is an implementation detail, and "las fichas" in the
  // diary of one dog is that detail leaking.
  it("names a failed read after the sheet, not after the list", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { pet, error } = await getMyPet();
    expect(pet).toBeNull();
    expect(error).toBe(
      "Algo ha ido mal por nuestro lado al leer la ficha. Vuelve a intentarlo.",
    );
  });

  it("names a request that never lands after the sheet too", async () => {
    mockOrder.mockRejectedValue(new Error("Network request failed"));
    const { error } = await getMyPet();
    expect(error).toBe(
      "No hay conexión para leer la ficha. Inténtalo otra vez cuando vuelva.",
    );
  });
});

describe("listMyPets", () => {
  it("returns every pet, oldest first as the query asks", async () => {
    mockOrder.mockResolvedValue({ data: [loki, nala], error: null });
    expect(await listMyPets()).toEqual({ pets: [loki, nala], error: null });
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("names a failed read after the list, because it is reading all of them", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { pets, error } = await listMyPets();
    expect(pets).toEqual([]);
    expect(error).toBe(
      "Algo ha ido mal por nuestro lado al leer las fichas. Vuelve a intentarlo.",
    );
  });
});
