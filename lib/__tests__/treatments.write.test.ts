import { supabase } from "../supabase";
import { updateTreatment } from "../treatments";

jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as unknown as jest.Mock;

beforeEach(() => mockFrom.mockReset());

/**
 * The correction's filter, which is the whole subject of this file.
 *
 * `payload` writes `pet_id`, so an `update` filtered by `id` alone does not
 * reject a row belonging to another sheet — it **reassigns** it, and RLS
 * cannot tell the difference because the tutor owns both dogs. The callers
 * close that window by identifying the row they opened, but the caller is
 * the perimeter and this is the door, and the sharing work brings more
 * writers through it. Dropping either `.eq` here fails one of these.
 */
describe("updateTreatment", () => {
  const chain = () => {
    const byPet = jest.fn().mockResolvedValue({ error: null });
    const byId = jest.fn(() => ({ eq: byPet }));
    const update = jest.fn(() => ({ eq: byId }));
    mockFrom.mockReturnValue({ update });
    return { update, byId, byPet };
  };

  const dose = {
    kind: "vaccine" as const,
    name: "Polivalente",
    administeredOn: new Date(2026, 0, 15),
  };

  it("reaches one row of one pet, and says so in the filter", async () => {
    const { update, byId, byPet } = chain();

    const result = await updateTreatment("t1", "pet-1", dose);

    expect(mockFrom).toHaveBeenCalledWith("pet_treatments");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ pet_id: "pet-1", kind: "vaccine" }),
    );
    expect(byId).toHaveBeenCalledWith("id", "t1");
    expect(byPet).toHaveBeenCalledWith("pet_id", "pet-1");
    expect(result).toEqual({ error: null });
  });

  it("names a failed correction after saving the treatment", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const byPet = jest.fn().mockResolvedValue({ error: { message: "boom" } });
    mockFrom.mockReturnValue({
      update: jest.fn(() => ({ eq: jest.fn(() => ({ eq: byPet })) })),
    });

    expect(await updateTreatment("t1", "pet-1", dose)).toEqual({
      error:
        "Algo ha ido mal por nuestro lado al guardar el tratamiento. Vuelve a intentarlo.",
    });
    jest.restoreAllMocks();
  });

  it("does not ask the server anything when the dates do not make sense", async () => {
    const { update } = chain();

    const result = await updateTreatment("t1", "pet-1", {
      ...dose,
      nextDueOn: new Date(2025, 11, 1),
    });

    expect(result.error).toBe("La próxima no puede ser antes que esta");
    expect(update).not.toHaveBeenCalled();
  });
});
