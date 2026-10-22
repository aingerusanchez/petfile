/**
 * The goal bar as one number, and what the close of a walk does to it.
 *
 * **Lives in `lib/` for the reason `markdown.ts` does.** The bar says two
 * things at once — which tier of the goal the day has reached, and how far it
 * is toward the next — and the animation that runs when a walk is saved says a
 * third: "this much has just been saved". Every one of those is a comparison
 * against a goal. A wrong case does not throw: it paints the day's effort at
 * the wrong tier or in the wrong colour, and tells the tutor a goal was
 * reached when it was not, or the other way round. A pure function takes these
 * cases in a few milliseconds; the component that animates the result cannot.
 *
 * **The scale is one number, and that is the whole design.** The integer part
 * is the tier reached and the fraction is progress through it: `0.5` is halfway
 * to the goal, `1` is the goal, `1.5` is halfway through the second lap, `2` is
 * double. Tier 2 is computed as double tier 1 — there is no second goal stored.
 * **`TOP_TIER` is the one place that ratio lives**, and every surface reaches
 * it through this module rather than multiplying a goal of its own: the
 * calendar and the bar through `barProgress`/`barStateAt`. Nothing outside
 * this file doubles a goal — and since v0.19.0 nothing outside it needs the
 * doubled number in words either, because the measure no longer counts
 * against a ceiling. `topTierMinutes` went with that sentence.
 * Because a position anywhere on the bar is one scalar, any stretch of it is
 * one interpolation between two points and needs no special case: the
 * animation walks from `from` to `to` and `barStateAt` says what each frame
 * looks like. **Since v0.20.0 a close never crosses a tier** — the ground
 * follows the walk in progress, so the crossing has already happened by the
 * time the stop is pressed and `closeMotion` hands over a stretch inside one
 * lap. The lap arithmetic stays where it is: it is what decides *which* lap
 * that is, and a boundary computed a second way is a bar that turns colour
 * where the measure says it should not.
 *
 * **`closeMotion` takes `recordedBefore` and adds.** The caller holds the total
 * from *before* the walk closed — the value the component already has while the
 * server reload is in flight. The previous contract took the total *after* the
 * close and subtracted the closed minutes to find where the stretch began, and
 * that was a real defect: depending on whether the reload had landed yet, that
 * total might or might not already include those minutes, so the stretch began
 * at the wrong place. The pre-close total is the one number the
 * caller is certain about, so the minutes are added to it, never subtracted
 * from a total that may contain them.
 */

/** The bar stops at two laps; a day past double cannot be shown further. */
const TOP_TIER = 2;

/**
 * The bar as one number: the integer part is the tier reached, the fraction
 * is progress through it. Null when there is no bar to draw.
 */
export function barProgress(
  walkedMinutes: number,
  goalMinutes: number | null,
): number | null {
  if (goalMinutes === null || goalMinutes <= 0) return null;
  return Math.min(TOP_TIER, Math.max(0, walkedMinutes / goalMinutes));
}

export type BarState = { tier: 0 | 1 | 2; fill: number };

/**
 * Any point of that scale as something to draw: a ground and a 0–100 fill.
 *
 * An exact tier sits at the foot of its own lap (`1` is tier 1, fill 0), not at
 * the head of the last — the ground is the tier reached, and the goal has been
 * reached. The top is the one exception: there is no third lap to start, so `2`
 * is tier 2 with the fill full.
 */
export function barStateAt(progress: number): BarState {
  const held = Math.min(TOP_TIER, Math.max(0, progress));
  if (held >= TOP_TIER) return { tier: TOP_TIER, fill: 100 };
  const tier = Math.floor(held) as 0 | 1;
  return { tier, fill: (held - tier) * 100 };
}

/**
 * - `fill` — the walk added a stretch of bar: animate from `from` to `to` on
 *   the scale above. Since v0.20.0 the two ends are always inside one lap;
 *   see `closeMotion`.
 * - `none` — there is no bar (no goal, or a goal of zero), the walk added
 *   nothing, or the day was already past the top tier, where the minutes it
 *   added fall off the end of the bar and there is no stretch to point at.
 */
export type CloseMotion =
  { kind: "none" } | { kind: "fill"; from: number; to: number };

