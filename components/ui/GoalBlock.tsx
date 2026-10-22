import { Play, Square } from "lucide-react-native";
import { useEffect, useId, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type LayoutChangeEvent,
  Pressable,
  View,
} from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { type Walked, formatDuration, formatWalked } from "../../lib/duration";
import {
  type BarState,
  type CloseLap,
  barProgress,
  barStateAt,
  closeLaps,
  closeMotion,
  lapFill,
} from "../../lib/goalbar";
import type { DurationFormat } from "../../lib/settings";
import { elapsedMinutes } from "../../lib/walk";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * How often the counter catches up with the clock, in ms.
 *
 * Half a minute, so a displayed minute is never more than thirty seconds
 * stale, and nothing on this screen re-renders every second for an hour.
 */
const TICK_MS = 30_000;

/**
 * One heartbeat of the dot: how long it takes, how far the dot dims, and how
 * far the ripple travels.
 *
 * **Slower than `Skeleton`'s 900ms, and that is the point.** A skeleton pulses
 * for a few hundred milliseconds while something arrives; this pulses for the
 * length of a walk. An animation that runs for an hour has to be calmer than
 * one that runs for a second, or it stops being a signal and becomes a nag.
 * `PULSE_MS` is the whole cycle — the dot dims and comes back, and the ripple
 * leaves and fades once — which is the 1400 ms down and 1400 ms up it already
 * was, so the calm the tutor approved is unchanged.
 *
 * **The trough is 0.55, and it was 0.3.** Photographed on the device the dot
 * was caught at its trough and read grey rather than Aqua. Aqua Glaciar at
 * 0.3 composites over the Polar Night ground to a colour that measures 2.04:1
 * against it (1.98:1 on the device photograph); at 0.55 it measures 4.09:1,
 * and 11.08:1 at the peak. A pulse that spends half its cycle near 2:1 is a
 * flicker, not a pulse — the same defect this round removed from the
 * in-progress segment, where a 1.64:1 element "did not read as a measure of
 * anything". **Do not lower it again**: the dot is the only thing that says
 * the walk is recording.
 *
 * **The ripple is 20 dp across at its largest** (the 8 dp dot at 2.5x), which
 * is 6 dp beyond the dot on each side — inside the 8 dp gap to the measure, so
 * even at its brightest it never reaches the text. It starts at `RIPPLE_ALPHA`
 * and is gone by the end of the cycle.
 */
const PULSE_MS = 2800;
const DOT_DIM = 0.55;
const RIPPLE_SCALE = 2.5;
const RIPPLE_ALPHA = 0.6;

/**
 * The band that crosses the track while a walk runs: how wide it is, how tall
 * it is (the bar's own height), how long one crossing takes, and how strong it
 * is on each ground.
 *
 * **The band is the opposite tone to the ground it crosses**, so it is always
 * a lightening or a darkening of what is under it. The alpha is the peak of
 * the gradient, not a flat tint.
 *
 * **One bar, two grounds — which is why the rule is applied per region and
 * not per state.** Measured on the device: a `textPrimary` band at 0.55 over
 * the dark track (`surface`, red channel 19) reads **142**, a lift of +123;
 * the same band over the recorded fill (`text-secondary`, 205) reads **225**,
 * a lift of +20. Six times less, and on the third walk of the day most of the
 * bar *is* recorded fill, so the band travelled invisibly until it crossed
 * into the dark part. Left of the junction the band is therefore `onAccent` at
 * `SWEEP_ALPHA_MET` — predicted 205 − 0.35 × (205 − 12) = **137**, a fall of
 * −68 — and right of it, over the dark track and the in-progress segment, it
 * is `textPrimary` at `SWEEP_ALPHA` exactly as before. Once the goal is met
 * there is one dark band over the whole bar, and that survived the tiers for
 * a reason rather than by accident: lap two is violet on an Aqua ground, and
 * both of those are lighter than the dark track the pale band was made for.
 * A single dark band is the opposite tone of everything it crosses there.
 *
 * **It was briefly a wave, 10 dp tall and lens-shaped, and that is gone.**
 * Height reads whatever colour it crosses, so it was built as a second answer
 * alongside the tone — and once the tone was measured on the device at −67 the
 * height had nothing left to fix. What it still cost was the half of the bar
 * that was never broken: over the dark track the flat band already lifted the
 * channel by 123 and read clean, and the lens turned it into a blob. The
 * tutor's word was "tosca". **An insurance that disfigures what already worked
 * is not worth its premium** — the band is 4 dp again, the bar's own height.
 *
 * **2.4 s a crossing, linear**, a little quicker than the dot's 2.8 s
 * heartbeat, so the two never settle into lock-step.
 */
const SWEEP_WIDTH = 70;
const SWEEP_MS = 2400;
const SWEEP_ALPHA = 0.55;
const SWEEP_ALPHA_MET = 0.35;
const BAND_HEIGHT = 4;

/**
 * How long the close takes: one conversion, from the junction to the end of
 * the minutes just saved.
 *
 * **The swell and the sheen are gone, and so is the stumble they followed.**
 * Frames from the tutor's video: the bar painted to x=403 while the walk ran,
 * dropped to x=207 for about 400 ms as the live segment unmounted ahead of the
 * reload, then grew back and swelled. The word for the beat was _tosca_, and
 * it fitted the sequence more than the beat — a square widening arriving after
 * a hole. Nothing is thickened now and nothing crosses: the live segment is
 * **held painted** and the fill converts it left to right, so the frame the
 * tutor complained about stops existing rather than being decorated.
 *
 * **One interpolation, whatever it crosses.** `closeLaps` cuts the stretch at
 * the tier boundaries and every lap reads the same shared value, so a close
 * that turns the bar Aqua on the way is one gesture that changes colour as it
 * passes a threshold, not two animations in sequence.
 *
 * 760 ms is what it was: long enough to read as a movement on a stretch 3 dp
 * wide, short enough that the next tap is never waiting on it.
 */
const CLOSE_MS = 760;

/**
 * How long the new ground takes to wipe across the bar when the day crosses a
 * tier, and the curve it travels on.
 *
 * **Crossing the goal is two substitutions, and landing them on one frame
 * reads as a cut.** Confirmed on the tutor's walk: the ground gains colour
 * (the empty track to Aqua) and the fill changes hue (Mist to Aurora Boreal)
 * in the same paint, and the bar stops reading as one bar changing — it reads
 * as a different bar. Each half on its own is legible; it is the simultaneity
 * that is the defect.
 *
 * v0.18.0 answered that by **ordering them in time**: the ground turned and
 * the fill followed 150 ms later. v0.20.0 replaces the gap with the gesture
 * the moment deserves, and **one mechanism is the whole point of the
 * change.** Now that the ground follows the walk in progress, the crossing
 * happens where the dog reached the goal rather than where the tutor pressed
 * stop — and at 99 % of lap one going to 100 % there was nothing to see. So
 * the new ground **wipes across the bar from left to right** over the picture
 * the bar had, and the lap underneath — ground and fill together — is
 * substituted when the wipe arrives. A stagger underneath a wipe would be two
 * answers to one question, and the second would be invisible anyway: the
 * fill it staggers is covered by the wipe until the last frame.
 *
 * **620 ms, eased out.** It repeats the gesture the bar has just finished —
 * a fill that spent the morning travelling left to right and arrived — so it
 * decelerates into the end of the bar rather than scanning across at a
 * constant speed. Eased *in* would read as a swipe wiping the bar clean. The
 * number is placed between the two animations it must not be confused with:
 * clear of the failure shake's 400 ms, so a crossing is never read as a
 * refusal, and under the close's 760 ms, which is what lets a close that
 * turns a ground cover this entirely (see below).
 *
 * **It is gated on `useReducedMotion`, where the 150 ms gap was not.** The
 * gap had no movement in it to remove; this does, so under "remove
 * animations" the whole bar substitutes on one frame — the cut, which is the
 * honest static form of a wipe, and the line the rest of the app draws.
 *
 * **A close can still cover it, and that is why it stays shorter.** The
 * ground has normally turned long before the stop, but the server's minutes
 * can be a minute ahead of the block's own clock and land the day over a tier
 * on the stop itself. A close paints its own laps over the whole bar for
 * `CLOSE_MS`, so the wipe underneath is never seen — the tutor called that
 * animation «genial, incluso cuando salta de tier», and it is untouched.
 * What the wipe is for is every crossing the close is not covering: the walk
 * in progress reaching the goal, a walk written through the sheet, a reload
 * bringing in the other tutor's, a goal edited under the day.
 *
 * **Only upwards.** A tier lost — a walk deleted, the goal raised, a hold
 * released — substitutes at once: there is nothing to announce, and a wipe
 * would announce it.
 */
const TURN_MS = 620;

