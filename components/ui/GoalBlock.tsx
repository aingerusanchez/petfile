import { Play, Square } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
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
 * How long one pulse of the dot takes, and how far its opacity travels.
 *
 * **Slower than `Skeleton`'s 900ms, and that is the point.** A skeleton pulses
 * for a few hundred milliseconds while something arrives; this pulses for the
 * length of a walk. An animation that runs for an hour has to be calmer than
 * one that runs for a second, or it stops being a signal and becomes a nag.
 */
const PULSE_MS = 1400;
const DOT_DIM = 0.3;

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
  // **The one line that decides the control's look.** `stopping` is variant C,
  // outlined when idle and filled when running; `true` is variant A, filled in
  // both states.
  const filled = stopping;
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
              // button's own state says `busy`.
              <View
                testID={testID ? `${testID}-spinner` : undefined}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
                style={{ width: 16, height: 16 }}
                className="items-center justify-center"
              >
                <ActivityIndicator
                  size="small"
                  color={glyph}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
            ) : stopping ? (
              <Square size={16} strokeWidth={2.5} color={glyph} />
            ) : (
              <Play size={16} strokeWidth={2.5} color={glyph} />
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
        // `h-[4px]`, not `h-1`: the calendar draws this bar in miniature and
        // sizes it in literal pixels, and 0.25rem resolves to 3.38dp on native.
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
 * The mark that a walk is still running: an Aqua dot, pulsing in opacity.
 *
 * **Aqua Glaciar only.** The dot is the measure's own colour while walking, so
 * it spends nothing new; Aurora Boreal stays on the three places it already is.
 *
 * **Under "remove animations" it holds at full opacity,** the static case
 * being the one that has to be more visible, not less — the line `Skeleton` and
 * `Celebration` draw. `progress` starts at 1, which is full opacity, and is
 * simply never animated.
 *
 * Decoration to a reader: the measure beside it says `De paseo`, so a second
 * announcement would be the same fact twice.
 */
function PulseDot({ testID }: { testID?: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(0, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: DOT_DIM + progress.value * (1 - DOT_DIM),
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={style}
      className="h-[8px] w-[8px] rounded-[4px] bg-accent"
    />
  );
}
