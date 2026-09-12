import {
  clockDigits,
  DIAL_MARKS,
  formatClock,
  halfOf,
  hourAt,
  markAngle,
  markFromPoint,
  markOfHour,
  markPoint,
  parseClock,
} from "../clock";

// `|| 0` because `Math.round(-0.0000001)` is `-0`, which Jest reports as a
// difference from `0` and which nothing here means.
const round = ({ x, y }: { x: number; y: number }) => ({
  x: Math.round(x) || 0,
  y: Math.round(y) || 0,
});

describe("markAngle", () => {
  it("measures clockwise from twelve, not from three", () => {
    expect(markAngle(0, 12)).toBe(0);
    expect(markAngle(3, 12)).toBe(90);
    expect(markAngle(6, 12)).toBe(180);
    expect(markAngle(9, 12)).toBe(270);
    expect(markAngle(30, 60)).toBe(180);
  });
});

describe("markPoint", () => {
  it("puts the marks where a clock has them, in screen axes", () => {
    // Y grows downward: twelve o'clock is *above* the centre.
    expect(round(markPoint(0, 12, 100))).toEqual({ x: 0, y: -100 });
    expect(round(markPoint(3, 12, 100))).toEqual({ x: 100, y: 0 });
    expect(round(markPoint(6, 12, 100))).toEqual({ x: 0, y: 100 });
    expect(round(markPoint(9, 12, 100))).toEqual({ x: -100, y: 0 });
  });

  it("keeps every mark on the same circle", () => {
    for (let mark = 0; mark < DIAL_MARKS; mark += 1) {
      const { x, y } = markPoint(mark, DIAL_MARKS, 106);
      expect(Math.hypot(x, y)).toBeCloseTo(106, 6);
    }
  });
});

describe("markFromPoint", () => {
  it("reads back what markPoint wrote", () => {
    for (let mark = 0; mark < 60; mark += 1) {
      const { x, y } = markPoint(mark, 60, 100);
      expect(markFromPoint(x, y, 60)).toBe(mark);
    }
  });

  it("snaps to the nearest mark", () => {
    // A finger a few degrees past two o'clock is still choosing two.
    const { x, y } = markPoint(2.3, 12, 100);
    expect(markFromPoint(x, y, 12)).toBe(2);
    expect(
      markFromPoint(markPoint(2.6, 12, 100).x, markPoint(2.6, 12, 100).y, 12),
    ).toBe(3);
  });

  it("wraps rather than running off the end", () => {
    expect(
      markFromPoint(markPoint(11.9, 12, 100).x, markPoint(11.9, 12, 100).y, 12),
    ).toBe(0);
    expect(markFromPoint(-1, -100, 12)).toBe(0);
  });

  it("has no answer at the centre", () => {
    // `atan2(0, 0)` is 0, so without this a drag across the middle of the
    // dial would snap to twelve o'clock on the way past.
    expect(markFromPoint(0, 0, 12)).toBeNull();
    expect(markFromPoint(3, -4, 12)).toBeNull();
    expect(markFromPoint(0, -13, 12)).toBe(0);
  });
});

describe("parseClock", () => {
  it("takes the shapes the field itself takes", () => {
    expect(parseClock("09:15")).toEqual({ hour: 9, minute: 15 });
    expect(parseClock("9:15")).toEqual({ hour: 9, minute: 15 });
    expect(parseClock("09.15")).toEqual({ hour: 9, minute: 15 });
    expect(parseClock("915")).toEqual({ hour: 9, minute: 15 });
    expect(parseClock(" 23:59 ")).toEqual({ hour: 23, minute: 59 });
  });

  it("says nothing rather than guessing", () => {
    // A field mid-typing is not an error; it is the cue to open on the clock.
    expect(parseClock("")).toBeNull();
    expect(parseClock("9")).toBeNull();
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("09:60")).toBeNull();
    expect(parseClock("mañana")).toBeNull();
  });
});

describe("formatClock", () => {
  it("pads both halves, the one form the field takes back", () => {
    expect(formatClock({ hour: 9, minute: 5 })).toBe("09:05");
    expect(formatClock({ hour: 0, minute: 0 })).toBe("00:00");
    expect(clockDigits(7)).toBe("07");
  });
});

describe("the two halves of the day", () => {
  it("splits at midday", () => {
    expect(halfOf(0)).toBe("morning");
    expect(halfOf(11)).toBe("morning");
    expect(halfOf(12)).toBe("afternoon");
    expect(halfOf(23)).toBe("afternoon");
  });

  it("puts both halves of an hour on the same mark", () => {
    // The whole reason one ring can carry twenty-four hours: 09 and 21 are
    // the same place on a clock, so switching halves relabels without moving
    // the hand.
    expect(markOfHour(9)).toBe(markOfHour(21));
    expect(markOfHour(0)).toBe(markOfHour(12));
    expect(hourAt(9, "morning")).toBe(9);
    expect(hourAt(9, "afternoon")).toBe(21);
    expect(hourAt(0, "afternoon")).toBe(12);
  });

  it("round-trips every hour of the day", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(hourAt(markOfHour(hour), halfOf(hour))).toBe(hour);
    }
  });
});