/**
 * The shake a failed start or stop gives the control: how long it takes, how
 * far it travels, and how many times it goes there and back.
 *
 * **4 dp is the ceiling, and it is chosen against the 48 dp the thumb is
 * aiming at.** The control is at least `TOUCH_TARGET` (48 dp) in each
 * direction; the shake moves the pill, and so the target the thumb is on,
 * sideways. At 4 dp the pill is never more than a twelfth of a 48 dp target
 * off where the finger found it, so a second press during the shake still
 * lands on it — which is the whole point, since the walk is still running and
 * the next thing the tutor does is press stop again. A shake big enough to
 * read from across the room would be one that moves the control out from
 * under the retry. The amplitude decays to nothing,
 * so the largest excursion is the first and the pill ends exactly where it
 * began.
 *
 * **Three swings in 400 ms** is a judgement, not a measurement: slow enough to
 * read as "no" rather than as a tremor, and brief enough that the control is
 * back in place before a retry. It has not been tried on a device yet.
 */
const SHAKE_MS = 400;
const SHAKE_DP = 4;
const SHAKE_SWINGS = 3;

/**
 * The mark at the junction of the bar, in dp: how wide, how tall, and how far
 * it stands above the track.
 *
 * **2 dp by 12 dp, centred on the junction**, so it stands 4 dp proud of the
 * 4 dp track above and below. `TICK_RISE` is that overhang; the track's own
 * height is spelled `h-[4px]` in the class list, for the reason given there.
 */
const TICK_WIDTH = 2;
const TICK_HEIGHT = 12;
const TICK_RISE = 4;

/**
 * The transport glyph's box, in dp: the size of the Play and Square icons, and
 * of the box the spinner stands in for them in while the write is in flight.
 *
 * **One name for all three, because they were three literals.** Change the
 * icons and leave the spinner's box alone, and the glyph changes width as it
 * is swapped — on top of the width the word itself changes by while the write
 * is in flight, which is a decision and is written up at the label.
 */
const GLYPH_SIZE = 16;

/**
 * What the measure says when the day's minutes could not be read.
 *
 * **Its whole job is to be neither a number nor a zero.** It is spoken in
 * full by the measure's `accessibilityLabel`, because four words on one line
 * beside the control cannot both fit and be unambiguous.
 */
const UNREAD = "Sin datos del día";

/**
 * What the bar is painted in, by the tier the day has reached.
 *
 * **The ground is the tier reached and the fill is the way to the next**, so
 * one row of this table is read at a time: `ground` is the whole track once
 * that tier is behind the day, and `saved` / `live` are the lap drawn over
 * it. A day below the goal is row 0 — the empty track with Mist filling it,
 * which is the bar exactly as it was before there were tiers. A day that has
 * reached the goal is row 1: the whole bar Aqua, with Aurora Boreal filling
 * over it. A day past double is row 2, violet throughout, and its `saved` and
 * `live` are never drawn because there is no third lap to start.
 *
 * **Saved and in-progress stay a tone apart on every lap**, with the tick
 * between them — the tiers are orthogonal to that, and all that changes is
 * which pair the lap wears.
 *
 * **One spelling of each colour, and the close uses the same one.** Every
 * layer here and in the close is a `View` taking a `className`, so the value
 * lives in `global.css` and nothing else. This table used to carry a second,
 * `tokens.ts` copy of each tone for the close to interpolate between in a
 * worklet; the close no longer travels through a colour — what travels is
 * which of these layers is covering the pixel — so the copy went with it, and
 * with it the one place these two spellings could drift apart.
 */
const LAPS = [
  {
    ground: "bg-surface",
    saved: "bg-text-secondary",
    live: "bg-text-tertiary",
  },
  {
    ground: "bg-accent",
    saved: "bg-accent-focus",
    live: "bg-accent-focus-dim",
  },
  {
    ground: "bg-accent-focus",
    saved: "bg-accent-focus",
    live: "bg-accent-focus",
  },
] as const;

/**
 * A close as something to draw: the laps it crosses, decided once.
 *
 * **Decided once, from `closeMotion`'s own two endpoints**, rather than read
 * from props as it runs: the reload lands somewhere inside these 760 ms and
 * moves `walked` underneath, and an animation that re-read the laps would
 * change its mind about which ground it was heading for mid-gesture. The id
 * is carried so a second close inside the window is a new animation rather
 * than a reconciliation into the first one's shared value.
 */
type ClosePaint = {
  id: string;
  laps: CloseLap[];
};

/**
 * What one lap of a close shows at `t`, 0–100 of the bar.
 *
 * **Clamped at both ends, and the lower clamp is load-bearing.** Before a
 * lap's own slice opens this reads its *start* fill — which for every lap
 * after the first is zero — so that lap's held band already spans the whole
 * of itself from the first frame of the close. That is what carries a lapped
 * walk's second band through the slice belonging to the lap underneath it:
 * the band is not withheld and then introduced, it is there from the start
 * and the fill eats into it when its turn comes. A guard that zeroed the band
 * until its lap opened would reinstate, inside the close, the backwards step
 * the close exists to remove — and `converts a lapped walk without dropping
 * its second band` is the spec that fails if anybody adds one.
 *
 * A lap with no length — the empty lap a close landing exactly on a tier
 * opens — reads its end value the instant it is reached, rather than dividing
 * by a zero-length slice.
 */
function lapFillAt(
  t: number,
  at0: number,
  at1: number,
  from: number,
  to: number,
): number {
  "worklet";
  if (t <= at0) return from;
  if (t >= at1) return to;
  return from + (to - from) * ((t - at0) / (at1 - at0));
}

