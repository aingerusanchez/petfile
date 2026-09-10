import {
  dayBounds,
  formatTimeOfDay,
  parseTimeOfDay,
  MAX_WALK_MINUTES,
  minutesBetween,
  shiftMinutes,
  validateEvent,
  walkedMinutes,
  type NewEvent,
  type PetEventRow,
} from "../events";

const walk = (minutes: number | null): PetEventRow => ({
  id: "e",
  pet_id: "p",
  kind: "walk",
  occurred_at: "2026-09-10T10:00:00Z",
  duration_minutes: minutes,
  note: null,
  details: {},
  created_by: null,
  created_at: "2026-09-10T10:00:00Z",
  updated_at: "2026-09-10T10:00:00Z",
});

describe("walkedMinutes", () => {
  it("adds up the walks and ignores everything else", () => {
    const events: PetEventRow[] = [
      walk(30),
      { ...walk(null), kind: "meal" },
      walk(45),
      { ...walk(999), kind: "medication" },
    ];
    // The 999 belongs to a medication row, which has no business carrying a
    // duration — and the sum must not pick it up if one ever does.
    expect(walkedMinutes(events)).toBe(75);
  });

  it("counts a walk with no duration as zero rather than as nothing", () => {
    expect(walkedMinutes([walk(null), walk(20)])).toBe(20);
  });

  it("is zero for a day with nothing in it", () => {
    expect(walkedMinutes([])).toBe(0);
  });
});

