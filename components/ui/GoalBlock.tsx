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
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { formatDuration } from "../../lib/duration";
import { type CloseMotion, closeMotion } from "../../lib/goalbar";
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
 * the bar is one ground again (Aqua) and there is one dark band.
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
 * The close, in four beats: how long the whole thing lasts, and where each
 * beat lands inside it.
 *
 * **One sentence — "this much has just been saved" — said four ways.** The
 * stretch the walk added thickens, a pale band crosses it, that stretch
 * travels from the in-progress grey to the tone it will keep, and it settles
 * back to its 4 dp. (Where there is no stretch to point at, the whole track is
 * what thickens; see below.) Before this, stopping a walk changed the segment
 * to a slightly lighter grey and took the tick away: the most significant
 * event of the dog's day, and the least visible thing the app did.
 *
 * **The beats are cumulative instants, not durations.** The swell is up by
 * `CLOSE_SWELL_MS`, the sheen has finished crossing by `CLOSE_SHEEN_END_MS`,
 * and everything has landed at `CLOSE_MS`. The swell's return is not a beat of
 * its own: it eases back over the rest of the close, under the sheen and the
 * colour, so the bar settles once rather than twice.
 *
 * **1.75 on a 4 dp track is 7 dp**, which is the thickest the bar gets. Never
 * `scaleY` on the wrapper: the tick is the wrapper's other child and would
 * scale with it, and a 12 dp tick at 1.75 is a 21 dp spike.
 *
 * **The swell lands on the stretch, not on the whole bar — except when there
 * is no stretch.** It used to thicken the entire track while the sheen and the
 * colour landing pointed only at the minutes the walk added, so the loudest of
 * the three beats contradicted the sentence the other two spoke. In the `land`
 * case it is `scaleY` on `CloseLanding`'s stretch overlay, and all three beats
 * then act on the same place. In the `swell` case — the goal was already met
 * before this walk, so there is no stretch to point at — it stays on the track,
 * because there the message really is about the whole thing.
 *
 * **Known and accepted:** a one-minute close against a 3 h goal leaves a
 * stretch about 3.6 dp wide, and a swell on 3.6 dp is barely anything. A real
 * walk's stretch is 45–73 dp. A minute does not earn a fanfare.
 *
 * **The sheen is the close's own band, not the running sweep.** `SWEEP_WIDTH`
 * crosses the whole track forever; this one crosses a stretch that can be 3 dp
 * wide, once. Same width and nearly the same alpha, so the two read as the
 * same material. **It is a child of the stretch, so it swells with it**: a 4 dp
 * band across a 7 dp stretch would leave a rim of uncovered stretch above and
 * below it, and the sheen is meant to be lighting the thing that is swelling.
 */
const CLOSE_MS = 760;
const CLOSE_SWELL_MS = 120;
const CLOSE_SWELL_SCALE = 1.75;
const CLOSE_SHEEN_END_MS = 400;
const CLOSE_SHEEN_WIDTH = 70;
const CLOSE_SHEEN_ALPHA = 0.55;

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
 * icons and leave the spinner's box alone, and the control changes width while
 * it is busy — the shift the spinner's box exists to prevent.
 */
const GLYPH_SIZE = 16;

