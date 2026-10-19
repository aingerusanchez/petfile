import { Play, Square } from "lucide-react-native";
import { useEffect, useId, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type LayoutChangeEvent,
  Pressable,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { formatDuration } from "../../lib/duration";
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
 * The band that crosses the track while a walk runs: how wide it is, how long
 * one crossing takes, and how strong it is on each ground.
 *
 * **The band is the opposite tone to the ground it crosses**, so it is always
 * a lightening or a darkening of what is under it: `textPrimary` over the dark
 * track and the Mist fill, `onAccent` over the Aqua fill once the goal is met.
 * The alpha is the peak of the gradient, not a flat tint.
 *
 * **2.4 s a crossing, linear**, a little quicker than the dot's 2.8 s
 * heartbeat, so the two never settle into lock-step.
 */
const SWEEP_WIDTH = 70;
const SWEEP_MS = 2400;
const SWEEP_ALPHA = 0.55;
const SWEEP_ALPHA_MET = 0.35;

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
 * **The tick does not animate.** The dot before the measure already pulses to
 * say the walk is live; the tick answers a different question — how much of
 * this is already recorded — and a pulse on it would say "live" twice. One
 * thing moving, one thing still. It draws only while a walk runs and only
 * where there is a bar, **not before anything is recorded** — there is no
 * junction to mark, and the line would hang off the bar's left edge — and
 * **not once the goal is met**: the bar is then full and Aqua and there is no
 * segment, so a mark at its right end would separate the recorded minutes from
 * nothing and read as a cap on the bar.
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
          <View className="h-[4px] flex-row overflow-hidden rounded-xl bg-surface">
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
            {walkingSince ? (
              <Sweep
                met={met}
                testID={testID ? `${testID}-sweep` : undefined}
              />
            ) : null}
          </View>
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
 * The gradient rectangle itself: transparent, then `tone` at `alpha`, then
 * transparent, `width` dp across and as tall as the box it is put in.
 *
 * **Drawn in `react-native-svg`, which is already a dependency, rather than
 * `expo-linear-gradient`**, a native module: adding it would mean recompiling
 * and reinstalling on both phones to draw a band. The fade is the stops'
 * opacity, so `tone` stays a token.
 *
 * **No animation and no position**, on purpose: `Sweep` loops it across the
 * whole track, and the close's sheen puts it on a short stretch with a motion
 * of its own. The gradient's id comes from `useId`, because SVG ids are global
 * to the document on the web and two bands of different tone must not resolve
 * to the same `<linearGradient>`.
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
    <Svg width={width} height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={tone} stopOpacity={0} />
          <Stop offset="0.5" stopColor={tone} stopOpacity={alpha} />
          <Stop offset="1" stopColor={tone} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height="100%" fill={`url(#${id})`} />
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
 * **Lives inside the track**, which clips it at both ends, and fills it. The
 * track's width comes from `onLayout` on this component itself — a percentage
 * cannot be a transform — and the crossing restarts if the width changes
 * (rotation, font scale).
 *
 * **Under "remove animations" it renders nothing at all**, not a slower band:
 * the dot already says the walk is live, and nothing moving is the request.
 * The same rule as `PulseDot`. Decoration to a reader: the measure says
 * `De paseo`.
 */
function Sweep({ met, testID }: { met: boolean; testID?: string }) {
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

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
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
      className="absolute inset-0"
    >
      {trackWidth > 0 ? (
        <Animated.View
          style={[{ width: SWEEP_WIDTH }, bandStyle]}
          className="absolute top-0 bottom-0 left-0"
        >
          <Band
            width={SWEEP_WIDTH}
            tone={met ? colors.onAccent : colors.textPrimary}
            alpha={met ? SWEEP_ALPHA_MET : SWEEP_ALPHA}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