describe("dayBounds", () => {
  it("spans one local day, from midnight to midnight", () => {
    const { from, to } = dayBounds(new Date(2026, 8, 10, 14, 30));
    const start = new Date(from);
    const end = new Date(to);

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(10);
    expect(end.getDate()).toBe(11);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("puts a small-hours entry in the day the device shows", () => {
    // A walk logged at 00:30 belongs to that calendar day, not to the previous
    // one — which is what building the range in local time buys.
    const day = new Date(2026, 8, 10, 0, 30);
    const { from, to } = dayBounds(day);
    expect(day.getTime()).toBeGreaterThanOrEqual(new Date(from).getTime());
    expect(day.getTime()).toBeLessThan(new Date(to).getTime());
  });
});

describe("validateEvent", () => {
  const now = () => new Date(Date.now() - 60 * 1000);
  const event = (over: Partial<NewEvent> = {}): NewEvent => ({
    kind: "walk",
    occurredAt: now(),
    ...over,
  });

  it("accepts a walk with no duration: it still happened", () => {
    expect(validateEvent(event())).toEqual({});
  });

  it("accepts a real duration", () => {
    expect(validateEvent(event({ durationMinutes: 45 }))).toEqual({});
  });

  it("asks again for a duration nobody walked", () => {
    for (const minutes of [0, -10, 12.5]) {
      expect(validateEvent(event({ durationMinutes: minutes }))).toHaveProperty(
        "durationMinutes",
        "¿Cuánto duró?",
      );
    }
  });

  it("refuses a walk longer than a day", () => {
    expect(
      validateEvent(event({ durationMinutes: MAX_WALK_MINUTES + 1 })),
    ).toHaveProperty("durationMinutes", "Eso son más de 24 horas");
  });

  it("treats a future entry as a mistyped time", () => {
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(validateEvent(event({ occurredAt: later }))).toHaveProperty(
      "occurredAt",
      "¿Todavía no ha pasado?",
    );
  });

  it("allows the clock to be a minute ahead of itself", () => {
    // Logging "now" must never fail because a device's clock rounds up.
    const almostNow = new Date(Date.now() + 30 * 1000);
    expect(validateEvent(event({ occurredAt: almostNow }))).toEqual({});
  });

  it("leaves duration alone for the kinds that have none", () => {
    // A meal with a stray duration is the caller's bug, not the tutor's, and
    // the column tolerates it: this validator only speaks about walks.
    expect(validateEvent(event({ kind: "meal", durationMinutes: 0 }))).toEqual(
      {},
    );
  });
});

describe("parseTimeOfDay", () => {
  const day = new Date(2026, 8, 10, 18, 0);

  it("reads the shapes a tutor actually types", () => {
    for (const text of ["09:15", "9:15", "09.15", " 09:15 ", "0915"]) {
      const at = parseTimeOfDay(text, day);
      expect(at).not.toBeNull();
      expect(at!.getHours()).toBe(9);
      expect(at!.getMinutes()).toBe(15);
    }
  });

  it("keeps the day it was given and drops the seconds", () => {
    const at = parseTimeOfDay("21:00", day)!;
    expect(at.getDate()).toBe(10);
    expect(at.getMonth()).toBe(8);
    expect(at.getSeconds()).toBe(0);
    expect(at.getMilliseconds()).toBe(0);
  });

  it("refuses what is not a time", () => {
    for (const text of ["", "abc", "25:00", "12:60", "1:2", "12:345"]) {
      expect(parseTimeOfDay(text, day)).toBeNull();
    }
  });

  it("round-trips through the formatter", () => {
    expect(formatTimeOfDay(parseTimeOfDay("07:05", day)!)).toBe("07:05");
    expect(formatTimeOfDay(new Date(2026, 8, 10, 0, 0))).toBe("00:00");
  });
});

describe("minutesBetween", () => {
  const at = (h: number, m: number) => new Date(2026, 8, 10, h, m);

  it("measures a walk from its ends", () => {
    expect(minutesBetween(at(9, 15), at(9, 45))).toBe(30);
    expect(minutesBetween(at(9, 0), at(10, 30))).toBe(90);
  });

  it("has no answer when the end is not after the start", () => {
    // A mistyped digit, not a walk that ran past midnight: guessing would file
    // the entry on a day the tutor did not choose.
    expect(minutesBetween(at(10, 0), at(9, 0))).toBeNull();
    expect(minutesBetween(at(10, 0), at(10, 0))).toBeNull();
  });

  it("counts a one-minute walk", () => {
    expect(minutesBetween(at(10, 0), at(10, 1))).toBe(1);
  });
});

describe("shiftMinutes", () => {
  it("moves the end when the duration is what changed", () => {
    const from = new Date(2026, 8, 10, 9, 15);
    expect(formatTimeOfDay(shiftMinutes(from, 30))).toBe("09:45");
    expect(formatTimeOfDay(shiftMinutes(from, 90))).toBe("10:45");
  });

  it("round-trips against minutesBetween", () => {
    const from = new Date(2026, 8, 10, 7, 5);
    for (const minutes of [1, 30, 137]) {
      expect(minutesBetween(from, shiftMinutes(from, minutes))).toBe(minutes);
    }
  });
});

describe("formatTimeOfDay in 12h", () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 10, h, m);

  it("reads the way a 12-hour clock does", () => {
    expect(formatTimeOfDay(at(9, 15), "12h")).toBe("9:15 a.m.");
    expect(formatTimeOfDay(at(15, 0), "12h")).toBe("3:00 p.m.");
    expect(formatTimeOfDay(at(23, 59), "12h")).toBe("11:59 p.m.");
  });

  it("calls midnight and noon twelve, not zero", () => {
    expect(formatTimeOfDay(at(0, 5), "12h")).toBe("12:05 a.m.");
    expect(formatTimeOfDay(at(12, 5), "12h")).toBe("12:05 p.m.");
  });

  it("defaults to 24h, so an unqualified call is unchanged", () => {
    expect(formatTimeOfDay(at(15, 0))).toBe("15:00");
  });

  it("stays parseable in 24h, which is the only form a field takes", () => {
    const day = new Date(2026, 8, 10);
    expect(parseTimeOfDay(formatTimeOfDay(at(15, 0)), day)?.getHours()).toBe(
      15,
    );
  });
});
