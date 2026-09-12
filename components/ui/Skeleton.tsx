import { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** How long one breath takes, and how far the opacity travels. */
const PULSE_MS = 900;
const DIM = 0.4;

type SkeletonProps = {
  /** Width, as a number of dp or a percentage string. */
  width: DimensionValue;
  height: number;
  /** Round, for the marks and glyphs that are. */
  circle?: boolean;
  className?: string;
};

/**
 * A block standing in for content that has not arrived.
 *
 * **It is shaped like the thing it replaces, not like a spinner.** A spinner
 * says "wait"; a skeleton says "a list of entries is coming, and roughly this
 * much of it", which is the difference between a blank screen and a screen
 * that is already explaining itself. The day view's is built from these in the
 * same slots the real rows use, so nothing jumps when the data lands.
 *
 * **Fjord Slate, the same fill the goal bar's track uses.** One step off the
 * page ground, visible without competing — a skeleton that reads as content
 * is worse than none, because it is briefly a lie.
 *
 * **It breathes, and stops when the system says so.** Under "remove
 * animations" the block renders at its dim end and holds: the shape carries
 * the meaning and the pulse only says the app is still trying, so there is
 * nothing to preserve when motion is off. Same line `Celebration` draws.
 *
 * Every one of these is decoration in the accessibility tree. The region they
 * fill carries one live announcement of its own — a reader should hear
 * "cargando" once, not eleven grey boxes.
 */
export function Skeleton({
  width,
  height,
  circle = false,
  className = "",
}: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(0, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
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
      style={[{ width, height, borderRadius: circle ? height / 2 : 6 }, style]}
      className={`bg-surface ${className}`}
    />
  );
}

/**
 * The day's log, before it arrives.
 *
 * **Faithful to the real row, slot for slot**: the left column holds the time
 * and the kind's glyph, the body holds a label and the detail under it, and
 * the third row carries a note the way an entry with something to say does.
 * The widths vary because real entries do — a rank of identical bars reads as
 * a progress meter rather than as a list.
 *
 * The title is the real word rather than a grey block. "REGISTRO" is true
 * before the rows land and it is the one thing on the screen that does not
 * have to guess.
 */
/**
 * The shape a treatment row will take: a glyph, two lines, and a date.
 *
 * **A list that grows needs this more than a day's log does.** The diary is
 * bounded — four or five entries — and its wait is short; a treatment history
 * is every dose the animal has ever had, filtered on a server, and it is the
 * screen where a spinner would sit longest. The rows are faithful to the real
 * ones so the page does not jump when they arrive.
 */
export function TreatmentSkeleton({
  rows = 6,
  testID,
}: {
  rows?: number;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Cargando"
    >
      {Array.from({ length: rows }, (_, row) => (
        <View
          key={row}
          className="flex-row items-start gap-3 border-b border-border-default py-4"
        >
          <View className="shrink-0 pt-0.5">
            <Skeleton width={16} height={16} />
          </View>
          <View className="flex-1 gap-2 pt-0.5">
            <Skeleton width={row % 3 === 1 ? "62%" : "78%"} height={14} />
            <Skeleton width="40%" height={11} />
          </View>
          <View className="shrink-0 pt-0.5">
            <Skeleton width={72} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function LogSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel="Cargando">
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} className="mb-5 flex-row items-start gap-3">
          <View className="shrink-0 items-start gap-1">
            <Skeleton width={44} height={16} />
            <Skeleton width={18} height={18} />
          </View>
          <View className="flex-1 gap-2 pt-0.5">
            <Skeleton width={row === 1 ? "45%" : "32%"} height={14} />
            <Skeleton width={row === 2 ? "72%" : "54%"} height={12} />
            {row === 2 ? <Skeleton width="86%" height={10} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
