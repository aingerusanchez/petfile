import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

export type ToastVariant = "success" | "warning" | "error" | "info";

/**
 * How long a toast stays, in ms: a confirmation is glanced at, a failure is
 * read.
 *
 * **A failure gets double, and it used to get forever.** Every error toast in
 * the app was raised with `persist`, which the tutor asked for on the day the
 * counting landed — "puede que este tipo de errores tenga sentido que sean
 * persistentes para que el usuario los pueda leer" — and withdrew the day
 * after living with it: «lo que parece faltar es el desvanecimiento tras un
 * tiempo». A wall of red that only a tap can clear is a second chore handed
 * to somebody whose first one just failed. Eight seconds is long enough to
 * read one sentence and see the count beside it, and short enough that the
 * diary comes back without being asked.
 *
 * **It is the variant that decides, not the call site**, because a failure
 * written next month would otherwise be written at four seconds by whoever
 * forgets. The three severities that are not failures stay at a glance.
 * `duration` still overrides, for a caller that knows better about one
 * particular message.
 */
const GLANCE_MS = 4000;
const FAILURE_MS = 8000;

export type ToastOptions = {
  variant: ToastVariant;
  /** The single sentence the toast exists to deliver. */
  message: string;
  /**
   * Milliseconds before it hides itself. Defaults to 8000 for an `error` and
   * 4000 for everything else — see `FAILURE_MS`. Ignored when `persist` is
   * true.
   */
  duration?: number;
  /**
   * Stay until the user acts.
   *
   * **Nothing passes this today, and failures are why it is still here.**
   * Every error toast used to, and v0.21.0 took it off all of them: a failure
   * is a sentence to read, not a chore to clear. What the flag is for is the
   * case it was always described for and the app has never had — a decision
   * the toast is asking the tutor to make, where going away on a timer would
   * take the question with it. A persistent toast shows a dismiss control
   * instead of a countdown, because a progress bar that never finishes is a
   * lie.
   */
  persist?: boolean;
  /** Optional action; its press dismisses the toast. */
  action?: { label: string; onPress: () => void };
};

/**
 * Per-variant identity. The status colour carries the border, the icon and the
 * countdown; the message itself stays `text-primary` at 13.35:1, so legibility
 * never depends on the status hue.
 *
 * Every variant also has its own icon, which is what keeps this compliant with
 * the rule against communicating state by colour alone.
 */
const VARIANTS: Record<
  ToastVariant,
  { icon: LucideIcon; color: string; border: string; bar: string; role: string }
> = {
  success: {
    icon: CircleCheck,
    color: colors.success,
    border: "border-success",
    bar: "bg-success",
    role: "Éxito",
  },
  warning: {
    icon: TriangleAlert,
    color: colors.warning,
    border: "border-warning",
    bar: "bg-warning",
    role: "Aviso",
  },
  error: {
    icon: CircleAlert,
    color: colors.error,
    border: "border-error",
    bar: "bg-error",
    role: "Error",
  },
  info: {
    icon: Info,
    color: colors.info,
    border: "border-info",
    bar: "bg-info",
    role: "Información",
  },
};

type ToastProps = ToastOptions & {
  onDismiss: () => void;
  testID?: string;
  /**
   * How many times this exact failure has happened while it was on screen.
   *
   * Set by the host, never by a caller: two shows of the same variant and the
   * same message are one toast. See `lib/toasts.ts`.
   */
  repeats?: number;
};

/**
 * A transient message that floats above the whole app.
 *
 * **Depth without a shadow.** DESIGN.md is flat by construction, so the toast
 * separates itself from the page the way every other raised surface here does:
 * it sits on Elevated Frost, one tonal step above the content, with a 1px
 * border in its status colour. No shadow, no blur.
 *
 * **The countdown is honest.** An auto-hiding toast draws a bar that drains
 * over exactly its `duration`, so "this is about to go away" is visible rather
 * than a surprise. A persistent toast has no bar at all and offers a dismiss
 * control instead. Since v0.21.0 a failure is the first kind: it drains over
 * eight seconds rather than waiting to be cleared by hand.
 *
 * **A repeat is counted, not stacked.** The same failure happening again
 * while this toast is up adds a count beside the message and restarts the
 * countdown; it does not re-enter and it does not add a second toast. See
 * `lib/toasts.ts` for what "the same failure" means.
 */
