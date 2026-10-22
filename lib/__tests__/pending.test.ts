import {
  enqueueStop,
  parsePending,
  pendingForDay,
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

/**
 * **The day's rows are what say which pending stops are this day's**, and the
 * queue cannot say it on its own: it is a fact about the phone, it holds no
 * day, and a wrong answer here does not throw — it counts the dog's minutes
 * twice, or on the wrong day.
 */
describe("pendingForDay", () => {
  const open = (id: string) => ({ id, duration_minutes: null });

  it("keeps a stop whose walk is open on this day", () => {
    expect(pendingForDay([close("a", 30)], [open("a")])).toEqual([
      close("a", 30),
    ]);
  });

  it("leaves out a stop whose walk is not on this day", () => {
    // Pressed last night, and the arrows are on another day: its minutes
    // belong to the day its row is on, not to the one being looked at.
    expect(pendingForDay([close("a", 30)], [open("b")])).toEqual([]);
  });

  it("leaves out a stop whose walk already has a length", () => {
    // The other tutor closed the same walk from their own phone, so the row
    // carries the length and the day's rows already count it. Counting the
    // pending stop as well would read 90 min in 2 paseos for one walk.
    expect(
      pendingForDay([close("a", 45)], [{ id: "a", duration_minutes: 45 }]),
    ).toEqual([]);
  });

  it("leaves out a stop whose row has gone", () => {
    // Deleted on the other phone: there is no walk left to count.
    expect(pendingForDay([close("a", 30)], [])).toEqual([]);
  });

  it("takes each stop on its own", () => {
    const queue = [close("a", 30), close("b", 12), remove("c")];
    const rows = [
      open("a"),
      { id: "b", duration_minutes: 12 },
      open("c"),
      open("d"),
    ];
    expect(pendingForDay(queue, rows)).toEqual([close("a", 30), remove("c")]);
  });

  it("is what the day's two halves are counted from", () => {
    const queue = [close("a", 30), close("b", 12), remove("c")];
    const rows = [open("a"), { id: "b", duration_minutes: 12 }, open("c")];
    const here = pendingForDay(queue, rows);
    expect(pendingMinutes(here)).toBe(30);
    expect(pendingWalks(here)).toBe(1);
  });

  it("does not change the queue it was given", () => {
    const before = [close("a", 30)];
    pendingForDay(before, []);
    expect(before).toEqual([close("a", 30)]);
  });
});
