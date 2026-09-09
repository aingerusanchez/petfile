import { Check, CircleAlert, type LucideIcon } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, Pressable } from "react-native";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import { colors, pressed, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "outlined" | "secondary" | "link";

/** How long the check or alert stays up before the button returns to rest. */
const RESULT_HOLD_MS = 1400;

type ButtonProps = {
  label: string;
  /**
   * Return a promise resolving to `true` for success and `false` for failure
   * and the button runs the whole feedback cycle itself: loading, then a check
   * or an alert, then back to rest. A synchronous handler skips the cycle.
   *
   * Throwing is treated as failure, so a handler does not have to catch just
   * to report one.
   */
  onPress: () => void | Promise<boolean>;
  variant?: ButtonVariant;
  /** Leading icon. Ignored while the button is showing a status. */
  icon?: LucideIcon;
  /**
   * Arbitrary leading content, for a mark an icon set cannot supply — the
   * Google "G", for instance. Ignored while the button is showing a status.
   */
  leading?: ReactNode;
  /**
   * What the button says once the action resolved. The icon alone is a signal,
   * not an explanation — a red button with a warning glyph tells the user
   * something is wrong but not what, and the screen's own rule is that an icon
   * is never a reason. The caller knows which failure it was, so it names it.
   */
  successLabel?: string;
  errorLabel?: string;
  /**
   * What a screen reader announces, when the visible label is written in the
   * app's voice rather than as an action.
   *
   * "¡Vamos, Loki!" tells a tutor looking at the screen exactly what will
   * happen, because the form above it is the context. Read out on its own it
   * is an exclamation, not a control: the accessible name has to say
   * "Registrar mascota". Defaults to `label`, so a button whose text is
   * already literal needs nothing.
   */
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

type Status = "idle" | "loading" | "success" | "error";

/**
 * The app's action button, in three weights, and the owner of async feedback.
 *
 * **Why the button owns the cycle.** Every screen that fires an async action
 * needs the same four things: a visible loading state, a lock against a second
 * press, a result the user can see, and a return to rest. Left to each screen
 * they drift — this app already had two primary buttons disagreeing about the
 * busy state, one swapping in a spinner and the other in the word
 * "Guardando...". Owning the cycle here makes duplicate submissions
 * structurally impossible rather than a thing each caller remembers.
 *
 * **The press lock covers the result phase too**, not just the request. A
 * button that re-arms the instant a promise resolves invites the second tap
 * that was already on its way.
 *
 * Motion honours the system "remove animations" setting via
 * `useReducedMotion()`: the status icon still appears, it just does not zoom.
 */
export function Button({
  label,
  onPress,
  variant = "secondary",
  icon: Icon,
  leading,
  successLabel = "¡Listo!",
  errorLabel = "Algo no ha salido bien",
  accessibilityLabel,
  disabled = false,
  testID,
}: ButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const reduceMotion = useReducedMotion();
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handlePress = useCallback(() => {
    // Locked for the whole cycle, result phase included.
    if (status !== "idle") return;

    const result = onPress();
    if (!(result instanceof Promise)) return;

    setStatus("loading");
    result
      .then((ok) => {
        if (!alive.current) return;
        setStatus(ok ? "success" : "error");
        timer.current = setTimeout(() => {
          if (alive.current) setStatus("idle");
        }, RESULT_HOLD_MS);
      })
      .catch(() => {
        if (!alive.current) return;
        setStatus("error");
        timer.current = setTimeout(() => {
          if (alive.current) setStatus("idle");
        }, RESULT_HOLD_MS);
      });
  }, [onPress, status]);

  const isLink = variant === "link";
  // `outlined` is a primary-weight action that is not ours to claim: full
  // width and a legible label, but no accent fill, because the accent means
  // "this is the one thing to do here" *in this app*. Federated sign-in is the
  // third party's affordance, and dressing it in our accent makes it look like
  // a Petfile button that happens to mention them.
  const isOutlined = variant === "outlined";
  const locked = status !== "idle";
  const inert = disabled || locked;

  // A disabled primary loses the accent instead of fading it. `opacity-50`
  // over the accent fill put its own label at 2.21:1 — unreadable — and a
  // half-transparent accent still reads as "the one thing to do here". A
  // surface fill says the action is not available; the label steps down to
  // `text-tertiary`, which measures 6.64:1 on that fill.
  const fill =
    status === "error"
      ? "bg-error"
      : variant === "primary"
        ? disabled
          ? "bg-surface"
          : "bg-accent-primary"
        : "";

  // The 48dp floor is a literal in `style`, not `min-h-12`: that class is 3rem,
  // and native resolves 1rem to 14, so it was quietly holding the hit area at
  // 42dp while reading as 48 here. See TOUCH_TARGET in tokens.ts.
  const shape = isLink
    ? "flex-row items-center gap-2 self-start py-3"
    : variant === "primary"
      ? `flex-row items-center justify-center gap-2 rounded-xl py-4 ${fill}`
      : isOutlined
        ? `flex-row items-center justify-center gap-3 rounded-xl border border-border-strong py-4 ${status === "error" ? fill : ""}`
        : "flex-row items-center justify-center gap-2 rounded-xl border border-border-strong px-6 py-3";

  // On both the accent fill and the error fill the readable colour is the dark
  // navy, not the light text: #0B1120 measures 14.88:1 on Ice Blue Glacial and
  // 5.00:1 on Error Red, while #F1F5F9 on Error Red is 3.44:1 and fails AA.
  const onFill = (variant === "primary" && !disabled) || status === "error";
  const labelClass = disabled
    ? "text-text-tertiary"
    : isLink
      ? "font-semibold text-accent-secondary"
      : onFill
        ? "font-semibold text-on-accent"
        : isOutlined
          ? "font-semibold text-text-primary"
          : "text-text-secondary";
  const iconColor = isLink
    ? colors.accentSecondary
    : onFill
      ? colors.onAccent
      : colors.textSecondary;

  // The visible label changes with the phase, so the accessible name follows
  // it: a button reading "¡Ya estáis dentro!" that still announces "Registrar
  // mascota" describes a control that is no longer there. The result labels
  // are the caller's own words and already state the outcome, so they are
  // spoken as they are — the toast carries the detail.
  const restingName = accessibilityLabel ?? label;
  const spokenName =
    status === "success"
      ? successLabel
      : status === "error"
        ? errorLabel
        : restingName;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={spokenName}
      accessibilityState={{ disabled: inert, busy: status === "loading" }}
      // See Checkbox: the web renders the role and drops the state.
      aria-disabled={inert}
      aria-busy={status === "loading"}
      style={(state) => [{ minHeight: TOUCH_TARGET }, pressed(state)]}
      className={shape}
    >
      {status === "loading" ? (
        <ActivityIndicator
          testID={testID ? `${testID}-loading` : undefined}
          color={iconColor}
        />
      ) : status === "success" ? (
        <Animated.View
          testID={testID ? `${testID}-success` : undefined}
          entering={reduceMotion ? undefined : ZoomIn.duration(220)}
          className="flex-row items-center gap-2"
        >
          <Check size={20} strokeWidth={3} color={iconColor} />
          <Text className={labelClass}>{successLabel}</Text>
        </Animated.View>
      ) : status === "error" ? (
        <Animated.View
          testID={testID ? `${testID}-error` : undefined}
          entering={reduceMotion ? undefined : ZoomIn.duration(220)}
          className="flex-row items-center gap-2"
        >
          <CircleAlert size={20} strokeWidth={2.5} color={iconColor} />
          <Text className={labelClass}>{errorLabel}</Text>
        </Animated.View>
      ) : (
        <>
          {leading}
          {Icon ? <Icon size={16} strokeWidth={2.5} color={iconColor} /> : null}
          <Text className={labelClass}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