/**
 * The day's walking, and the control that starts and stops it.
 *
 * **The only place on this screen that already talks about walks**, which is
 * why it gains the control by changing state rather than by growing one.
 * Nothing floats: the floating action keeps the corner it has.
 *
 * **The bar stays Mist while walking.** Aqua on this fill means "goal met" and
 * nothing else (DESIGN.md), so the state change is carried by the text. The
 * minutes of the walk in progress are not stored, so they are a dimmer segment
 * at the head of the fill rather than part of it — the measure keeps measuring
 * what is recorded, and the segment shows what is merely happening.
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
 * speaks two tones only (Mist while it is read, Aqua as the conclusion),
 * Aurora Boreal is reserved to three places, and every other tonal step in
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
 * **The tick does not animate.** The dot before the measure pulses and the
 * band crosses the track, and both say the same thing: the walk is live. The
 * tick answers a different question — how much of this is already recorded —
 * and a pulse on it would say "live" a third time. It is the one fixed mark
 * among the moving ones, which is what lets it be read as a measurement. It
 * draws only while a walk runs and only
 * where there is a bar, **not before anything is recorded** — there is no
 * junction to mark, and the line would hang off the bar's left edge — and
 * **not once the goal is met**: the bar is then full and Aqua and there is no
 * segment, so a mark at its right end would separate the recorded minutes from
 * nothing and read as a cap on the bar.
 *
 * **The close is the one moment this block speaks, and `justClosed` is how it
 * is told.** Which of three things it then does is `closeMotion`'s decision,
 * not this component's: a wrong one does not throw, it paints the bar as met
 * when it is not. The caller is responsible for one thing the prop cannot
 * express — that `walkedMinutes` already counts the walk being announced. It
 * is the total of *closed* walks, so it does, but only once the day's rows
 * have been read again; handing this over before that points the animation at
 * the previous walk's stretch.
 *
 * **The block renders with no goal too.** `exercise_goal_minutes` is nullable
 * and the activity question is optional, so gating the whole block on a goal
 * left those tutors with nowhere for the control to live. The goal and the bar
 * come and go; the block does not.
 */
