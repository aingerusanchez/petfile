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
import { colors } from "./tokens";
import { Text } from "./Text";

export type ToastVariant = "success" | "warning" | "error" | "info";

export type ToastOptions = {
  variant: ToastVariant;
  /** The single sentence the toast exists to deliver. */
  message: string;
  /**
   * Milliseconds before it hides itself. Defaults to 4000.
   * Ignored when `persist` is true.
   */
  duration?: number;
  /**
   * Stay until the user acts. Use for anything the user must read or respond
   * to — a failed write, a decision. A persistent toast shows a dismiss
   * control instead of a countdown, because a progress bar that never
   * finishes is a lie.
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
 * control instead.
 */
export function Toast({
  variant,
  message,
  duration = 4000,
  persist = false,
  action,
  onDismiss,
  testID,
}: ToastProps) {
  const spec = VARIANTS[variant];
  const Icon = spec.icon;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (persist) return;
    progress.value = withTiming(0, {
      duration,
      easing: Easing.linear,
    });
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [persist, duration, onDismiss, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="alert"
      // A persistent toast is assertive: the user has to deal with it. An
      // auto-hiding one is polite, so it never interrupts what is being read.
      accessibilityLiveRegion={persist ? "assertive" : "polite"}
      accessibilityLabel={`${spec.role}: ${message}`}
      entering={reduceMotion ? FadeIn : SlideInDown.duration(240)}
      exiting={reduceMotion ? FadeOut : SlideOutDown.duration(180)}
      className={`overflow-hidden rounded-xl border bg-elevated ${spec.border}`}
    >
      <View className="flex-row items-start gap-3 p-4">
        <Icon size={20} color={spec.color} strokeWidth={2.5} />
        <Text className="flex-1 text-text-primary">{message}</Text>

        {action ? (
          <Pressable
            testID={testID ? `${testID}-action` : undefined}
            onPress={() => {
              action.onPress();
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            className="min-h-12 justify-center px-2"
          >
            <Text className="font-semibold text-accent-secondary">
              {action.label}
            </Text>
          </Pressable>
        ) : null}

        {persist && !action ? (
          <Pressable
            testID={testID ? `${testID}-dismiss` : undefined}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            className="min-h-12 w-12 items-center justify-center"
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
