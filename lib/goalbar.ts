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
 * `topTierMinutes` is the one place that ratio lives: the measure's denominator
 * and the calendar's tiers call it, and nothing else multiplies a goal by two.
 * Because a position anywhere on the bar is one scalar, a close that crosses a
 * tier is one interpolation between two of them and needs no special case: the
 * animation walks from `from` to `to` and `barStateAt` says what each frame
 * looks like.
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
 * The minutes at the top of the bar: the goal, once per lap. The measure counts
 * against this, and so must anything else that reads the top tier.
 */
export function topTierMinutes(goalMinutes: number): number {
  return goalMinutes * TOP_TIER;
}

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
 *   the scale above. It may cross a tier, or both; nothing special is needed.
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

  return { kind: "fill", from, to };
}
