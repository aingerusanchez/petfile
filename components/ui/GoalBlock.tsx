import { Play, Square } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AppState, Pressable, View } from "react-native";
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
 * How long one breath of the in-progress segment takes.
 *
 * **Slower than `Skeleton`'s 900ms, and that is the point.** A skeleton
 * breathes for a few hundred milliseconds while something arrives; this
 * breathes for the length of a walk. An animation that runs for an hour has to
 * be calmer than one that runs for a second, or it stops being a signal and
 * becomes a nag.
 */
const BREATH_MS = 2400;
const DIM = 0.35;

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
        <Text
          testID={testID ? `${testID}-measure` : undefined}
          numberOfLines={1}
          className={`flex-1 font-semibold ${walkingSince ? "text-accent" : "text-text-primary"}`}
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

        {control ? (
          <Pressable
            testID={testID ? `${testID}-control` : undefined}
            onPress={control}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={stopping ? "Terminar paseo" : "Empezar paseo"}
            accessibilityState={{ disabled: busy }}
            style={{ minHeight: TOUCH_TARGET }}
            className="shrink-0 flex-row items-center gap-2 pl-3 active:opacity-70"
          >
            {stopping ? (
              <Square size={16} strokeWidth={2.5} color={colors.accent} />
            ) : (
              <Play size={16} strokeWidth={2.5} color={colors.accent} />
            )}
            <Text className="font-semibold text-accent">Paseo</Text>
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
          {inProgress > 0 ? <Breath width={inProgress} /> : null}
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
 * The minutes that are happening rather than recorded.
 *
 * Opacity only, and under "remove animations" it holds — the line `Skeleton`
 * and `Celebration` both draw. **It holds at the *bright* end, which is the
 * opposite of what it used to do.** Mist Light at `DIM` over the bar's Fjord
 * Slate track measures 1.94:1, and DESIGN.md records a 1.64:1 version of this
 * very bar as having "did not read as a measure of anything"; the bright end
 * is 6.78:1. While it breathes the dim end is a trough the eye passes
 * through and the motion itself is what finds the segment. Pinned there it is
 * neither legible nor moving, so the one reader who cannot use the motion to
 * find it would be the one reader it is hidden from. The static case needs
 * the contrast more, not less.
 *
 * That is also what lets `DIM` stay at 0.35 where `Skeleton` uses 0.4: this
 * breathes for the length of a walk rather than a few hundred milliseconds,
 * and a 2400ms cycle needs the wider travel to read as a breath at all. The
 * deeper trough is a floor of a motion now, never a resting state.
 *
 * A left-to-right shimmer was considered and rejected: this app's only
 * loading idiom is a pulse, and a traverse would say "cargando" on a bar that
 * is not loading anything.
 */
function Breath({ width }: { width: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(0, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: DIM + progress.value * (1 - DIM),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[{ width: `${width}%` }, style]}
      className="h-[4px] bg-text-tertiary"
    />
  );
}
