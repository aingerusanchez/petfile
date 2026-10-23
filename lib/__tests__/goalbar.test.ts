import {
  barProgress,
  barStateAt,
  closeLaps,
  closeMotion,
  editMotion,
  lapFill,
  travelLaps,
} from "../goalbar";

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

describe("lapFill", () => {
  it("is where a point of the scale sits inside one lap", () => {
    expect(lapFill(1.25, 1)).toBeCloseTo(25);
  });
  it("is nothing on a lap the point has not reached", () => {
    expect(lapFill(0.75, 1)).toBe(0);
  });
  it("is the whole lap once the point is past it", () => {
    expect(lapFill(1.25, 0)).toBe(100);
  });
});

describe("closeMotion", () => {
  it("fills from where the saved minutes stopped to where they now stop", () => {
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 30, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.5, to: 0.75 });
  });
  it("begins at the foot of the lap it lands on, because the ground is already there", () => {
    // **The live minutes turned the ground before the stop did.** 90 of 120
    // with an hour running has been painted on lap two since the walk passed
    // the goal, so the stretch left to convert is the band on *that* lap —
    // starting the fill at 0.75 would paint lap one's ground back over a bar
    // that has already moved on.
    expect(
      closeMotion({ recordedBefore: 90, closedMinutes: 60, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 1, to: 1.25 });
  });
  it("converts nothing when the close lands on the top tier the bar already shows", () => {
    // The bar is violet throughout before the stop and violet throughout
    // after it. The gesture is kept rather than refused, because the block
    // hangs its hold on it — what is drawn is nothing.
    expect(
      closeMotion({ recordedBefore: 60, closedMinutes: 240, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 2, to: 2 });
  });
  it("says nothing on a day already past the top tier", () => {
    expect(
      closeMotion({ recordedBefore: 300, closedMinutes: 40, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
  it("leaves the close one lap to draw, whatever the walk crossed", () => {
    // The two halves read together: what `closeMotion` hands over is a
    // stretch inside one lap, so a close can no longer turn a ground. That
    // is the whole reconciliation — the ground turns once, where the live
    // minutes turned it, and the close converts what is left.
    const motion = closeMotion({
      recordedBefore: 15,
      closedMinutes: 46,
      goalMinutes: 30,
    });
    expect(motion.kind).toBe("fill");
    if (motion.kind !== "fill") return;
    expect(closeLaps(motion.from, motion.to)).toHaveLength(1);
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

describe("editMotion", () => {
  it("fills, like a close, when the edit adds minutes", () => {
    expect(
      editMotion({ recordedBefore: 60, recordedAfter: 90, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.5, to: 0.75 });
  });
  it("travels back when the edit takes minutes away", () => {
    expect(
      editMotion({ recordedBefore: 90, recordedAfter: 60, goalMinutes: 120 }),
    ).toEqual({ kind: "travel", from: 0.75, to: 0.5 });
  });

  // **The one rule the whole change turns on.** `closeMotion` opens at the
  // foot of the lap it lands on because a running walk had already turned
  // the ground for the minutes it lived; a hand edit has lived nothing, so
  // the ground below is still the ground the day is standing on and the
  // stretch has to start where the minutes really stop.
  it("starts at the recorded minutes and crosses the tier, where a close would not", () => {
    expect(
      editMotion({ recordedBefore: 90, recordedAfter: 150, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 0.75, to: 1.25 });
    expect(
      closeMotion({ recordedBefore: 90, closedMinutes: 60, goalMinutes: 120 }),
    ).toEqual({ kind: "fill", from: 1, to: 1.25 });
    expect(closeLaps(0.75, 1.25).map((lap) => lap.tier)).toEqual([0, 1]);
  });
  it("turns the ground back when a deletion crosses a tier downwards", () => {
    const motion = editMotion({
      recordedBefore: 150,
      recordedAfter: 90,
      goalMinutes: 120,
    });
    expect(motion).toEqual({ kind: "travel", from: 1.25, to: 0.75 });
    if (motion.kind !== "travel") return;
    expect(travelLaps(motion.from, motion.to).map((lap) => lap.tier)).toEqual([
      1, 0,
    ]);
  });

  it("travels to nothing when the day's last walk is deleted", () => {
    expect(
      editMotion({ recordedBefore: 45, recordedAfter: 0, goalMinutes: 120 }),
    ).toEqual({ kind: "travel", from: 0.375, to: 0 });
  });
  it("says nothing when the edit left the minutes where they were", () => {
    expect(
      editMotion({ recordedBefore: 60, recordedAfter: 60, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
  it("says nothing without a goal", () => {
    expect(
      editMotion({ recordedBefore: 60, recordedAfter: 90, goalMinutes: null }),
    ).toEqual({ kind: "none" });
    expect(
      editMotion({ recordedBefore: 60, recordedAfter: 90, goalMinutes: 0 }),
    ).toEqual({ kind: "none" });
  });
  it("says nothing when both totals are off the end of the bar", () => {
    // Past double at both ends: the bar is violet throughout before and
    // after, and there is no stretch to point at — the same silence the
    // close keeps on a day already past the top tier.
    expect(
      editMotion({ recordedBefore: 400, recordedAfter: 300, goalMinutes: 120 }),
    ).toEqual({ kind: "none" });
  });
  it("travels from the top of the bar when a deletion brings the day back under it", () => {
    expect(
      editMotion({ recordedBefore: 400, recordedAfter: 180, goalMinutes: 120 }),
    ).toEqual({ kind: "travel", from: 2, to: 1.5 });
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

describe("travelLaps", () => {
  it("is one lap when the journey stays inside the one it began on", () => {
    expect(travelLaps(0.75, 0.25)).toEqual([
      { tier: 0, at: [0, 1], fill: [75, 25] },
    ]);
  });
  it("leaves the lap it was on first and enters the next one full", () => {
    // The mirror of the ascent: the fill falls to nothing on lap one, the
    // ground below arrives, and the lap it opens on is full — which is why a
    // component has to gate each lap's fill on its own slice.
    expect(travelLaps(1.25, 0.75)).toEqual([
      { tier: 1, at: [0, 0.5], fill: [25, 0] },
      { tier: 0, at: [0.5, 1], fill: [100, 75] },
    ]);
  });
  it("is the ascent read backwards, boundary for boundary", () => {
    // Not a second opinion about where the tiers fall: the same cut, walked
    // the other way. A lap list that disagreed with `closeLaps` would be a
    // bar that turns colour in one direction and not in the other.
    const up = closeLaps(0.5, 2);
    const down = travelLaps(2, 0.5);
    expect(down.map((lap) => lap.tier)).toEqual(
      up.map((lap) => lap.tier).reverse(),
    );
    expect(down[0]).toEqual({ tier: 2, at: [0, 0], fill: [0, 0] });
    const last = down[down.length - 1];
    expect(last.tier).toBe(0);
    expect(last.fill).toEqual([100, 50]);
    // Closely rather than exactly: `1 - x` and `x` are not the same float.
    expect(last.at[0]).toBeCloseTo(2 / 3);
    expect(last.at[1]).toBe(1);
  });
  it("clamps a journey reaching past either end of the scale", () => {
    expect(travelLaps(3, 0.5)).toEqual(travelLaps(2, 0.5));
    expect(travelLaps(0.5, -1)).toEqual(travelLaps(0.5, 0));
  });
});
