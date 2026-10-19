/**
 * Which of three things the goal bar does when a walk is stopped and the
 * server confirms it.
 *
 * **Lives in `lib/` for the reason `markdown.ts` does.** The animation says one
 * sentence — "this much has just been saved" — and which stretch of the bar
 * that points at, and whether the bar ends Aqua, are comparisons against a
 * goal. A wrong one does not throw: it paints the bar as met when it is not,
 * or the other way round, and tells the tutor the day's goal was reached when
 * it was not. A pure function takes six cases in a few milliseconds; the
 * component that animates the result cannot.
 *
 * **`walkedMinutes` already includes the walk just closed**, because it is the
 * total of closed walks and this one has become closed. What was recorded
 * *before* it is therefore `walkedMinutes - closedMinutes`, and that is where
 * the stretch starts.
 *
 * Three cases:
 *
 * - `land` — the walk added a stretch of bar, so the stretch is the thing to
 *   point at. `met` says the bar ends Aqua, which is also the signal that what
 *   sits before `start` has to travel from the recorded grey rather than
 *   staying put.
 * - `swell` — the bar was already full before this walk. "This much has just
 *   been saved" has no stretch to point at: the minutes it added fall past the
 *   bar's edge and cannot be drawn, so only the thickness beat plays.
 * - `none` — there is no bar at all (no goal, or a goal of zero), or the walk
 *   added nothing, so nothing was saved and nothing is said.
 */
export type CloseMotion =
  | { kind: "none" }
  | { kind: "swell" }
  | { kind: "land"; stretch: { start: number; end: number }; met: boolean };

/** A percentage of the bar, held to the bar: a walk past the goal stops at its edge. */
function onBar(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}

export function closeMotion(input: {
  walkedMinutes: number;
  closedMinutes: number;
  goalMinutes: number | null;
}): CloseMotion {
  const { walkedMinutes, closedMinutes, goalMinutes } = input;

  if (goalMinutes === null || goalMinutes <= 0) return { kind: "none" };
  if (closedMinutes <= 0) return { kind: "none" };

  const before = walkedMinutes - closedMinutes;
  if (before >= goalMinutes) return { kind: "swell" };

  return {
    kind: "land",
    stretch: {
      start: onBar((before / goalMinutes) * 100),
      end: onBar((walkedMinutes / goalMinutes) * 100),
    },
    met: walkedMinutes >= goalMinutes,
  };
}
