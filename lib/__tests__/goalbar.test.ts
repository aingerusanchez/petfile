import { barProgress, barStateAt, closeMotion } from "../goalbar";

describe("barProgress", () => {
  it("is the fraction of the goal below it", () => {
    expect(barProgress(60, 120)).toBeCloseTo(0.5);
  });
  it("is exactly 1 at the goal", () => {
    expect(barProgress(120, 120)).toBe(1);
  });
  it("counts the second lap as the fraction past the goal", () => {
    expect(barProgress(180, 120)).toBeCloseTo(1.5);
  });
  it("stops at 2 — a day past double cannot be shown further", () => {
    expect(barProgress(600, 120)).toBe(2);
  });
  it("has no bar without a goal", () => {
    expect(barProgress(60, null)).toBeNull();
    expect(barProgress(60, 0)).toBeNull();
  });
});

describe("barStateAt", () => {
  it("reads a ground and a fill", () => {
    expect(barStateAt(0.5)).toEqual({ tier: 0, fill: 50 });
    expect(barStateAt(1.25)).toEqual({ tier: 1, fill: 25 });
  });
  it("puts an exact tier at the foot of its own lap, not the head of the last", () => {
    expect(barStateAt(1)).toEqual({ tier: 1, fill: 0 });
  });
  it("fills the top tier rather than starting a third lap", () => {
    expect(barStateAt(2)).toEqual({ tier: 2, fill: 100 });
  });
});

describe("closeMotion", () => {
  it("fills from where the saved minutes stopped to where they now stop", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 30, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.5, to: 0.75 });
  });
  it("crosses a tier inside one fill", () => {
    const m = closeMotion({
      recordedBefore: 90,
      closedMinutes: 60,
      goalMinutes: 120,
    });
    expect(m).toEqual({ kind: "fill", from: 0.75, to: 1.25 });
  });
  it("crosses both tiers inside one fill", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 240, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.5, to: 2 });
  });
  it("says nothing on a day already past the top tier", () => {
    expect(
      closeMotion({ recordedBefore: 300, closedMinutes: 40, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
  it("says nothing without a goal, and nothing for a walk that added nothing", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 30, goalMinutes: null }),
    ).toEqual({ kind: "none" });
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 0, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
});
