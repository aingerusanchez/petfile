import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **The tier wipe has to finish before the close stops covering the bar**, and
 * this is the one place that can say so.
 *
 * A close paints its own laps over the whole bar for `CLOSE_MS`. Underneath
 * it, `GroundTurn` wipes the new ground across the track **over the fills**,
 * so while it runs the bar underneath is the lap being left, with no fill of
 * the lap it is joining. If the wipe outlives the cover, the frames in
 * between show a bar that is one flat ground: the violet band gone, the
 * empty track showing at the far edge where the wipe has not quite arrived.
 *
 * **And that is not the rare coincidence it looks like.** Measured in the
 * browser on an ordinary stop on a day already past the goal: the day's tier
 * dips for a single render between `walkingSince` going null and the close's
 * hold landing, so `painted` drops to 0 and a wipe is armed on almost every
 * stop. At `TURN_MS` 620 the whole of it ran and ended inside the close's
 * 760 ms and nobody ever saw it; at 800 it ran 40 ms past the cover and two
 * e2e specs caught the bar flat — `converts the live band on the lap the
 * ground already turned` and `converts a lapped walk without dropping its
 * second band`, which are specs about the close and have nothing else to do
 * with the wipe.
 *
 * **So the margin is the invariant, not the number.** The two timers are
 * armed in the same commit, so the slack is theirs alone; 50 ms is a frame
 * either way plus room. The real fix — which would let the wipe be as long
 * as it likes — is to stop arming one under a close at all, since a wipe
 * under a close was never visible. Until somebody does that, this test is
 * what stops the next person raising `TURN_MS` and shipping a flash that
 * only shows up two specs away from the line they changed.
 */
const SOURCE = readFileSync(
  join(__dirname, "..", "ui", "GoalBlock.tsx"),
  "utf8",
);

/** The one spelling of each: `const NAME = <digits>;` at the top level. */
function constant(name: string): number {
  const found = SOURCE.match(new RegExp(`^const ${name} = (\\d+);$`, "m"));
  if (!found) throw new Error(`${name} is not a plain number any more`);
  return Number(found[1]);
}

describe("the tier wipe and the close", () => {
  it("finishes before the close stops covering the bar", () => {
    expect(constant("TURN_MS")).toBeLessThanOrEqual(constant("CLOSE_MS") - 50);
  });
});