export function GoalBlock({
  walkedMinutes,
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
  walkedMinutes: number;
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
   */
  justClosed?: { id: string; minutes: number } | null;
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
   * meets it, and the e2e suite's `toHaveCount(0)` would be a lie. The swell
   * needs no state: it is a shared value on a track that is always mounted.
   */
  const [closing, setClosing] = useState<(CloseMotion & { id: string }) | null>(
    null,
  );
  /** The last close this block has seen, so a re-render does not replay it. */
  const playedClose = useRef<string | null>(null);
  /** The timer that takes the overlay away again, so it can be re-armed. */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackScale = useSharedValue(1);

  // Primitives rather than the object: the prop is rebuilt by the caller on
  // every render, and an effect depending on its identity would fire forever.
  const closeId = justClosed?.id ?? null;
  const closeMinutes = justClosed?.minutes ?? 0;

  useEffect(() => {
    if (closeId === null || closeId === playedClose.current) return;
    // Marked seen before the reduced-motion check, so that a close which
    // plays nothing is still a close this block has seen. `useReducedMotion`
    // is a constant read once at module load (Reanimated 4.5.1: "Changing
    // the reduced motion system setting doesn't cause your components to
    // rerender"), so the preference cannot change under this effect and the
    // order does not decide whether a skipped close is owed later; it only
    // keeps the bookkeeping the same on both branches.
    playedClose.current = closeId;
    if (reduceMotion) return;
    const motion = closeMotion({
      walkedMinutes,
      closedMinutes: closeMinutes,
      goalMinutes,
    });
    if (motion.kind === "none") return;
    // The bar was already full before this walk, so the minutes it added fall
    // past the bar's edge: there is no stretch to sheen or to land, and the
    // thickness is the whole sentence — so the whole bar is what thickens.
    // Everywhere else the swell belongs to the stretch and `CloseLanding`
    // runs it; see the close's comment for why the loudest beat may not point
    // somewhere the other two do not.
    if (motion.kind === "swell") {
      trackScale.value = withSequence(
        withTiming(CLOSE_SWELL_SCALE, {
          duration: CLOSE_SWELL_MS,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, {
          duration: CLOSE_MS - CLOSE_SWELL_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      );
      return;
    }
    // **The overlay is mounted from a timer and not from here.** A `setState`
    // in an effect body is what `react-hooks/set-state-in-effect` exists to
    // report, and the zero-delay timeout is the shape this file already uses
    // for it a few lines up. Nothing is cancelled when the deps change —
    // `walkedMinutes` moves under a running close every time the other phone
    // writes something — so the timers are held in a ref rather than in the
    // effect's cleanup, which would take the animation away mid-beat.
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    setTimeout(() => setClosing({ ...motion, id: closeId }), 0);
    closeTimer.current = setTimeout(() => setClosing(null), CLOSE_MS);
  }, [
    closeId,
    closeMinutes,
    reduceMotion,
    walkedMinutes,
    goalMinutes,
    trackScale,
  ]);

  // Only on the way out: a close in flight when the screen goes would
  // otherwise set state on a component that has gone.
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    [],
  );

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: trackScale.value }],
  }));

  const running = walkingSince ? elapsedMinutes(walkingSince, now) : 0;
  const met = goalMinutes !== null && walkedMinutes >= goalMinutes;
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

  const recorded =
    goalMinutes === null || goalMinutes === 0
      ? 0
      : Math.min(100, (walkedMinutes / goalMinutes) * 100);
  const inProgress =
    goalMinutes === null || goalMinutes === 0
      ? 0
      : Math.min(100 - recorded, (running / goalMinutes) * 100);

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
            className={`shrink font-semibold ${walkingSince ? "text-accent" : "text-text-primary"}`}
          >
            {walkingSince
              ? `De paseo · ${formatDuration(running, durationFormat)}`
              : goalMinutes === null
                ? // **No "hoy".** The block renders on every day now, and the
                  // start is withheld on a past one — so paging back for a pet
                  // with no goal put "30 min paseados hoy" under a header
                  // reading "Ayer". That is the lie the log fixed once already
                  // with its own title; the header names the day, and one place
                  // saying it is enough.
                  `${formatDuration(walkedMinutes, durationFormat)} paseados`
                : `${formatDuration(walkedMinutes, durationFormat)} de ${formatDuration(goalMinutes, durationFormat)} paseados`}
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
                // **A spinner in the glyph's own 16 dp box, so the block does not
                // shift** and the label stays "Paseo". The write can take
                // seconds on a phone clinging to one bar of wifi in the
                // doorway, and a control that is present but inert is what
                // makes someone press it again. `ActivityIndicator`'s small size
                // is 20 dp, hence the scale. Decoration to a reader: the
                // button's own state says `busy`. **It is the one animation here
                // that does not consult `useReducedMotion`, and that is a
                // decision:** the glyph is swapped for the spinner, which a still
                // screen shows, and the control is disabled and marked busy, so
                // motion is not the only signal. `Button`'s loading state makes
                // the same choice.
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
              <Text
                className={`font-semibold ${filled ? "text-on-accent" : "text-accent"}`}
              >
                Paseo
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
          {/* The track and not the wrapper carries the one swell that is
              about the whole bar, for the reason the wrapper exists: the tick
              is the wrapper's other child, and a 12 dp mark at 1.75 would be
              a 21 dp spike. The scale is paint, so the thickened bar
              overflows the 4 dp wrapper without moving anything under it. */}
          <Animated.View
            style={trackStyle}
            className="h-[4px] flex-row overflow-hidden rounded-xl bg-surface"
          >
            <View
              testID={testID ? `${testID}-bar` : undefined}
              style={{ width: `${recorded}%` }}
              className={`h-[4px] ${met ? "bg-accent" : "bg-text-secondary"}`}
            />
            {inProgress > 0 ? (
              // Static, and hidden from a reader: the measure already says
              // "De paseo". See the block's comment for why the pulse moved to
              // the dot.
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
                style={{ width: `${inProgress}%` }}
                className="h-[4px] bg-text-tertiary"
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
                it paints over both fills. */}
            {walkingSince ? (
              <Sweep
                met={met}
                recorded={recorded}
                testID={testID ? `${testID}-sweep` : undefined}
              />
            ) : null}
          </Animated.View>
          {/* **The close is the track's sibling, not its child, because the
              swollen stretch is thicker than the bar.** The track keeps the
              `overflow-hidden` its fills and the sweep need, and that would
              cut a 7 dp stretch down to 4 dp. Out here it is clipped by
              nothing, the way the swell on the track already was. The cost,
              accepted: the close's overlays do not inherit the track's
              `rounded-xl`, so for 760 ms the bar's two extreme ends are square
              rather than carrying their 2 dp cap. */}
          {closing !== null && closing.kind === "land" ? (
            <CloseLanding
              // Keyed by the close, not by the position: a second close
              // inside the 760 ms of the first reconciles into this same
              // element, and without a new key `landed` would still be 1
              // from the first animation, so the second would paint its
              // geometry already at its destination tone with no travel.
              // Reasoned from how React reconciles, not reproduced — it
              // needs two server round trips inside the window.
              key={closing.id}
              stretch={closing.stretch}
              met={closing.met}
              testID={testID ? `${testID}-close` : undefined}
            />
          ) : null}
          {walkingSince && recorded > 0 && !met ? (
            // Hidden from a reader the way the dot is: the measure says what
            // the walk is, and a line has nothing to announce. Positioned from
            // the same percentage the recorded fill is drawn at, so the two
            // cannot disagree.
            //
            // **Not drawn at zero recorded**: nothing recorded is nothing to
            // separate the walk from, and at zero the tick sat 1 dp outside the
            // track — the centring offset is unclamped. Zero is the only place
            // that is exactly true: at a very small positive proportion the
            // tick still hangs out by under 1 dp, which it accepts. The right
            // edge never arises: `recorded` reaches 100 only when the goal is
            // met, and then the tick is not drawn.
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
        <Text
          testID={testID ? `${testID}-met` : undefined}
          className="mt-2 font-semibold text-xs text-accent"
        >
          Objetivo conseguido
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
 * it spends nothing new; Aurora Boreal stays on the three places it already is.
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
 * sweep's clip and the close's sheen are both 4 dp, so `top: "50%"` with a
 * half-height negative margin lands at zero in both and keeps working if
 * either box ever changes height. It needs the parent to have a definite
 * height — both callers give it one with `top-0 bottom-0` inside a box that
 * has one.
 *
 * **No animation and no horizontal position**, on purpose: `Sweep` loops it
 * across the track, and the close's sheen puts it on a short stretch with a
 * motion of its own. The gradient's id comes from `useId`, because SVG ids are
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
 * two bands taking turns. Once the goal is met there is one ground and one
 * band again.
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
 * The three beats of a close that has a stretch to point at: the stretch
 * swelling, the sheen across it, the stretch arriving at the tone it will
 * keep, and — when the goal was reached — the rest of the bar coming with it.
 *
 * **All three act on the stretch, which is the whole reason the swell lives
 * here.** It used to be `scaleY` on the track, so the loudest beat pointed at
 * the entire bar while the two quiet ones pointed at the minutes just saved —
 * the sentence said two different things at once. The only close that still
 * thickens the whole track is the one with no stretch to point at, and that
 * one never reaches this component.
 *
 * **A component rather than three branches inside the block**, so the whole
 * close is mounted and unmounted as one thing: `testID` marks this wrapper,
 * and its absence is the settled state the e2e suite asserts.
 *
 * **It starts from `colors.textTertiary` because that is where the eye already
 * is.** The in-progress segment is drawn in exactly that tone while the walk
 * runs, and the frame the overlay mounts on is the frame the segment goes and
 * the recorded fill grows to take its place. So the overlay opens as a
 * continuation of the segment rather than as a new object, and then travels
 * to the tone the fill underneath is already holding.
 *
 * **Which is also why nothing jumps when it is taken away.** The fill beneath
 * was given its destination tone by props the moment the day's rows landed;
 * the overlay only hides it for 760 ms and arrives at the same colour. There
 * is no frame where the bar changes when the overlay unmounts — the one risk
 * being that it is removed early, which is why the timer that removes it is
 * never cancelled by a re-render.
 *
 * **When the goal was met the whole bar turns Aqua, not just the new
 * stretch**, so a second overlay covers everything before it and travels Mist
 * → Aqua. Without it the bar would land two-tone for the length of the
 * animation and then snap.
 *
 * Decoration to a reader: `Objetivo conseguido` appears under the bar in the
 * same breath, and the measure says the new total.
 */
function CloseLanding({
  stretch,
  met,
  testID,
}: {
  stretch: { start: number; end: number };
  met: boolean;
  testID?: string;
}) {
  const landed = useSharedValue(0);
  const swell = useSharedValue(1);

  useEffect(() => {
    landed.value = withDelay(
      CLOSE_SHEEN_END_MS,
      withTiming(1, {
        duration: CLOSE_MS - CLOSE_SHEEN_END_MS,
        easing: Easing.inOut(Easing.quad),
      }),
    );
    // The first beat, and the only one of the three that used to point
    // somewhere else. It ends at exactly `CLOSE_MS`, which is the frame this
    // overlay is taken away on, so the stretch is back at 4 dp before the
    // fill beneath it is uncovered.
    swell.value = withSequence(
      withTiming(CLOSE_SWELL_SCALE, {
        duration: CLOSE_SWELL_MS,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(1, {
        duration: CLOSE_MS - CLOSE_SWELL_MS,
        easing: Easing.inOut(Easing.quad),
      }),
    );
  }, [landed, swell]);

  const stretchStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      landed.value,
      [0, 1],
      [colors.textTertiary, met ? colors.accent : colors.textSecondary],
    ),
    transform: [{ scaleY: swell.value }],
  }));

  const beforeStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      landed.value,
      [0, 1],
      [colors.textSecondary, colors.accent],
    ),
  }));

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      className="absolute inset-0"
    >
      {met ? (
        <Animated.View
          style={[{ left: 0, width: `${stretch.start}%` }, beforeStyle]}
          className="absolute top-0 bottom-0"
        />
      ) : null}
      <Animated.View
        testID={testID ? `${testID}-stretch` : undefined}
        style={[
          {
            left: `${stretch.start}%`,
            width: `${stretch.end - stretch.start}%`,
          },
          stretchStyle,
        ]}
        className="absolute top-0 bottom-0"
      >
        {/* **Inside the stretch, so the sheen swells with it.** As the
            stretch's sibling it stayed 4 dp while the stretch it was lighting
            went to 7, and crossed a lozenge leaving an unlit rim above and
            below. The scale is on this element, and a transform reaches its
            children. The sheen's own timing is untouched. */}
        <CloseSheen testID={testID ? `${testID}-sheen` : undefined} />
      </Animated.View>
    </View>
  );
}

