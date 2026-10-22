import {
  agedPending,
  enqueueStop,
  parsePending,
  pendingMinutes,
  pendingWalks,
  serialisePending,
  withoutStop,
  type PendingStop,
} from "../pending";

const PRESSED = "2026-10-22T10:00:00.000Z";
const close = (id: string, minutes: number): PendingStop => ({
  kind: "close",
  id,
  minutes,
  pressedAt: PRESSED,
});
const remove = (id: string): PendingStop => ({
  kind: "delete",
  id,
  pressedAt: PRESSED,
});

describe("parsePending", () => {
  it.each([
    ["nothing stored", null],
    ["an empty string", ""],
    ["broken JSON", "{]"],
    ["an empty list", "[]"],
    [
      "an object that is not a list",
      JSON.stringify({ id: "a", kind: "close" }),
    ],
    [
      "a list with an element that has no id",
      JSON.stringify([{ kind: "close", minutes: 5, pressedAt: PRESSED }]),
    ],
    [
      "an element whose id is empty",
      JSON.stringify([{ kind: "delete", id: "", pressedAt: PRESSED }]),
    ],
    ["a list of non-objects", JSON.stringify([1, null, "x"])],
    [
      "a close with no minutes",
      JSON.stringify([{ kind: "close", id: "a", pressedAt: PRESSED }]),
    ],
    [
      "a close with negative minutes",
      JSON.stringify([
        { kind: "close", id: "a", minutes: -3, pressedAt: PRESSED },
      ]),
    ],
    [
      "a stop with an unreadable instant",
      JSON.stringify([{ kind: "delete", id: "a", pressedAt: "yesterday-ish" }]),
    ],
    [
      "a kind it has never heard of",
      JSON.stringify([{ kind: "rename", id: "a", pressedAt: PRESSED }]),
    ],
  ])("yields an empty queue for %s, and does not throw", (_, raw) => {
    expect(parsePending(raw)).toEqual([]);
  });

  it("keeps the good elements of a list that has a bad one", () => {
    const raw = JSON.stringify([
      close("a", 30),
      { kind: "delete" },
      remove("b"),
    ]);
    expect(parsePending(raw)).toEqual([close("a", 30), remove("b")]);
  });

  it("goes there and back without losing anything", () => {
    const queue = [close("a", 30), remove("b"), close("c", 0)];
    expect(parsePending(serialisePending(queue))).toEqual(queue);
  });
});

describe("enqueueStop", () => {
  it("lets a second stop of the same walk replace the first", () => {
    const queue = enqueueStop([close("a", 30)], close("a", 41));
    expect(queue).toEqual([close("a", 41)]);
  });

  it("lets a delete replace a close of the same walk", () => {
    expect(enqueueStop([close("a", 30)], remove("a"))).toEqual([remove("a")]);
  });

  it("keeps the stops of other walks", () => {
    const queue = enqueueStop([close("a", 30)], close("b", 12));
    expect(queue).toEqual([close("a", 30), close("b", 12)]);
  });

  it("does not change the queue it was given", () => {
    const before = [close("a", 30)];
    enqueueStop(before, close("a", 41));
    expect(before).toEqual([close("a", 30)]);
  });
});

describe("withoutStop", () => {
  it("drops that walk and only that walk", () => {
    expect(withoutStop([close("a", 30), remove("b")], "a")).toEqual([
      remove("b"),
    ]);
  });
});

describe("pendingMinutes and pendingWalks", () => {
  const queue = [close("a", 30), close("b", 12), remove("c")];

  it("adds up the minutes of the closes", () => {
    expect(pendingMinutes(queue)).toBe(42);
  });

  it("counts the walks that will exist, and a delete is not one", () => {
    expect(pendingWalks(queue)).toBe(2);
  });

  it("is nothing for an empty queue", () => {
    expect(pendingMinutes([])).toBe(0);
    expect(pendingWalks([])).toBe(0);
  });
});

describe("agedPending", () => {
  const at = (hours: number, minutes: number) =>
    new Date(new Date(PRESSED).getTime() + (hours * 60 + minutes) * 60_000);

  it("is not aged at 5 h 59 min", () => {
    expect(agedPending(close("a", 30), at(5, 59))).toBe(false);
  });

  it("is aged at 6 h 1 min", () => {
    expect(agedPending(close("a", 30), at(6, 1))).toBe(true);
  });

  it("ages a delete the same way", () => {
    expect(agedPending(remove("a"), at(6, 1))).toBe(true);
  });
});
