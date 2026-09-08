import { Check, CircleAlert, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import { colors } from "./tokens";

export type ButtonVariant = "primary" | "secondary" | "link";

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
   * What the button says once the action resolved. The icon alone is a signal,
   * not an explanation — a red button with a warning glyph tells the user
   * something is wrong but not what, and the screen's own rule is that an icon
   * is never a reason. The caller knows which failure it was, so it names it.
   */
  successLabel?: string;
  errorLabel?: string;
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
  successLabel = "¡Listo!",
  errorLabel = "Algo no ha salido bien",
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
  const locked = status !== "idle";
  const inert = disabled || locked;

  const fill =
    status === "error"
      ? "bg-error"
      : variant === "primary"
        ? "bg-accent-primary"
        : "";

  const shape = isLink
    ? // min-h-12 keeps the hit area at Android's 48dp minimum even though the
      // visible target is only text.
      "min-h-12 flex-row items-center gap-2 self-start py-3"
    : variant === "primary"
      ? `min-h-12 flex-row items-center justify-center gap-2 rounded-xl py-4 ${fill}`
      : "min-h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border-strong px-6 py-3";

  // On both the accent fill and the error fill the readable colour is the dark
  // navy, not the light text: #0B1120 measures 14.88:1 on Ice Blue Glacial and
  // 5.00:1 on Error Red, while #F1F5F9 on Error Red is 3.44:1 and fails AA.
  const onFill = variant === "primary" || status === "error";
  const labelClass = isLink
    ? "font-semibold text-accent-secondary"
    : onFill
      ? "font-semibold text-on-accent"
      : "text-text-secondary";
  const iconColor = isLink
    ? colors.accentSecondary
    : onFill
      ? colors.onAccent
      : colors.textSecondary;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: status === "loading" }}
      className={`${shape}${disabled ? " opacity-50" : ""}`}
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
          {Icon ? <Icon size={16} strokeWidth={2.5} color={iconColor} /> : null}
          <Text className={labelClass}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
