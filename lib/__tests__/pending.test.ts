import {
  enqueueStop,
  flushPending,
  parsePending,
  pendingForDay,
  pendingMinutes,
  pendingWalks,
  serialisePending,
  withoutStop,
  type PendingStop,
  type ReplayStop,
  type StopOutcome,
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

/**
 * **Replaying the queue, with the write injected.** `flushPending` never
 * reaches for the client: the writer arrives as a parameter, so the module
 * stays pure, the screen passes the real one (`replayStop` in `lib/events.ts`)
 * and these tests pass a simulated one that records what it was asked to do.
 *
 * The distinction the whole thing turns on is **a network failure against a
 * rejection**: the first leaves the intent in the queue to be tried again, the
 * second withdraws it, because it can never be fulfilled — and that is the one
 * case where something leaves the queue without being written, so it is said
 * out loud rather than dropped in silence.
 */
describe("flushPending", () => {
  /** A writer that answers whatever the test says, and counts its calls. */
  const writer = (answers: Record<string, StopOutcome>) => {
    const asked: string[] = [];
    const replay: ReplayStop = async (stop) => {
      asked.push(stop.id);
      return answers[stop.id] ?? "done";
    };
    return { asked, replay };
  };

  it("takes the uploaded ones out and leaves nothing behind", async () => {
    const { asked, replay } = writer({ a: "done", b: "done" });
    const result = await flushPending([close("a", 30), remove("b")], replay);
    expect(asked).toEqual(["a", "b"]);
    expect(result).toEqual({ left: [], rejected: [] });
  });

  it("deja en la cola lo que falló por red", async () => {
    // The request did not get through. Nothing is known about the row, so the
    // intent is exactly as pending as it was: it stays, and it is not said
    // out loud — a retry that fails is not news.
    const { replay } = writer({ a: "failed", b: "done" });
    const result = await flushPending([close("a", 30), close("b", 12)], replay);
    expect(result.left).toEqual([close("a", 30)]);
    expect(result.rejected).toEqual([]);
  });

  it("retira lo que el servidor rechazó, y lo dice aparte", async () => {
    // The row is gone — the other tutor deleted it — so this close can never
    // be written. It leaves the queue, and it leaves it in `rejected` rather
    // than quietly, because nothing here is discarded in silence.
    const { replay } = writer({ a: "gone", b: "failed" });
    const result = await flushPending([close("a", 30), close("b", 12)], replay);
    expect(result.rejected).toEqual([close("a", 30)]);
    expect(result.left).toEqual([close("b", 12)]);
  });

  it("no sube dos veces aunque se reproduzca dos veces a la vez", async () => {
    // Coming back to the app just as a day read ends well: both triggers are
    // real and both replay the same queue. One write per element, and both
    // callers get the same answer.
    let settle = () => {};
    const held = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const asked: string[] = [];
    const replay: ReplayStop = async (stop) => {
      asked.push(stop.id);
      await held;
      return "done";
    };

    const queue = [close("a", 30), remove("b")];
    const first = flushPending(queue, replay);
    const second = flushPending(queue, replay);
    settle();
    const [one, two] = await Promise.all([first, second]);

    expect(asked).toEqual(["a", "b"]);
    expect(one).toEqual({ left: [], rejected: [] });
    expect(two).toEqual({ left: [], rejected: [] });
  });

  it("la fila que el otro tutor ya cerró no se sobrescribe", async () => {
    // The row has a length and it is not ours. The writer says `done` without
    // touching it — the conditional update in `replayStop` is what makes that
    // true, and `lib/__tests__/events.write.test.ts` pins it — so the intent
    // is withdrawn as fulfilled: not retried, and not announced either, since
    // the walk is in the diary with a length. Whichever close landed first
    // wins, which is the only rule that needs no guessing.
    const { replay } = writer({ a: "done" });
    const result = await flushPending([close("a", 30)], replay);
    expect(result).toEqual({ left: [], rejected: [] });
  });

  it("holds nothing against the next replay", async () => {
    // The guard is about two replays overlapping, not about remembering an
    // answer: a stop that failed is written again the next time round.
    const first = writer({ a: "failed" });
    expect((await flushPending([close("a", 30)], first.replay)).left).toEqual([
      close("a", 30),
    ]);
    const second = writer({ a: "done" });
    expect((await flushPending([close("a", 30)], second.replay)).left).toEqual(
      [],
    );
    expect(second.asked).toEqual(["a"]);
  });

  it("is nothing to do for an empty queue", async () => {
    const { asked, replay } = writer({});
    expect(await flushPending([], replay)).toEqual({ left: [], rejected: [] });
    expect(asked).toEqual([]);
  });

  it("treats a writer that throws as a request that did not get through", async () => {
    const replay: ReplayStop = async () => {
      throw new Error("boom");
    };
    const result = await flushPending([close("a", 30)], replay);
    expect(result.left).toEqual([close("a", 30)]);
    expect(result.rejected).toEqual([]);
  });
});
