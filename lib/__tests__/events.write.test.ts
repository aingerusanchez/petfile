import { closeWalk, replayStop, startWalk } from "../events";
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

/**
 * **The writer `flushPending` is handed**, and the place where "whichever
 * close landed first wins" stops being a sentence and becomes a condition on
 * an update. The rules about what to do with each answer are unit-tested in
 * `lib/__tests__/pending.test.ts`; what is pinned here is that a replay
 * cannot overwrite a length somebody else wrote, and that a write matching no
 * row — which is not an error anywhere in Postgrest — is read correctly.
 */
describe("replayStop", () => {
  const PRESSED = "2026-10-22T10:00:00.000Z";

  /** The conditional update, with the rows it answers with. */
  const closeReturning = (
    rows: { id: string }[] | null,
    error: { message: string } | null = null,
  ) => {
    const select = jest.fn().mockResolvedValue({ data: rows, error });
    const is = jest.fn(() => ({ select }));
    const eq = jest.fn(() => ({ is }));
    const update = jest.fn((_payload: Record<string, unknown>) => ({ eq }));
    return { update, eq, is, select };
  };

  /** The read that tells a row with a length from a row that has gone. */
  const rowReturning = (
    rows: { id: string }[] | null,
    error: { message: string } | null = null,
  ) => {
    const eq = jest.fn().mockResolvedValue({ data: rows, error });
    return { select: jest.fn(() => ({ eq })), eq };
  };

  it("only writes the length while the walk has none", async () => {
    const close = closeReturning([{ id: "walk-1" }]);
    mockFrom.mockReturnValue({ update: close.update });

    const outcome = await replayStop({
      kind: "close",
      id: "walk-1",
      minutes: 30,
      pressedAt: PRESSED,
    });

    const payload = close.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.duration_minutes).toBe(30);
    expect(close.eq).toHaveBeenCalledWith("id", "walk-1");
    // The condition that makes the other phone's close safe from ours.
    expect(close.is).toHaveBeenCalledWith("duration_minutes", null);
    expect(outcome).toBe("done");
  });

  it("leaves the length the other phone wrote alone, and calls it done", async () => {
    // Nothing matched because the row already has a length: the walk is in
    // the diary, our intent is fulfilled by somebody else's write, and
    // retrying it for ever would be the one thing that could overwrite it.
    const close = closeReturning([]);
    const row = rowReturning([{ id: "walk-1" }]);
    mockFrom
      .mockReturnValueOnce({ update: close.update })
      .mockReturnValueOnce({ select: row.select });

    expect(
      await replayStop({
        kind: "close",
        id: "walk-1",
        minutes: 30,
        pressedAt: PRESSED,
      }),
    ).toBe("done");
  });

  it("says the row is gone when nothing matched and nothing is there", async () => {
    const close = closeReturning([]);
    const row = rowReturning([]);
    mockFrom
      .mockReturnValueOnce({ update: close.update })
      .mockReturnValueOnce({ select: row.select });

    expect(
      await replayStop({
        kind: "close",
        id: "walk-1",
        minutes: 30,
        pressedAt: PRESSED,
      }),
    ).toBe("gone");
  });

  it("keeps a close that could not be written", async () => {
    mockFrom.mockReturnValue({
      update: closeReturning(null, { message: "Network request failed" })
        .update,
    });

    expect(
      await replayStop({
        kind: "close",
        id: "walk-1",
        minutes: 30,
        pressedAt: PRESSED,
      }),
    ).toBe("failed");
  });

  it("counts a delete of a row that has already gone as done", async () => {
    // What was asked for is true: there is no row. A delete has nothing to
    // be rejected over.
    const eq = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: jest.fn(() => ({ eq })) });

    expect(
      await replayStop({ kind: "delete", id: "walk-1", pressedAt: PRESSED }),
    ).toBe("done");
    expect(eq).toHaveBeenCalledWith("id", "walk-1");
  });

  it("keeps a delete that could not be written", async () => {
    mockFrom.mockReturnValue({
      delete: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: { message: "fetch failed" } }),
      })),
    });

    expect(
      await replayStop({ kind: "delete", id: "walk-1", pressedAt: PRESSED }),
    ).toBe("failed");
  });
});