/**
 * The pale band that crosses the stretch a walk just added, once.
 *
 * **`Band` and not `Sweep`.** The sweep loops across the whole track for as
 * long as a walk runs, which is the right shape for "live" and the wrong one
 * for a single event; this crosses the stretch and is gone. It is clipped to
 * the stretch rather than drawn over the whole bar because the sentence is
 * "*this much* has just been saved", and a band over the whole track would
 * point at all of it.
 *
 * **It is a child of the stretch and fills it** (`inset-0`), which is what
 * makes it swell with it. The swell is a `scaleY` on the stretch, and when
 * this was the stretch's sibling in a 4 dp clip of its own it crossed a 7 dp
 * stretch and left a rim of it unlit above and below. Its clip is now the
 * stretch's own box, scaled along with it, so the sheen is exactly as thick as
 * the thing it lights at every frame of the swell and can paint nowhere the
 * stretch is not. Nothing about *when* it runs changes: the translation is
 * its own shared value.
 *
 * **The stretch's width has to be measured.** `Band` is drawn in dp and a
 * translation cannot be a percentage, so the width comes from `onLayout` on
 * the clip, the same way `Sweep` reads the track's. `onLayout` reports the
 * unscaled box, and the scale is vertical only, so the width is still right.
 * The stretch can be 3 dp wide against a long goal, in which case the band is
 * a flash rather than a crossing — which is the honest picture of two minutes
 * against three hours.
 */
function CloseSheen({ testID }: { testID?: string }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-CLOSE_SHEEN_WIDTH);

  useEffect(() => {
    if (width === 0) return;
    x.value = withDelay(
      CLOSE_SWELL_MS,
      withTiming(width, {
        duration: CLOSE_SHEEN_END_MS - CLOSE_SWELL_MS,
        easing: Easing.linear,
      }),
    );
  }, [width, x]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      className="absolute inset-0 overflow-hidden"
    >
      {width > 0 ? (
        <Animated.View
          style={[{ width: CLOSE_SHEEN_WIDTH }, bandStyle]}
          className="absolute top-0 bottom-0 left-0"
        >
          <Band
            width={CLOSE_SHEEN_WIDTH}
            tone={colors.textPrimary}
            alpha={CLOSE_SHEEN_ALPHA}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