/**
 * The day's walking, and the control that starts and stops it.
 *
 * **The only place on this screen that already talks about walks**, which is
 * why it gains the control by changing state rather than by growing one.
 * Nothing floats: the floating action keeps the corner it has.
 *
 * **The ground is the tier the day reached, and the fill is the way to the
 * next.** The goal has two tiers: the one the tutor set, and double it,
 * derived rather than stored. Below the goal the bar is the empty track with
 * Mist filling it, which is what it always was; at the goal the whole bar
 * turns Aqua and Aurora Boreal begins to fill over it; past double the whole
 * bar is Aurora Boreal and there is nothing left to fill. `LAPS` is the
 * table.
 *
 * **The bar is the only place the goal is said, and the measure above it no
 * longer counts against anything** (v0.19.0). It reads `1h 8m en 3 paseos`:
 * what the day did, and in how many walks. The ceiling it used to carry had
 * to be the top tier so the words could not disagree with the bar — and the
 * tutor took the ceiling out, which dissolves the constraint rather than
 * relaxing it. With no denominator there is nothing left that can disagree
 * with the fill.
 *
 * **The ground is the day's minutes, the walk in progress included** — which
 * is new in v0.20.0 and is a rule being lifted rather than a detail. It used
 * to be the *recorded* minutes alone, so that a bar lapping in grey was the
 * signal that something had not been saved; the tutor gave that up
 * deliberately, after the argument for it: the moment worth showing is the
 * one where the dog reached his two hours, not the one where the paperwork
 * was filed, and a walk left running is still there to see in the log's `En
 * marcha` row and in the control's stop glyph. The close keeps what is
 * properly its own — converting the live band into saved tone.
 *
 * **Crossing a tier wipes the new ground across the bar**, because the ground
 * and the fill substituting together read as a cut rather than as one bar
 * changing, and because at the crossing there is otherwise nothing to see at
 * all. `TURN_MS` carries the whole argument, including why a close covers it.
 *
 * **A day landing exactly on the goal has an empty fill, and that is the
 * rule rather than a rounding slip.** It is the foot of lap two, not the head
 * of lap one: at the goal the whole bar is already Aqua, so there is nothing
 * left for a lap-one fill to say.
 *
 * **The minutes of the walk in progress are a dimmer segment at the head of
 * the fill.** They are not stored, so the saved fill keeps measuring what is
 * recorded and the segment shows what is merely happening, a tone apart with
 * the tick between them. That holds on either lap; only the pair of tones
 * changes.
 *
 * **What laps is the whole bar, not a band inside it.** A walk that carries
 * the day past the goal takes the ground with it: the bar turns, and the lap
 * it opens begins with nothing recorded on it, so the live segment is the
 * only thing drawn over the new ground and there is no junction to tick. The
 * band that used to be drawn over a completed lap went with the rule that
 * made it necessary — there is no lap the ground has not admitted to any
 * more.
 *
 * **The segment is static, and a dot says "still going".** It used to breathe,
 * and measured against a 3 h goal on a 327 dp bar it is 3.6 dp wide at two
 * minutes and 38 at twenty-one: there is no animation to be had in 3.6 dp, so
 * the tutor could not see the walk was recording in the very minutes they
 * look hardest. A dot is the same size whatever the walk's length, so the
 * pulse moved there — before the measure, the way a session that is still
 * working is marked. The segment stays because it shows how much is accruing.
 *
 * **A tick marks where the recorded minutes end, and the segment alone could
 * not.** Mist (`text-secondary`) and the segment's tone (`text-tertiary`)
 * measure **1.71:1 against each other**, and on a real walk the tutor could not
 * see where one stopped and the other began — DESIGN.md already records a
 * 1.64:1 element as one that "did not read as a measure of anything". **A
 * different colour is ruled out, by measurement rather than taste:** this bar
 * speaks one pair of tones per lap (the saved one and the live one), Aurora
 * Boreal is spoken for on this very bar — it is the top tier — and every
 * other tonal step in
 * the palette lands in the same 1.16–1.71:1 band that already failed here and
 * forced the chips to carry a weight change instead of a fill. **Nor can any
 * treatment of the segment do it:** against a 3 h goal on a 327 dp bar it is
 * 3.6 dp wide at two minutes, and colour, height or texture cannot be seen in
 * 3.6 dp. A mark at the junction is visible whatever the segment's width.
 *
 * **A tick and not a round thumb, which was proposed first and rejected.**
 * `Slider` draws the app's real slider as a thin track, an Aqua fill and a
 * round 20 dp thumb at the end of that fill. A circle at the end of a fill on
 * a thin track is the shape language for "drag me", and this bar does not
 * drag. A 2 dp line is not a handle: on a track it reads as a point of
 * reference, which is what it is. Do not round it off.
 *
 * **The tick does not pulse.** The dot before the measure does, and the band
 * crosses the track, and both say the same thing: the walk is live. The tick
 * answers a different question — how much of this is already recorded — and a
 * pulse on it would say "live" a third time. It is the one fixed mark among
 * the moving ones, which is what lets it be read as a measurement. It draws
 * only while a walk runs and only where there is a bar, **not before anything
 * is recorded on the current lap** — there is no junction to mark, and the
 * line would hang off the bar's left edge. **It does not move when the
 * segment laps**, either: it marks the saved/live boundary, and that is still
 * where the recorded minutes stop.
 *
 * **The one time it travels is the close**, where the fill's leading edge
 * *is* that boundary for 760 ms. That tick is `CloseLanding`'s own, because
 * this one is gone with the walk by then; the rule it follows is the same.
 *
 * **That one rule now covers the case "the goal is met" used to need its own
 * clause for.** A day exactly on the goal is the foot of lap two with an
 * empty fill, so there is nothing recorded on the lap and no tick — the bar
 * is whole and Aqua and a mark at either end would separate the recorded
 * minutes from nothing. A day *past* the goal with a walk running does have a
 * junction on lap two, and the tick marks it by the same rule it always had;
 * the first draft of the tiers claimed the tick moved to the lap boundary,
 * and it does not. Past double there is no fill at all, so again no tick.
 *
 * **The close is the one moment this block speaks, and `justClosed` is how it
 * is told.** Which of three things it then does is `closeMotion`'s decision,
 * not this component's: a wrong one does not throw, it paints the bar as met
 * when it is not. **It no longer waits for the reload to be told**, which is
 * what the prop's `recordedBefore` buys: both ends of the fill are known the
 * moment the server accepts, so the bar is never left telling the truth of a
 * minute ago while a request is in flight. The caller owes exactly two
 * things — the total from before the walk joined it, and dropping the close
 * as the day in view leaves it.
 *
 * **The block renders with no goal too.** `exercise_goal_minutes` is nullable
 * and the activity question is optional, so gating the whole block on a goal
 * left those tutors with nowhere for the control to live. The goal and the bar
 * come and go; the block does not.
 */
