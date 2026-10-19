import { closeMotion } from "../goalbar";

describe("closeMotion", () => {
  it("lands the stretch the walk just added", () => {
    expect(
      closeMotion({ walkedMinutes: 60, closedMinutes: 20, goalMinutes: 180 }),
    ).toEqual({
      kind: "land",
      stretch: { start: (40 / 180) * 100, end: (60 / 180) * 100 },
      met: false,
    });
  });

  it("says the bar lands Aqua when the walk reached the goal", () => {
    const motion = closeMotion({
      walkedMinutes: 185,
      closedMinutes: 30,
      goalMinutes: 180,
    });
    expect(motion).toMatchObject({ kind: "land", met: true });
  });

  it("stops the stretch at the bar's edge rather than past it", () => {
    const motion = closeMotion({
      walkedMinutes: 300,
      closedMinutes: 200,
      goalMinutes: 180,
    });
    expect(motion).toEqual({
      kind: "land",
      stretch: { start: (100 / 180) * 100, end: 100 },
      met: true,
    });
  });

  it("keeps the swell and drops the rest when the goal was already met", () => {
    // 200 recorded before this walk, against a 180 goal: the bar was full and
    // Aqua when it started, and the minutes it added cannot be shown.
    expect(
      closeMotion({ walkedMinutes: 230, closedMinutes: 30, goalMinutes: 180 }),
    ).toEqual({ kind: "swell" });
  });

  it("does nothing without a bar to animate", () => {
    expect(
      closeMotion({ walkedMinutes: 30, closedMinutes: 30, goalMinutes: null }),
    ).toEqual({ kind: "none" });
    expect(
      closeMotion({ walkedMinutes: 30, closedMinutes: 30, goalMinutes: 0 }),
    ).toEqual({ kind: "none" });
  });

  it("does nothing for a walk that added no minutes", () => {
    expect(
      closeMotion({ walkedMinutes: 60, closedMinutes: 0, goalMinutes: 180 }),
    ).toEqual({ kind: "none" });
  });
});
