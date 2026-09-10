import { formatDuration, parseDuration } from "../duration";

describe("formatDuration", () => {
  it("keeps the unit word under an hour", () => {
    expect(formatDuration(1)).toBe("1 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(59)).toBe("59 min");
  });

  it("switches to hours at exactly one", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(61)).toBe("1h 1m");
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("drops the minutes when there are none", () => {
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(300)).toBe("5h");
  });

  it("has nothing to say about a number that is not a duration", () => {
    expect(formatDuration(-5)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });

  it("says zero rather than nothing", () => {
    expect(formatDuration(0)).toBe("0 min");
  });
});

describe("parseDuration", () => {
  it("reads bare digits as minutes, which is what the fields meant before", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("130")).toBe(130);
  });

  it("reads the shapes a tutor actually types", () => {
    for (const [text, minutes] of [
      ["1h", 60],
      ["1h30", 90],
      ["1h30m", 90],
      ["1h 30m", 90],
      ["1 h 30 min", 90],
      ["1H30M", 90],
      ["  2h  ", 120],
      ["30m", 30],
      ["45min", 45],
      ["1:30", 90],
      ["0:45", 45],
      ["5h", 300],
    ] as const) {
      expect(parseDuration(text)).toBe(minutes);
    }
  });

  it("refuses what is not a duration, empty included", () => {
    for (const text of [
      "",
      "   ",
      "abc",
      "h",
      "m",
      "1x",
      "1,5h",
      "1.5h",
      "--",
    ]) {
      expect(parseDuration(text)).toBeNull();
    }
  });

  it("round-trips through the formatter", () => {
    for (const minutes of [1, 30, 45, 60, 90, 120, 125, 300]) {
      expect(parseDuration(formatDuration(minutes))).toBe(minutes);
    }
  });

  it("does not cap anything: that is the caller's rule", () => {
    // The exercise goal stops at 300 and a walk at 1440, in their own
    // validators — a parser that silently clamped would hide a typo.
    expect(parseDuration("99h")).toBe(5940);
  });
});