export function GoalBlock({
  walked,
  goalMinutes,
  durationFormat,
  walkingSince,
  onStart,
  onStop,
  busy = false,
  justClosed = null,
  failed = 0,
  testID,
}: {
  /**
   * What the day recorded — the minutes and the walks they came in — or
   * **null when they could not be read**.
   *
   * Null is not zero and the block may not round it down to one: a failed read
   * arrives as no rows, and "nobody walked him" is a claim about the dog that
   * a failed request is no evidence for (PRODUCT.md). On null the measure
   * withholds the number, the fill is not painted and `Día cumplido`
   * is not said — **unless a close is being held**, which is a total the block
   * does know, and then the measure reads that rather than nothing.
   *
   * **One prop and not two, because the two halves are one fact.** The
   * sentence states both and the day is either read or it is not; a count
   * arriving beside a `null` minutes, or from a different read of the rows,
   * is a number the bar underneath would not add up to. See `Walked`.
   */
  walked: Walked | null;
  goalMinutes: number | null;
  durationFormat: DurationFormat;
  /** The walk in progress's start, or null when none is running. */
  walkingSince: Date | null;
  /** Absent on a past day, which has nothing to start. */
  onStart?: () => void;
  onStop?: () => void;
  busy?: boolean;
  /**
   * The walk just closed, or null. The id is what makes it fire once: two
   * walks of the same length are a different animation, and a value check
   * would swallow the second.
   *
   * **`before` is the day at the moment the server accepted**, and it is what
   * makes the fill computable before the reload lands. The caller holds it;
   * this block cannot work it out, because `walked` either does or does not
   * already contain the walk being announced depending on whether the day's
   * rows have come back, and subtracting it from a total that may already
   * lack it is the stale-total defect `closeMotion`'s contract was inverted
   * to remove. **Its count is there for the same reason and not for
   * symmetry:** the row exists from the start of the walk with no length, so
   * the rows count it only once the reload lands, and a block that added one
   * to its own count would announce the third walk of the day as the second.
   */
  justClosed?: {
    id: string;
    minutes: number;
    before: Walked;
  } | null;
  /**
   * Bumped each time a start or a stop came back with an error. A counter
   * rather than a boolean, for the reason `justClosed` carries an id: two
   * failures in a row are two shakes.
   */
  failed?: number;
  testID?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  // **The effect keys on the instant, not on the `Date`.** A parent that
  // builds `new Date(occurred_at)` during render hands over a new object every
  // render; depending on the object would re-run this each time, and now that
  // it refreshes `now` it would be a render loop.
  const since = walkingSince ? walkingSince.getTime() : null;

  useEffect(() => {
    if (since === null) return;
    // **Catch up the moment a walk is running**, not one tick later. `now` was
    // read when the block mounted, so a walk that began while the tutor was on
    // another day would read "0 min" for up to `TICK_MS` after coming back —
    // `elapsedMinutes` clamps the gap rather than failing, so it would just
    // lie. A zero-delay timeout rather than a `setNow` in the body, which the
    // lint rules rightly refuse.
    const refresh = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    // **And again on every return to the foreground.** The shape of the
    // feature is: press start, phone in pocket, walk, phone out, press stop —
    // so the interval above spends the walk throttled or suspended, and the
    // first thing the tutor sees on resume would be a stale count at the one
    // moment the measure is looked at hardest. Nothing is at risk in the data
    // — `stop` computes from instants — but this measure is the only feedback
    // the feature has. The tick stays inside the block rather than being
    // lifted to the screen: it is this component's own number.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearTimeout(refresh);
      clearInterval(timer);
      sub.remove();
    };
  }, [since]);

  const reduceMotion = useReducedMotion();
  /**
   * The close being drawn right now, or null when the bar is at rest.
   *
   * **State, because the overlay has to be absent and not transparent.** The
   * commitment under "remove animations" is that nothing animated exists, and
   * an always-mounted overlay held at zero opacity is still there — a reader
   * meets it, and the e2e suite's `toHaveCount(0)` would be a lie. The other
   * animations here need no state of their own, because their element is
   * mounted whatever they are doing — the dot and the sweep are drawn by a
   * shared value on a node that is already there. The close is the one that
   * has to come and go.
   */
  const [closing, setClosing] = useState<ClosePaint | null>(null);
  /**
   * Where the bar is held while the close's own numbers are ahead of the data.
   *
   * **The fill no longer waits for the reload, so something has to hold its
   * end.** `closeMotion` knows where the bar lands the moment the server
   * accepts; `walked` learns it when the day's rows come back, which may be
   * after the animation has finished, or never. Holding the total the close
   * ended on is what makes the handover invisible in both directions: a
   * slower reload moves nothing on arrival, a faster one does not restart the
   * fill, and a reload that fails leaves the bar where the fill left it
   * rather than snapping back — the failure is the toast's job, not the
   * bar's.
   *
   * **The count rides with it.** The walk that just closed is one the rows
   * will not have until the reload lands, so a count read off them under a
   * hold would say "en 2 paseos" with the third walk's minutes beside it.
   * What is held is the day, both halves of it, exactly as it will read when
   * the rows catch up.
   */
  const [held, setHeld] = useState<{ id: string; walked: Walked } | null>(null);
  /** The close this block has already answered, so a re-render does not replay it. */
  const [answered, setAnswered] = useState<string | null>(null);

  // Primitives rather than the object: the prop is rebuilt by the caller on
  // every render, and anything depending on its identity would fire forever.
  const closeId = justClosed?.id ?? null;
  const closeMinutes = justClosed?.minutes ?? 0;
  const closeRecordedBefore = justClosed?.before.minutes ?? 0;
  const closeWalksBefore = justClosed?.before.walks ?? 0;

  /**
   * **Answered during the render the close arrives on, not from an effect.**
   *
   * This is React's own "adjust state when a prop changes", the shape the day
   * view already uses to drop a close as the day leaves it — and here it is
   * the whole point rather than a style. The frame the stop commits on is the
   * frame `walkingSince` goes null and the live segment unmounts; an effect,
   * or a zero-delay timeout out of one, lands a paint or two later, and those
   * are exactly the frames the bar used to spend showing the truth of a minute
   * ago. Setting the hold and mounting the overlay in the same render means
   * there is no frame between the two.
   */
  if (closeId !== answered) {
    setAnswered(closeId);
    const motion =
      closeId === null
        ? null
        : closeMotion({
            recordedBefore: closeRecordedBefore,
            closedMinutes: closeMinutes,
            goalMinutes,
          });
    // Nothing to say: the walk added no minutes, there is no bar, or the day
    // was already past the top tier, where the minutes it added fall off the
    // end of the bar. That last one is a deliberate silence — the day is
    // already said — and it is also why nothing is held: the bar is already
    // where the close would have put it.
    if (closeId === null || motion === null || motion.kind === "none") {
      setHeld(null);
      setClosing(null);
    } else {
      setHeld({
        id: closeId,
        walked: {
          minutes: closeRecordedBefore + closeMinutes,
          walks: closeWalksBefore + 1,
        },
      });
      // **Under "remove animations" the hold is the whole close.** The bar is
      // painted at the fill's end state on the stop, with no overlay ever
      // mounted — reverting to a wait for the reload would restore the hole
      // for exactly the tutors who asked for less movement. `useReducedMotion`
      // is a constant read once at module load (Reanimated 4.5.1), so this
      // cannot flip under a mounted close.
      setClosing(
        reduceMotion
          ? null
          : { id: closeId, laps: closeLaps(motion.from, motion.to) },
      );
    }
  } else if (
    held !== null &&
    (held.id !== closeId ||
      (walked !== null && walked.minutes >= held.walked.minutes))
  ) {
    // **Released by the data, and once.** The reload has landed and says at
    // least what the close said, so the hold has nothing left to add and the
    // bar reads the rows again — which also means a walk deleted a minute
    // later takes the bar down with it, rather than being propped up by a
    // close nobody can see any more.
    //
    // **Unread minutes release nothing.** Null is the one value that is not a
    // smaller total, it is no total at all, and dropping the hold on it would
    // throw away the only thing anybody knows about the day at the exact
    // moment the rows stopped saying anything.
    setHeld(null);
  }

  useEffect(() => {
    if (closing === null) return;
    // **Keyed on the close itself, so a re-render cannot cut the animation
    // short.** `closing` changes only when a close begins or ends, so the
    // cleanup only ever cancels a window that a newer close has taken over,
    // or one the screen is leaving mid-beat.
    const timer = setTimeout(() => setClosing(null), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  const running = walkingSince ? elapsedMinutes(walkingSince, now) : 0;
  /**
   * **The day as this block will speak it, once**: the rows', or the close's
   * hold while it is ahead of them, or null when neither knows. Everything
   * the block says about the day is read off this one value — the measure's
   * words, both halves of them, the bar's width, the tone of its ground and
   * whether `Día cumplido` appears — so they cannot disagree by construction
   * rather than by discipline.
   *
   * That is the second half of the same defect. The bar already read the
   * hold and the measure read the rows, so for the length of an ordinary
   * close the width led and the number followed, and `Día cumplido`
   * could stand a few hundred milliseconds above a number that did not
   * justify it. On a reload that never came the gap never closed.
   *
   * **The hold is in minutes and walks, not in a place**, so a goal edited
   * while it stands is read on the new scale rather than pinning the bar to
   * a proportion of a goal that no longer exists.
   */
  const shown: Walked | null =
    held !== null && (walked === null || held.walked.minutes > walked.minutes)
      ? held.walked
      : walked;
  /**
   * The recorded minutes' place on the two-lap scale. Null is "there is
   * nothing to draw" — no goal, a goal of zero, or minutes nobody could read.
   */
  const progress =
    shown === null ? null : barProgress(shown.minutes, goalMinutes);
  /**
   * Where the walk in progress has carried the day, on the same scale.
   *
   * **Added to `shown`, so the live total starts where the recorded one
   * ends** rather than to the rows, which the bar is not always reading. And
   * null when the day's minutes are unknown: a running walk's own length is
   * known, but a total it is added to is not.
   */
  const liveAt =
    walkingSince && shown !== null
      ? barProgress(shown.minutes + running, goalMinutes)
      : null;
  /**
   * **The place the bar speaks: the live total while a walk runs, the
   * recorded one otherwise** (v0.20.0).
   *
   * This one line is the rule being lifted. The ground used to be the tier
   * the *recorded* minutes reached, and a walk in progress could only add a
   * band inside the lap it was on; now the day's minutes are the day's
   * minutes, walked and saved alike, and the whole bar follows them. The
   * tutor's own words: «vamos a dejar de jugar a la defensiva con los paseos
   * no guardados». A forgotten running walk will read as a finished day on
   * this bar, knowingly — the log's row says `En marcha` and the control
   * shows a stop, and the rest is the tutor's to correct.
   *
   * Null reads as the foot of the first lap so that nothing downstream has
   * to repeat the check.
   */
  const at = liveAt ?? progress;
  const state: BarState = at === null ? { tier: 0, fill: 0 } : barStateAt(at);
  /**
   * **`met` is the day's minutes covering the goal, the walk in progress
   * included** — and that is not negotiable, because the label and the ground
   * are two descriptions of one day shown at once. v0.15.0 went entirely into
   * making them unable to disagree; putting the ground on live minutes and
   * leaving the words on saved ones would reopen that defect for as long as a
   * walk runs. `metX2` is the same claim about the top tier. Both are read
   * off the scale rather than recomputed from the minutes.
   *
   * **The celebration does not read this, and must not.** It still fires on
   * the save, from the screen's own threshold — a description follows the
   * data, a celebration follows the viewer, and during a walk the phone is in
   * a pocket where confetti is confetti nobody sees.
   */
  const met = at !== null && state.tier >= 1;
  const metX2 = at !== null && state.tier === 2;
  /**
   * The tier the bar is **painted** at, which lags the day's across a
   * crossing while the new ground wipes over it.
   *
   * **State and a timer, because what is staged is which picture the layers
   * are drawing, not a number to interpolate.** It starts at whatever tier
   * the block mounts on, so landing on the screen, paging to another day and
   * a reload all paint the day they find with no wipe at all — a crossing is
   * a tier changing *under* a mounted block, which is the only time there is
   * anything to announce.
   */
  const [painted, setPainted] = useState<0 | 1 | 2>(state.tier);
  const tier = state.tier;

  // **A tier lost is taken at once, in the render it arrives on.** A walk
  // deleted, a goal raised, a hold released onto smaller rows: there is
  // nothing to announce, and holding the higher picture for 620 ms would be
  // the bar standing by a day it no longer has. React's own "adjust state
  // when a prop changes", the shape this block already uses for a close.
  if (tier < painted) setPainted(tier);

  useEffect(() => {
    if (painted >= tier) return;
    const timer = setTimeout(
      () => setPainted(tier),
      reduceMotion ? 0 : TURN_MS,
    );
    return () => clearTimeout(timer);
  }, [painted, tier, reduceMotion]);
  /**
   * Whether a wipe is crossing the bar right now.
   *
   * **Under "remove animations" there is no wipe and so no lag**: the
   * substitution lands on one frame and `painted` catches up behind it,
   * unread.
   */
  const turning = !reduceMotion && painted < tier;
  /**
   * **The control is a stop as soon as the caller has one, not as soon as the
   * row has arrived.** A start writes the row and asks for a reload, and
   * `walkingSince` comes out of that row — so between the two there is a walk
   * running and nothing here to show for it. The caller hands `onStop` over
   * the moment it knows, with `busy` set, and the block shows a disabled stop
   * until the row lands rather than taking the control off the screen under
   * the thumb that just pressed it.
   */
  const stopping = onStop !== undefined;
  const control = stopping ? onStop : onStart;
  // **The one line that decides the control's look: outlined when idle, filled
  // when running.** That is variant C. Variant A, filled in both states, was
  // built and photographed on the device against this one and lost: a
  // permanently filled Aqua pill was the brightest thing on the screen, brighter
  // than the floating action, which means "this is the one thing to do here".
  // The rule is The Unfinished-Thing Rule in DESIGN.md — a filled control is
  // reserved for the thing that is not finished. Do not make `filled` constant
  // again to try A; read the rule first.
  const filled = stopping;
  // **Both transport glyphs are solid, and `fill` takes the same token as the
  // stroke** so the two cannot drift apart. Idle, the triangle is solid Aqua;
  // running, the square is solid `onAccent` — the pill's own ground — so it
  // reads as a hole punched in the fill rather than a shape drawn on it. The
  // outlined square it replaced read as a checkbox on a dark ground, and a
  // transport control is a solid shape by convention.
  const glyph = filled ? colors.onAccent : colors.accent;

  /**
   * **The lap the track is drawing, which is the one the day is on except
   * while a wipe is crossing it.** During a wipe the bar holds the lap it is
   * leaving — complete, because the day walked through it — and the new
   * ground is painted over the top by `GroundTurn`. Holding the whole picture
   * rather than only its tones is what keeps the crossing from flashing: the
   * lap being left is full, and substituting it for a lap that has barely
   * begun would empty the bar for the length of the gesture meant to fill it.
   */
  const lap = LAPS[turning ? painted : tier];
  /**
   * The fills, as percentages of the bar, **within the lap being drawn**.
   *
   * **Nothing is painted over the top tier.** `barStateAt` reports a full
   * fill there, because the scale has nowhere further to go, but there is no
   * third lap to draw: the ground is the whole bar and every fill is nothing.
   * A walk running on such a day adds minutes that cannot be shown, which is
   * the same silence the close keeps.
   *
   * **`recorded` is where the saved minutes stop on this lap, and it can be
   * zero on a lap the day is standing on** — the walk in progress carried it
   * here and nothing has been saved up here yet. That is also why there is
   * no tick then: there is no junction, which is the rule the mark already
   * had. `inProgress` is the rest of the lap's fill, which is the walk.
   *
   * During a wipe both are read against the lap being left, which the day has
   * passed: the saved minutes stop where they stopped, and the walk in
   * progress is everything from there to the end of the lap.
   */
  const drawn = turning ? painted : tier;
  const recorded =
    drawn === 2 || progress === null ? 0 : lapFill(progress, drawn);
  const inProgress = turning
    ? 100 - recorded
    : drawn === 2
      ? 0
      : Math.max(0, state.fill - recorded);

  return (
    <View testID={testID} className="mb-8">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        {/* The dot sits inside the measure's own flexible slot, so it costs the
            text eight dp and a gap rather than pushing the control. */}
        <View className="flex-1 flex-row items-center gap-2">
          {walkingSince ? (
            <PulseDot testID={testID ? `${testID}-dot` : undefined} />
          ) : null}
          <Text
            testID={testID ? `${testID}-measure` : undefined}
            numberOfLines={1}
            // **Shown short, spoken long**, the way the top tier's mark is.
            // One line beside the control is no room for the sentence, and
            // "Sin datos del día" could be read as a quiet way of saying the
            // day holds nothing — which is the very reading this whole state
            // exists to refuse. Aloud it says which of the two it means. The
            // log's own region below carries the message and the Reintentar.
            accessibilityLabel={
              !walkingSince && shown === null
                ? "No se han podido leer los paseos de este día"
                : undefined
            }
            className={`shrink font-semibold ${walkingSince ? "text-accent" : "text-text-primary"}`}
          >
            {walkingSince
              ? `De paseo · ${formatDuration(running, durationFormat)}`
              : shown === null
                ? // **The day's minutes could not be read, so no number is
                  // stated.** Not "0 min", which is a claim about the dog, and
                  // not the previous day's total either.
                  UNREAD
                : // **One sentence, goal or no goal, because the goal was
                  // never its subject.** It used to end `de 4h` — the top
                  // tier, so the words could not disagree with a bar that
                  // runs to double — and the tutor removed the ceiling: this
                  // part of the screen is about what the day did, not what it
                  // is short of. The pet with no goal used to need a branch
                  // of its own here and now reads the same line as everyone
                  // else. `formatWalked` carries the whole argument, the zero
                  // form and the plural.
                  formatWalked(shown, durationFormat)}
          </Text>
        </View>

        {control ? (
          <Shake
            failed={failed}
            testID={testID ? `${testID}-shake` : undefined}
          >
            <Pressable
              testID={testID ? `${testID}-control` : undefined}
              onPress={control}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={stopping ? "Terminar paseo" : "Empezar paseo"}
              accessibilityState={{ disabled: busy, busy }}
              // See Checkbox: the web renders the role and drops the state.
              aria-busy={busy}
              style={{ minHeight: TOUCH_TARGET }}
              // **Outlined when idle, filled when running: the chosen one is the
              // filled one.** The selected calendar day, the active tab and the
              // chosen segment of `Segmented` already say it, and a walk in
              // progress is an active state where an idle control is an offer.
              // The border is there in both states, so the control never changes
              // size when it fills. **`px-3` is a device measurement, not a
              // taste:** at `font_scale` 1.3 the bare control already ended on
              // the right margin, and `px-4` overflowed by about 20 dp and
              // ellipsized the measure beside it. The radius is a literal for the
              // reason the floating action's is: `rounded-full` is a `calc()`.
              className={`shrink-0 flex-row items-center gap-2 rounded-[24px] border border-accent px-3 active:opacity-70 ${filled ? "bg-accent" : ""}`}
            >
              {busy ? (
                // **A spinner in the glyph's own 16 dp box**, so the glyph half
                // of the control keeps its width. The write can take seconds on
                // a phone clinging to one bar of wifi in the doorway, and a
                // control that is present but inert is what makes someone press
                // it again. `ActivityIndicator`'s small size is 20 dp, hence the
                // scale. Decoration to a reader: the button's own state says
                // `busy`. **It is the one animation here that does not consult
                // `useReducedMotion`, and that is a decision:** the glyph is
                // swapped for the spinner, which a still screen shows, and the
                // control is disabled and marked busy, so motion is not the only
                // signal. `Button`'s loading state makes the same choice.
                <View
                  testID={testID ? `${testID}-spinner` : undefined}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                  style={{ width: GLYPH_SIZE, height: GLYPH_SIZE }}
                  className="items-center justify-center"
                >
                  <ActivityIndicator
                    size="small"
                    color={glyph}
                    style={{ transform: [{ scale: 0.8 }] }}
                  />
                </View>
              ) : stopping ? (
                <Square
                  size={GLYPH_SIZE}
                  strokeWidth={2.5}
                  color={glyph}
                  fill={glyph}
                />
              ) : (
                <Play
                  size={GLYPH_SIZE}
                  strokeWidth={2.5}
                  color={glyph}
                  fill={glyph}
                />
              )}
              {/* **The word says what the control is doing, and the block
                  shifts by the difference.** It used to stay "Paseo"
                  throughout, so that the control could not change width while
                  it was busy, with the spinner carrying the whole message —
                  and PRODUCT.md (2026-10-21) decided against it: any button
                  whose action waits on the server changes its icon *and* its
                  label while it waits. A spinner alone is a glyph, and this
                  app's own rule is that an icon is never a reason.

                  **And it says which write is in flight, in the app's own
                  language.** It used to say "Guardando…" for both. Measured
                  at `font_scale` 1.45, "En marcha…" is the same width as the
                  string it replaces and "A casa…" is shorter, so the stop
                  costs the measure beside it less than it did. The pair is
                  the one the app already speaks — "¡Vamos, Loki!" / "¡Loki ya
                  está contigo!" — and it earns its keep: on the tutor's walk
                  the label sat on screen for **over nine seconds**, the stop
                  pressed in a lift with no signal and the write left hanging.
                  That is a word you stare at, not one you glimpse.

                  **The pega, taken knowingly:** "En marcha…" asserts the
                  dog's state while what is happening is a write that can
                  fail. If it fails the button said "En marcha" and goes back
                  to "Paseo" — which is the same optimism the offline mode is
                  being designed around.

                  **Which of the two is read off `walkingSince`, not off
                  `stopping`.** `stopping` is true across the gap between a
                  *start* being accepted and its row arriving — the control
                  is already the stop there, disabled, and the label would
                  have said "A casa…" over a walk that had just begun. A stop
                  closes a row that exists; a start has none yet.

                  **The cost was measured and accepted.** At `font_scale` 1.3
                  the control already ends on the right margin, which is why
                  its padding is `px-3`; both words are wider than "Paseo", so
                  from somewhere around that scale the measure beside it loses
                  its tail to an ellipsis, and at 200% it loses a good deal of
                  it. The tutor's call, knowingly: at a large font scale you
                  have to decide what must stay readable and what is
                  expendable, and as long as accessibility gives a second route
                  to the thing that was cut, losing part of the measure is the
                  cheaper half. The second route is real — the measure is one
                  `Text` node whose full string is what a reader announces,
                  ellipsis or no ellipsis.

                  **The accessible name does not change with it.** It stays
                  "Empezar paseo" / "Terminar paseo", because the control is
                  still that control and `aria-busy` is what says it is
                  working; renaming it mid-flight would describe a button that
                  is not there. `Button` makes the same split for its own
                  loading phase. */}
              <Text
                className={`font-semibold ${filled ? "text-on-accent" : "text-accent"}`}
              >
                {busy ? (walkingSince ? "A casa…" : "En marcha…") : "Paseo"}
              </Text>
            </Pressable>
          </Shake>
        ) : null}
      </View>

      {goalMinutes !== null ? (
        // The wrapper is the bar's own 4 dp and nothing else: the track keeps
        // its `overflow-hidden`, which would clip the tick, so the tick is the
        // wrapper's child and the track's sibling. It is absolutely placed, so
        // it cannot move the bar or the block.
        <View className="relative h-[4px]">
          {/* `h-[4px]`, not `h-1`: the calendar draws this bar in miniature
              and sizes it in literal pixels, and 0.25rem resolves to 3.38dp
              on native. */}
          {/* **The track is the ground, which is the tier the day reached.**
              It used to be the empty track and nothing else; now it is Aqua
              on a day that met the goal and Aurora Boreal on one past double,
              with the lap above it drawn over the top. A `testID` of its own,
              because the ground and the fill are the two halves of the
              sentence and nothing can tell them apart from the outside
              otherwise.

              **A plain `View` again.** It carried the one swell that was
              about the whole bar — the close with no stretch to point at —
              and with two laps there is no such close: a walk closing on a
              met day lands on lap two, and a day past double says nothing at
              all. Nothing was left for the shared value to do. */}
          <View
            testID={testID ? `${testID}-ground` : undefined}
            className={`h-[4px] flex-row overflow-hidden rounded-xl ${lap.ground}`}
          >
            <View
              testID={testID ? `${testID}-bar` : undefined}
              style={{ width: `${recorded}%` }}
              className={`h-[4px] ${lap.saved}`}
            />
            {inProgress > 0 ? (
              // Static, and hidden from a reader: the measure already says
              // "De paseo". See the block's comment for why the pulse moved to
              // the dot.
              <View
                testID={testID ? `${testID}-live` : undefined}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
                style={{ width: `${inProgress}%` }}
                className={`h-[4px] ${lap.live}`}
              />
            ) : null}
            {turning ? (
              // **The crossing, drawn: the new ground arriving over the lap
              // the day has just left.** Over the fills rather than under
              // them, because what it replaces is the whole picture — a wipe
              // under a full lap of Mist would be invisible until the lap
              // vanished from under it, which is the cut again. It is inside
              // the track, so the bar's rounded ends clip it.
              <GroundTurn
                tier={tier}
                testID={testID ? `${testID}-turn` : undefined}
              />
            ) : null}
            {/* **Inside the track, so its rounded `overflow-hidden` is the
                band's clip too.** Nothing forces it out: the band is the bar's
                own 4 dp, so the track cuts nothing it would not already cut.
                Out beside the track its own clip was square, and the band
                painted a square corner into the bar's rounded ends every time
                it passed one — for the whole length of every walk. Absolutely
                placed, so it adds nothing to the flex row, and the track has
                no padding or border, so its left edge is the bar's. Last, so
                it paints over both fills, and over a wipe: the walk is still
                live while the bar is changing ground. */}
            {walkingSince ? (
              <Sweep
                met={drawn >= 1}
                recorded={recorded}
                testID={testID ? `${testID}-sweep` : undefined}
              />
            ) : null}
          </View>
          {/* **The close is the track's sibling, not its child, because it
              carries the tick.** The track keeps the `overflow-hidden` its
              fills and the sweep need, and a 12 dp mark standing 4 dp proud of
              a 4 dp track would be cut to the track. Out here it is clipped by
              nothing. The cost, accepted: the close's overlays do not inherit
              the track's `rounded-xl`, so for 760 ms the bar's two extreme
              ends are square rather than carrying their 2 dp cap. */}
          {closing !== null ? (
            <CloseLanding
              // Keyed by the close, not by the position: a second close
              // inside the 760 ms of the first reconciles into this same
              // element, and without a new key the shared value would still
              // be at 1 from the first animation, so the second would paint
              // itself already arrived with no travel. Reasoned from how
              // React reconciles, not reproduced — it needs two server round
              // trips inside the window.
              key={closing.id}
              laps={closing.laps}
              testID={testID ? `${testID}-close` : undefined}
            />
          ) : null}
          {walkingSince && recorded > 0 ? (
            // Hidden from a reader the way the dot is: the measure says what
            // the walk is, and a line has nothing to announce. Positioned from
            // the same percentage the recorded fill is drawn at, so the two
            // cannot disagree.
            //
            // **Not drawn at zero recorded**: nothing recorded on this lap is
            // nothing to separate the walk from, and at zero the tick sat 1 dp
            // outside the track — the centring offset is unclamped. Zero is
            // the only place that is exactly true: at a very small positive
            // proportion the tick still hangs out by under 1 dp, which it
            // accepts. The right edge never arises: a lap's fill wraps to zero
            // at the tier rather than reaching 100, and past the top tier
            // there is no fill at all.
            <View
              testID={testID ? `${testID}-tick` : undefined}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              style={{
                left: `${recorded}%`,
                marginLeft: -TICK_WIDTH / 2,
                top: -TICK_RISE,
                width: TICK_WIDTH,
                height: TICK_HEIGHT,
              }}
              className="absolute rounded-[1px] bg-text-primary"
            />
          ) : null}
        </View>
      ) : null}

      {/* **Under the bar, not beside the measure, and that moved.** It used to
          share the row's right slot, which is now the control's — and a label
          that sits beside the measure on a past day and under the bar on today
          is two layouts for one sentence. One home, every day. */}
      {met ? (
        // **The tiers are named, not numbered.** "Objetivo conseguido" and
        // "Objetivo conseguido x2" were the form the feature shipped with and
        // the tutor marked the second as provisional; "Día de campeonato" is
        // their own phrase for what the top tier means, and "Día cumplido"
        // says the day did what it had to without the tone of a form.
        //
        // **The split between what is shown and what is said went with the
        // numbering**, and that is the point rather than a tidy-up. "x2"
        // needed a spoken form of its own for exactly one reason — a screen
        // reader says "equis dos" — and words do not. One string per tier,
        // in the legend, here, and inside a calendar cell's name ("10, día
        // de campeonato"); a second copy of a name that lives in three
        // places is the copy that drifts.
        //
        // It wears the tier's own colour, because The Shared Mark Rule says a
        // mark stands for its record wherever it appears — and at the top
        // tier the bar under it is Aurora Boreal, not Aqua.
        //
        // **It stays under the bar.** Moving it above was decided and then
        // undone: nothing is shown on a day that reaches no tier, so with no
        // permanent slot the bar would drop a line at the exact moment the
        // close is animating.
        <Text
          testID={testID ? `${testID}-met` : undefined}
          className={`mt-2 font-semibold text-xs ${metX2 ? "text-accent-focus" : "text-accent"}`}
        >
          {metX2 ? "Día de campeonato" : "Día cumplido"}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Wraps the control and shakes it, once per bump of `failed`.
 *
 * **Under "remove animations" nothing animated is mounted**: this renders its
 * children bare, with no wrapper, no shared value and no effect, the line
 * `PulseDot`, `Sweep` and the close draw. The failure is still said — the
 * toast is not motion and the control is back at rest with its label intact —
 * so the shake is an addition to the message and never the only carrier of it.
 * The live half is a component of its own so that its hooks are not called
 * conditionally. The preference is a constant for the life of the process
 * (`useReducedMotion` reads the system setting once at module load), so the
 * choice between the two branches is made once and never flips under a
 * mounted control.
 *
 * **A wrapper, not an animated `Pressable`.** The control takes its shape
 * from a `className` and its height from a plain `style`, and a callback
 * `style` — which animating the `Pressable` itself would tempt — is dropped
 * entirely on native. `translateX` is paint, so the wrapper moves the pill
 * without touching layout, and it carries the same `shrink-0` as the control
 * so the row lays out as it did before.
 */
function Shake({
  failed,
  testID,
  children,
}: {
  failed: number;
  testID?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <ShakeLive failed={failed} testID={testID}>
      {children}
    </ShakeLive>
  );
}

function ShakeLive({
  failed,
  testID,
  children,
}: {
  failed: number;
  testID?: string;
  children: React.ReactNode;
}) {
  const phase = useSharedValue(0);
  /**
   * The bump this wrapper has already answered, **starting at whatever the
   * counter is on mount.** The screen keeps the counter across the skeleton
   * the day view shows while a day loads, so the block comes back with a
   * count it did not see happen; comparing against zero would shake the
   * control for a failure from minutes ago on every return.
   */
  const shaken = useRef(failed);

  useEffect(() => {
    if (failed === shaken.current) return;
    shaken.current = failed;
    // Rewound first, so a bump that lands mid-shake starts a whole one.
    phase.value = 0;
    phase.value = withTiming(1, { duration: SHAKE_MS, easing: Easing.linear });
  }, [failed, phase]);

  // A sine with a falling envelope: the first swing is the widest and the
  // last is nothing, and at phase 1 both factors put it back at exactly 0.
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          SHAKE_DP *
          (1 - phase.value) *
          Math.sin(phase.value * SHAKE_SWINGS * 2 * Math.PI),
      },
    ],
  }));

  return (
    <Animated.View testID={testID} style={style} className="shrink-0">
      {children}
    </Animated.View>
  );
}

/**
 * The mark that a walk is still running: an Aqua dot that dims and returns,
 * and a ring that spreads from it like a ripple on water.
 *
 * **One `phase`, two animations.** The dot's opacity and the ring's scale and
 * opacity are all read off the same shared value, so they are one heartbeat
 * rather than two timers drifting against each other: the dot is at its
 * brightest as the ring leaves, dims as it travels, and is back at full when
 * the ring has gone. Transform and opacity only — nothing here triggers
 * layout.
 *
 * **The ring cannot move the row.** The dot lives in a fixed 8x8 wrapper and
 * the ring is absolutely positioned inside it at the same 8x8, so the wrapper
 * is the only thing the measure's row ever lays out; the ring grows by
 * `transform`, which is paint rather than layout. That matters because at
 * `font_scale` 1.3 the measure already sits 35 dp from the control, and a slot
 * that grew with the ring would spend it.
 *
 * **Aqua Glaciar only.** The dot is the measure's own colour while walking, so
 * it spends nothing new, and Aurora Boreal on this bar means the top tier.
 *
 * **Under "remove animations" the dot holds at full opacity and the ripple is
 * not rendered at all** — the static case being the one that has to be more
 * visible, not less (the line `Skeleton` and `Celebration` draw), and the ring
 * being pure decoration. `phase` starts at 0, which is the dot's peak, and is
 * simply never animated.
 *
 * Decoration to a reader: the measure beside it says `De paseo`, so a second
 * announcement would be the same fact twice.
 */
function PulseDot({ testID }: { testID?: string }) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduceMotion, phase]);

  // Cosine of the phase: peak at 0 and at 1, trough at the middle, so the
  // restart of the repeat is seamless and the dim is eased at both ends.
  const dotStyle = useAnimatedStyle(() => ({
    opacity:
      DOT_DIM +
      (1 - DOT_DIM) * (0.5 + 0.5 * Math.cos(phase.value * 2 * Math.PI)),
  }));

  // Eased out, so the ring leaves quickly and slows as it fades, like water.
  // It is at zero opacity when the repeat restarts, so the jump back to scale
  // 1 is never seen.
  const ringStyle = useAnimatedStyle(() => {
    const t = 1 - (1 - phase.value) * (1 - phase.value);
    return {
      opacity: RIPPLE_ALPHA * (1 - t),
      transform: [{ scale: 1 + (RIPPLE_SCALE - 1) * t }],
    };
  });

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      className="h-[8px] w-[8px]"
    >
      {reduceMotion ? null : (
        <Animated.View
          testID={testID ? `${testID}-ripple` : undefined}
          style={ringStyle}
          className="absolute h-[8px] w-[8px] rounded-[4px] border border-accent"
        />
      )}
      <Animated.View
        style={dotStyle}
        className="h-[8px] w-[8px] rounded-[4px] bg-accent"
      />
    </View>
  );
}