/**
 * `recordedBefore` is the total *before* this walk closed — the value the
 * component already holds while the reload is in flight. The minutes are
 * added to it, never subtracted from a total that may or may not include
 * them yet.
 *
 * **The fill begins at the foot of the lap the close lands on, and that is
 * what keeps one moment to one mechanism** (v0.20.0). The bar's ground
 * follows the day's minutes including the walk in progress, so by the time a
 * stop is pressed the ground has already turned for everything that walk
 * crossed — the only thing still showing as live is the band on the top lap.
 * A fill that began at the recorded minutes would open by painting the lap
 * *below* back over a bar that turned minutes ago, which is a backwards step
 * of exactly the kind the close exists to remove. So the close converts a
 * band and never turns a ground; the ground is turned once, where the
 * minutes turned it.
 *
 * **The silence is still decided on the raw total**, not on the clamped one:
 * only a day that was *already* past the top tier before this walk says
 * nothing. A walk that carries the day to the top is a `fill` of zero length
 * — nothing left to convert, because the bar is already violet throughout —
 * and it is kept rather than refused because the block hangs its hold of the
 * day's total on it.
 */
export function closeMotion(input: {
  recordedBefore: number;
  closedMinutes: number;
  goalMinutes: number | null;
}): CloseMotion {
  const { recordedBefore, closedMinutes, goalMinutes } = input;

  if (closedMinutes <= 0) return { kind: "none" };

  const from = barProgress(recordedBefore, goalMinutes);
  const to = barProgress(recordedBefore + closedMinutes, goalMinutes);
  if (from === null || to === null) return { kind: "none" };
  if (from >= TOP_TIER) return { kind: "none" };

  return { kind: "fill", from: Math.max(from, barStateAt(to).tier), to };
}

/**
 * One lap of the bar as the close travels across it: when it is converted,
 * and what its fill reads at the two ends of that stretch.
 *
 * **A close is one interpolation, and this is how a component draws it
 * without doing tier arithmetic of its own.** The scale is continuous and the
 * bar is not: at every integer the ground turns and the fill wraps to zero, so
 * a single animated number cannot be turned into a width without knowing where
 * those boundaries fall. Cutting the stretch into laps here puts the whole of
 * that knowledge beside `barStateAt`, which is the same reason the scale lives
 * in this file at all — a lap boundary computed a second way is a bar that
 * turns colour at a place the measure disagrees with.
 *
 * `at` is the slice of the close this lap owns, 0–1 of the whole animation, so
 * one shared value drives every lap. `fill` is that lap's own fill at those
 * two instants, 0–100 of the bar's width. The last lap of a close that reaches
 * the very top reads `[0, 0]`: there is no third lap to paint, so the ground
 * is the whole sentence — the same silence `barStateAt` keeps there.
 */
export type CloseLap = {
  tier: 0 | 1 | 2;
  at: [number, number];
  fill: [number, number];
};

/**
 * Where a point of the scale sits inside one lap, 0–100, clamped to it.
 *
 * **Exported because the bar draws two points on one lap** (v0.20.0): the
 * lap the day is on carries the recorded minutes and the live ones, and the
 * recorded total may sit below the lap's own floor — a walk in progress
 * carried the day up here and nothing has been saved on this lap yet. That
 * reads 0, which is the right answer and not a special case.
 */
export function lapFill(progress: number, tier: number): number {
  return Math.min(100, Math.max(0, (progress - tier) * 100));
}

/**
 * The laps a close crosses, in the order it crosses them, from the two ends
 * `closeMotion` returns.
 *
 * A close inside one lap is one entry, which since v0.20.0 is every close
 * `closeMotion` produces. The crossing cases below are the function's own
 * contract rather than dead weight: it is `closeMotion` that decides where a
 * stretch begins, and this is the one place that knows what a stretch
 * crossing a boundary would look like if one ever did.
 */
export function closeLaps(from: number, to: number): CloseLap[] {
  const start = Math.min(TOP_TIER, Math.max(0, from));
  const end = Math.min(TOP_TIER, Math.max(start, to));
  const span = end - start;
  const laps: CloseLap[] = [];
  for (
    let tier = barStateAt(start).tier;
    tier <= barStateAt(end).tier;
    tier++
  ) {
    const opens = Math.max(start, tier);
    const closes = Math.min(end, tier + 1);
    laps.push({
      tier: tier as 0 | 1 | 2,
      at:
        span === 0 ? [0, 0] : [(opens - start) / span, (closes - start) / span],
      fill: [lapFill(opens, tier), lapFill(closes, tier)],
    });
  }
  return laps;
}
