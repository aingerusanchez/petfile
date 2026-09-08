import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { colors } from "./tokens";

const PIECES = 44;
const FALL_MS = 2200;
const STAGGER_MS = 700;

/**
 * The celebration palette.
 *
 * **This is the one place a Nordic Ice colour appears as decoration**, and it
 * is a deliberate, narrow exception to The One Accent Rule rather than an
 * oversight: every colour in this system is role-scoped to something
 * interactive, so any confetti would break some rule. It is scoped to a moment
 * that happens once in an account's life. Error Red is left out — a
 * celebration does not throw warnings.
 */
const CONFETTI = [
  colors.accentPrimary,
  colors.accentSecondary,
  colors.success,
  colors.textPrimary,
];

/** Deterministic per-piece variation: stable across renders, no Math.random. */
function vary(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Piece({
  index,
  width,
  height,
}: {
  index: number;
  width: number;
  height: number;
}) {
  const progress = useSharedValue(0);

  const startX = vary(index, 1) * width;
  const delay = vary(index, 2) * STAGGER_MS;
  const drift = (vary(index, 3) - 0.5) * 90;
  const spin = 180 + vary(index, 4) * 540;
  const size = 6 + vary(index, 5) * 6;
  const color = CONFETTI[index % CONFETTI.length];
  // Half the pieces are round, half square. Squares tumble more legibly.
  const round = index % 2 === 0;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * (height + 60) },
      { translateX: Math.sin(progress.value * Math.PI * 3) * drift },
      { rotate: `${progress.value * spin}deg` },
    ],
    // Fade only over the last fifth of the fall, so pieces do not wash out
    // while they are still the thing being looked at.
    opacity: progress.value > 0.8 ? (1 - progress.value) / 0.2 : 1,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: -40,
          left: startX,
          width: size,
          height: round ? size : size * 1.6,
          borderRadius: round ? size / 2 : 1,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * A one-shot confetti fall, hosted above the navigator.
 *
 * **It degrades to nothing, not to a broken half-animation.** Under the system
 * "remove animations" setting this renders `null`: confetti has no
 * informational content, so there is nothing to preserve when motion is off —
 * unlike the button's status icon, which still appears and merely stops
 * zooming. That distinction is the rule: motion may enhance a state change,
 * never be the only thing communicating it.
 *
 * `pointerEvents="none"` throughout, so it never intercepts a tap on whatever
 * screen it is falling over.
 */
export function Celebration({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return;
    }
    const timer = setTimeout(onDone, FALL_MS + STAGGER_MS + 200);
    return () => clearTimeout(timer);
  }, [reduceMotion, onDone]);

  if (reduceMotion) return null;

  return (
    <View
      testID="celebration"
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}
    >
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} width={width} height={height} />
      ))}
    </View>
  );
}