/**
 * The band itself: a rectangle `width` dp across and `BAND_HEIGHT` dp tall,
 * filled transparent → `tone` at `alpha` → transparent from left to right.
 *
 * **A rectangle, after an ellipse was tried and removed.** Over the recorded
 * fill a lightening band moved the red channel by 20 where over the dark track
 * it moved it by 123, so it crossed half the bar unseen. Two answers were
 * built for that: splitting the tone at the junction, and giving the band
 * height so it would read whatever it passed over. Measured on the device, the
 * tone alone took the weak half to −67, and the height was then paying only on
 * the half that was already fine, where it turned a clean band into a blob.
 * The shape went back.
 *
 * **Drawn in `react-native-svg`, which is already a dependency, rather than
 * `expo-linear-gradient`**, a native module: adding it would mean recompiling
 * and reinstalling on both phones to draw a band. The fade is the stops'
 * opacity, so `tone` stays a token.
 *
 * **It centres itself on the box it is put in**, rather than filling it: the
 * sweep's clip is 4 dp, so `top: "50%"` with a half-height negative margin
 * lands at zero and keeps working if that box ever changes height. It needs
 * the parent to have a definite height — `Sweep` gives it one with
 * `top-0 bottom-0` inside a box that has one.
 *
 * **No animation and no horizontal position**, on purpose: `Sweep` is the one
 * caller and it loops the band across the track itself. The close used to be
 * a second caller — it put a sheen on a short stretch with a motion of its
 * own — and neither the sheen nor that caller exists any more; a band that
 * placed or moved itself would have had to be undone for the one that is
 * left. The gradient's id comes from `useId`, because SVG ids are
 * global to the document on the web and two bands of different tone must not
 * resolve to the same `<linearGradient>`.
 */