export function Toast({
  variant,
  message,
  duration = variant === "error" ? FAILURE_MS : GLANCE_MS,
  persist = false,
  action,
  onDismiss,
  testID,
  repeats = 1,
}: ToastProps) {
  const spec = VARIANTS[variant];
  const Icon = spec.icon;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (persist) return;
    // **Back to full first.** On a repeat this runs with the bar part-drained,
    // and animating to 0 from there would give the second occurrence less
    // time than the first — a countdown that lies in the one direction that
    // costs the tutor the message.
    progress.value = 1;
    progress.value = withTiming(0, {
      duration,
      easing: Easing.linear,
    });
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [persist, duration, onDismiss, progress, repeats]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="alert"
      // **Severity decides this, not how long the toast stays.** A failure
      // and a toast the user has to act on are assertive: both are things
      // that have to reach the reader now. Everything else is polite, so a
      // confirmation never interrupts what is being read. It used to be
      // `persist` alone, which was the same answer while every failure
      // persisted — and would have quietly demoted every one of them on the
      // commit that made them fade.
      accessibilityLiveRegion={
        variant === "error" || persist ? "assertive" : "polite"
      }
      // The count is spoken rather than left as a glyph: "×2" is punctuation
      // to a screen reader, and the fact it carries is the whole reason it is
      // drawn.
      accessibilityLabel={
        repeats > 1
          ? `${spec.role}: ${message} (${repeats} veces)`
          : `${spec.role}: ${message}`
      }
      entering={reduceMotion ? FadeIn : SlideInDown.duration(240)}
      exiting={reduceMotion ? FadeOut : SlideOutDown.duration(180)}
      className={`overflow-hidden rounded-xl border bg-elevated ${spec.border}`}
    >
      <View className="flex-row items-start gap-3 p-4">
        <Icon size={20} color={spec.color} strokeWidth={2.5} />
        <Text className="flex-1 text-text-primary">{message}</Text>

        {/* **Two glyphs rather than a second toast.** The tutor pressed again
            and it failed again, which they are owed; the control they pressed
            has already shaken, so this only has to be unambiguous, not loud.
            `text-secondary` and not `text-tertiary`: this is the quiet half
            of a message, not a hint, and the screen this shipped on was being
            fixed for exactly that mistake. Tabular figures so the count can
            grow without the row twitching. */}
        {repeats > 1 ? (
          <Text
            testID={testID ? `${testID}-repeats` : undefined}
            className="font-semibold text-text-secondary tabular-nums"
          >
            {`×${repeats}`}
          </Text>
        ) : null}

        {action ? (
          <Pressable
            testID={testID ? `${testID}-action` : undefined}
            onPress={() => {
              action.onPress();
              onDismiss();
            }}
            accessibilityRole="button"
            style={{ minHeight: TOUCH_TARGET, justifyContent: "center" }}
            accessibilityLabel={action.label}
            className="min-h-[48px] justify-center px-2 active:opacity-70"
          >
            <Text className="font-semibold text-accent">{action.label}</Text>
          </Pressable>
        ) : null}

        {persist && !action ? (
          <Pressable
            testID={testID ? `${testID}-dismiss` : undefined}
            onPress={onDismiss}
            accessibilityRole="button"
            style={{ minHeight: TOUCH_TARGET, justifyContent: "center" }}
            accessibilityLabel="Cerrar aviso"
            className="min-h-[48px] w-12 items-center justify-center active:opacity-70"
          >
            <X size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {persist ? null : (
        <Animated.View
          testID={testID ? `${testID}-countdown` : undefined}
          style={barStyle}
          className={`h-0.5 ${spec.bar}`}
        />
      )}
    </Animated.View>
  );
}
