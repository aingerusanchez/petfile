import { closeWalk, startWalk } from "../events";
import { supabase } from "../supabase";

jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as unknown as jest.Mock;

beforeEach(() => mockFrom.mockReset());

describe("startWalk", () => {
  it("inserts a walk with no duration and returns its id", async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: "walk-1" },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    mockFrom.mockReturnValue({ insert });

    const result = await startWalk("pet-1");

    expect(mockFrom).toHaveBeenCalledWith("pet_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pet_id: "pet-1",
        kind: "walk",
        duration_minutes: null,
      }),
    );
    expect(result).toEqual({ id: "walk-1", error: null });
  });

  it("returns a message and no id when the insert fails", async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    mockFrom.mockReturnValue({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single })) })),
    });

    const result = await startWalk("pet-1");

    expect(result.id).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("closeWalk", () => {
  it("writes the duration and nothing else", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn((_payload: Record<string, unknown>) => ({ eq }));
    mockFrom.mockReturnValue({ update });

    const result = await closeWalk("walk-1", 30);

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.duration_minutes).toBe(30);
    expect(Object.keys(payload).sort()).toEqual([
      "duration_minutes",
      "updated_at",
    ]);
    expect(eq).toHaveBeenCalledWith("id", "walk-1");
    expect(result).toEqual({ error: null });
  });

  it("reports a failure rather than throwing", async () => {
    mockFrom.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: { message: "gone" } }),
      })),
    });

    const result = await closeWalk("walk-1", 30);

    expect(result.error).toBeTruthy();
  });
});
