import { barProgress, barStateAt, closeLaps, closeMotion } from "../goalbar";

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

describe("closeLaps", () => {
  it("is one lap when the close stays inside the one it began on", () => {
    expect(closeLaps(0.25, 0.75)).toEqual([
      { tier: 0, at: [0, 1], fill: [25, 75] },
    ]);
  });
  it("hands the second lap the rest of the close when one tier is crossed", () => {
    expect(closeLaps(0.75, 1.25)).toEqual([
      { tier: 0, at: [0, 0.5], fill: [75, 100] },
      { tier: 1, at: [0.5, 1], fill: [0, 25] },
    ]);
  });
  it("opens the next lap empty when the close lands exactly on a tier", () => {
    // The "foot of its own lap" rule, drawn: the ground turns on the last
    // frame and the lap it opens has nothing in it yet.
    expect(closeLaps(0.5, 1)).toEqual([
      { tier: 0, at: [0, 1], fill: [50, 100] },
      { tier: 1, at: [1, 1], fill: [0, 0] },
    ]);
  });
  it("crosses both tiers in one close, in order", () => {
    expect(closeLaps(0.5, 2)).toEqual([
      { tier: 0, at: [0, 1 / 3], fill: [50, 100] },
      { tier: 1, at: [1 / 3, 1], fill: [0, 100] },
      { tier: 2, at: [1, 1], fill: [0, 0] },
    ]);
  });
  it("paints nothing over the top tier, where the ground is the whole sentence", () => {
    const laps = closeLaps(1.5, 2);
    expect(laps[laps.length - 1]).toEqual({
      tier: 2,
      at: [1, 1],
      fill: [0, 0],
    });
  });
  it("clamps a close that reaches past the top of the scale", () => {
    expect(closeLaps(1.5, 3)).toEqual(closeLaps(1.5, 2));
  });
});
