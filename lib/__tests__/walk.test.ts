import {
  elapsedMinutes,
  parseRunningWalk,
  serialiseRunningWalk,
  walkOutcome,
} from "../walk";

const at = (iso: string) => new Date(iso);
const after = (from: Date, ms: number) => new Date(from.getTime() + ms);
const MINUTE = 60_000;

describe("parseRunningWalk", () => {
  it("reads back what it wrote", () => {
    expect(parseRunningWalk(serialiseRunningWalk("walk-1"))).toBe("walk-1");
  });

  it("returns null for nothing stored", () => {
    expect(parseRunningWalk(null)).toBeNull();
  });

  it("returns null for a corrupt blob rather than throwing", () => {
    expect(parseRunningWalk("{not json")).toBeNull();
  });

  it("returns null when the id is not a string", () => {
    expect(parseRunningWalk(JSON.stringify({ id: 7 }))).toBeNull();
  });
});

describe("elapsedMinutes", () => {
  const start = at("2026-10-15T11:02:00");

  it("counts whole minutes only", () => {
    expect(elapsedMinutes(start, after(start, 18 * MINUTE + 59_000))).toBe(18);
  });

  it("never goes negative", () => {
    expect(elapsedMinutes(start, after(start, -5 * MINUTE))).toBe(0);
  });
});

describe("walkOutcome", () => {
  const start = at("2026-10-15T11:02:00");

  it("discards a walk under a minute", () => {
    expect(walkOutcome(start, after(start, 59_000))).toEqual({
      action: "discard",
    });
  });

  it("closes a walk at exactly one minute", () => {
    expect(walkOutcome(start, after(start, MINUTE))).toEqual({
      action: "close",
      minutes: 1,
    });
  });

  it("stores the same number the counter was showing", () => {
    const now = after(start, 29 * MINUTE + 45_000);
    expect(elapsedMinutes(start, now)).toBe(29);
    expect(walkOutcome(start, now)).toEqual({ action: "close", minutes: 29 });
  });

  it("closes a walk that crossed midnight", () => {
    const night = at("2026-10-15T23:40:00");
    expect(walkOutcome(night, at("2026-10-16T00:10:00"))).toEqual({
      action: "close",
      minutes: 30,
    });
  });

  it("abandons a walk past the column's ceiling", () => {
    expect(walkOutcome(start, after(start, 1441 * MINUTE))).toEqual({
      action: "abandon",
    });
  });

  it("abandons rather than discards when the clock went backwards", () => {
    expect(walkOutcome(start, after(start, -MINUTE))).toEqual({
      action: "abandon",
    });
  });
});