function Band({
  width,
  tone,
  alpha,
}: {
  width: number;
  tone: string;
  alpha: number;
}) {
  const id = `band-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg
      width={width}
      height={BAND_HEIGHT}
      style={{
        position: "absolute",
        top: "50%",
        marginTop: -BAND_HEIGHT / 2,
      }}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={tone} stopOpacity={0} />
          <Stop offset="0.5" stopColor={tone} stopOpacity={alpha} />
          <Stop offset="1" stopColor={tone} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={BAND_HEIGHT}
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

/**
 * A pale band that crosses the whole track, again and again, while a walk
 * runs.
 *
 * **Across the whole track and not the in-progress segment, because that
 * segment cannot carry an animation.** Against a 3 h goal it is 3.6 dp wide at
 * two minutes — the moment the tutor most wants to see the walk is recording —
 * and the same hole opens from the other end when a walk starts a minute short
 * of the goal. A band over the track is the same size whatever the walk's
 * length. **The cost, accepted:** a sweep is the idiom for _indeterminate_
 * progress, drawn on a bar that knows exactly where it is. The tick and the
 * segment still say where; the band says only "live".
 *
 * **Two bands, one crossing.** The bar has two grounds and the rule is that
 * the sweep takes the opposite tone of the ground it crosses, so the band is
 * cut at the **junction** — the `recorded` percentage, which is exactly where
 * the tick stands, so the tone change and the fixed mark coincide rather than
 * giving the eye a second boundary to explain. Left of it, over the light
 * recorded fill, the band is dark; right of it, over the dark track and the
 * in-progress segment, it is light. Both halves read one shared value, and the
 * right-hand one's translation is offset by the junction's own pixel position,
 * so the crossing is continuous: the two clips are a window onto one band, not
 * two bands taking turns. Once the goal is met the junction is forced to the
 * left edge and one dark band crosses everything — on lap two the Aqua ground
 * and the violet fills over it are all lighter than the dark track the pale
 * band answers, so the dark one is the opposite tone of the whole bar.
 *
 * **Lives inside the track**, as the last child of its `overflow-hidden`
 * `rounded-xl` box, so the bar's own rounded ends clip the band exactly as
 * they clip the fills. It was put beside the track while the band was 10 dp
 * tall and a 4 dp clip would have cut it; the band is 4 dp again, and out there
 * its square clip painted into the rounded ends on every pass. It adds no
 * clip of its own around the two regions: they tile `[0, trackWidth]` — the
 * left one `[0, junction]`, the right one `[junction, trackWidth]` — so there
 * is nothing left over for an outer box to cut. That depends on this
 * component's own box starting at the bar's left edge, which it does: it is
 * absolutely placed in a track with no padding or border.
 *
 * The track's width comes from `onLayout` on this box — a percentage cannot
 * be a transform — and the crossing restarts if the width changes (rotation,
 * font scale).
 *
 * **Under "remove animations" it renders nothing at all**, not a slower band:
 * the dot already says the walk is live, and nothing moving is the request.
 * The same rule as `PulseDot`. Decoration to a reader: the measure says
 * `De paseo`.
 */
function Sweep({
  met,
  recorded,
  testID,
}: {
  met: boolean;
  /** Where the junction is, as a percentage of the bar: the tick's own place. */
  recorded: number;
  testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useSharedValue(-SWEEP_WIDTH);

  useEffect(() => {
    if (reduceMotion || trackWidth === 0) return;
    x.value = -SWEEP_WIDTH;
    x.value = withRepeat(
      withTiming(trackWidth, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduceMotion, trackWidth, x]);

  // Met, the bar is one ground, so the junction is at the left edge and the
  // light half has no room: one clip spans everything and draws the dark band.
  const junction = met
    ? 0
    : Math.min(trackWidth, Math.max(0, (recorded / 100) * trackWidth));

  const overFillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  // The same position, read in the right-hand clip's own coordinates.
  const overTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - junction }],
  }));

  if (reduceMotion) return null;

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) =>
        setTrackWidth(e.nativeEvent.layout.width)
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{ top: 0, height: BAND_HEIGHT }}
      className="absolute right-0 left-0"
    >
      {trackWidth > 0 && junction > 0 ? (
        <View
          style={{ width: junction }}
          className="absolute top-0 bottom-0 left-0 overflow-hidden"
        >
          <Animated.View
            style={[{ width: SWEEP_WIDTH }, overFillStyle]}
            className="absolute top-0 bottom-0 left-0"
          >
            <Band
              width={SWEEP_WIDTH}
              tone={colors.onAccent}
              alpha={SWEEP_ALPHA_MET}
            />
          </Animated.View>
        </View>
      ) : null}
      {trackWidth > 0 ? (
        <View
          style={{ left: junction }}
          className="absolute top-0 right-0 bottom-0 overflow-hidden"
        >
          <Animated.View
            style={[{ width: SWEEP_WIDTH }, overTrackStyle]}
            className="absolute top-0 bottom-0 left-0"
          >
            <Band
              width={SWEEP_WIDTH}
              tone={met ? colors.onAccent : colors.textPrimary}
              alpha={met ? SWEEP_ALPHA_MET : SWEEP_ALPHA}
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The crossing: the new ground filling the bar from left to right over the
 * lap the day has just left.
 *
 * **One layer and one width, which is this bar's whole idiom.** A colour here
 * is a `className` on a layer and what changes is which layer covers the
 * pixel, never the value inside it — the close is built the same way, and a
 * cross-fade would put back the travelling colour both of them deliberately
 * avoid. So the wipe is the destination's ground on a layer that grows, and
 * the picture underneath is held until it has arrived.
 *
 * **It is mounted only while it runs.** The commitment under "remove
 * animations" is that nothing animated exists rather than that it is held
 * still, and the block's own `turning` is false there, so this is never
 * built. The same line `PulseDot`, `Sweep` and the close draw.
 *
 * Decoration to a reader: the label under the bar says the tier in words, in
 * the same breath, and the measure says the day's minutes.
 */
function GroundTurn({ tier, testID }: { tier: 0 | 1 | 2; testID?: string }) {
  const across = useSharedValue(0);

  useEffect(() => {
    across.value = withTiming(1, {
      duration: TURN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [across]);

  const style = useAnimatedStyle(() => ({
    width: `${across.value * 100}%`,
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={style}
      className={`absolute top-0 bottom-0 left-0 ${LAPS[tier].ground}`}
    />
  );
}

/**
 * The close: the live segment held painted, and a fill converting it left to
 * right until the bar says what the day now says.
 *
 * **The fill does not grow into empty track, and that is the whole point.** A
 * fill that started at the junction over a bar that had already dropped the
 * walk would open on exactly the frame the tutor's video shows as "the bar has
 * lost the walk". What is on screen when the stop lands is held — every band of
 * it, lapped or not — and the conversion travels along it. The frame stops
 * existing rather than being decorated.
 *
 * **One shared value, one lap each.** `closeLaps` cut the stretch at the tier
 * boundaries, so each lap owns a slice of the animation and draws three
 * things from the same number: the ground it lands the bar on, the stretch of
 * itself not yet converted (the lap's in-progress tone, held), and the fill
 * that is converting it (the lap's saved tone, from the lap's left edge). A
 * lap's ground arrives the instant its slice opens and covers everything
 * below, so crossing a tier turns the bar and restarts the fill at zero inside
 * one gesture — no special case, and no frame where the bar is two-tone.
 *
 * **Every lap has a ground, including the one the close began on.** The bar
 * underneath is already painted at the close's end state, because the fill no
 * longer waits for the reload; without a ground of its own the first lap would
 * let the destination's colour show through from the first frame, which is the
 * half of the handover a builder who fixed only the width would ship.
 *
 * **The tick rides the fill's leading edge**, because during the conversion
 * that edge *is* the saved/live boundary. It is the close's own element rather
 * than the bar's: the bar's tick is drawn only while a walk runs, and the walk
 * has ended. A new lap has nothing saved on it, so the mark is withheld at
 * zero and reappears as the fill advances — which is the same rule the bar's
 * own tick follows, not a second one.
 *
 * **Nothing jumps when it is taken away.** The bar beneath is held at the
 * close's end for as long as the data is short of it, and the last frame of
 * every lap is exactly that — so the overlay unmounts onto the picture it was
 * already painting.
 *
 * Decoration to a reader: `Día cumplido` appears under the bar in the
 * same breath, and the measure says the new total.
 */
function CloseLanding({ laps, testID }: { laps: CloseLap[]; testID?: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: CLOSE_MS,
      easing: Easing.inOut(Easing.quad),
    });
  }, [progress]);

  // Flattened for the worklet below, which walks them on every frame: the
  // bounds are plain numbers and the laps never change under a mounted close.
  const bounds = laps.map((lap) => [
    lap.at[0],
    lap.at[1],
    lap.fill[0],
    lap.fill[1],
  ]);

  const tickStyle = useAnimatedStyle(() => {
    let drawn = 0;
    for (let i = 0; i < bounds.length; i++) {
      const lap = bounds[i];
      if (progress.value >= lap[0]) {
        drawn = lapFillAt(progress.value, lap[0], lap[1], lap[2], lap[3]);
      }
    }
    return {
      left: `${drawn}%`,
      // Nothing recorded on this lap is nothing to separate, which is the
      // bar's own rule for the mark: see the block's comment.
      opacity: drawn > 0 ? 1 : 0,
    };
  });

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      className="absolute inset-0"
    >
      {laps.map((lap) => (
        <CloseLapPaint
          key={lap.tier}
          lap={lap}
          progress={progress}
          testID={testID ? `${testID}-lap-${lap.tier}` : undefined}
        />
      ))}
      <Animated.View
        testID={testID ? `${testID}-tick` : undefined}
        style={[
          {
            marginLeft: -TICK_WIDTH / 2,
            top: -TICK_RISE,
            width: TICK_WIDTH,
            height: TICK_HEIGHT,
          },
          tickStyle,
        ]}
        className="absolute rounded-[1px] bg-text-primary"
      />
    </View>
  );
}

/**
 * One lap of a close: its ground, the part of it not yet converted, and the
 * fill converting it.
 *
 * **Three layers and no colour animation.** The tones are the lap's own, from
 * `LAPS`, and they never travel — what moves is which of them is covering the
 * pixel, which is what "converted left to right" means. That also keeps the
 * two spellings of each colour honest: these are the `className` halves, the
 * same ones the settled bar wears, so the overlay cannot land a shade off
 * what it uncovers.
 *
 * The ground is first so the two bands sit over it, and the laps are rendered
 * in order so each lap's ground covers the one below — which is the tier
 * turning, drawn. **The order is also what holds a lapped walk's second
 * band**: a later lap's held band is painted over an earlier lap's fill, so
 * at `t = 0` the overlay is the live rendering exactly — this lap's saved
 * fill, this lap's live remainder, and the next lap's band over the left of
 * both. Its ground is zero-width until its slice opens, so it covers nothing
 * it should not.
 */
function CloseLapPaint({
  lap,
  progress,
  testID,
}: {
  lap: CloseLap;
  progress: SharedValue<number>;
  testID?: string;
}) {
  const tones = LAPS[lap.tier];
  const [opens, closes] = lap.at;
  const [from, to] = lap.fill;

  const groundStyle = useAnimatedStyle(() => ({
    width: progress.value >= opens ? "100%" : "0%",
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${lapFillAt(progress.value, opens, closes, from, to)}%`,
  }));

  // The stretch of this lap the fill has not reached yet, held in the tone the
  // walk was painting it in. It is empty at the end of the lap's slice, so the
  // overlay never has to take anything away.
  const heldStyle = useAnimatedStyle(() => {
    const drawn = lapFillAt(progress.value, opens, closes, from, to);
    return { left: `${drawn}%`, width: `${Math.max(0, to - drawn)}%` };
  });

  return (
    <>
      <Animated.View
        testID={testID ? `${testID}-ground` : undefined}
        style={groundStyle}
        className={`absolute top-0 bottom-0 left-0 ${tones.ground}`}
      />
      <Animated.View
        testID={testID ? `${testID}-held` : undefined}
        style={heldStyle}
        className={`absolute top-0 bottom-0 ${tones.live}`}
      />
      <Animated.View
        testID={testID ? `${testID}-fill` : undefined}
        style={fillStyle}
        className={`absolute top-0 bottom-0 left-0 ${tones.saved}`}
      />
    </>
  );
}
