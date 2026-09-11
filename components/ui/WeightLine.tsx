import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { fromDateKey } from "../../lib/treatments";
import type { PetWeightRow } from "../../lib/weights";
import { colors } from "./tokens";

/**
 * The weight, as a shape.
 *
 * **Spaced by date, not by index.** Evenly spaced points would draw a weekly
 * routine and a six-month gap identically, which is the one thing a growth
 * line must not do: a puppy weighed in March and again in September has a
 * story between those points, and a straight rise over two evenly placed dots
 * tells it as if it were a fortnight. The x axis is time.
 *
 * **No axis, no grid, no zero.** The numbers that matter are written beside it
 * in words — the current weight large, the change since the one before — and
 * this is here to say which way it has been going. A y axis starting at zero
 * would flatten every real change a dog makes into a horizontal line; one
 * fitted to the data exaggerates noise. It is fitted, with the exaggeration
 * accepted, because "is he still going up?" is the question and a padded range
 * is what keeps a flat month from looking like a cliff.
 *
 * **The last point is marked and nothing else is.** It is the one the screen
 * is actually about, and a dot per measurement turns a line into a
 * constellation at the sizes a phone has.
 */
export function WeightLine({
  weights,
  height = 64,
}: {
  /** Newest first, as `weightsFor` returns them. */
  weights: PetWeightRow[];
  height?: number;
}) {
  const [width, setWidth] = useState(0);

  const points = [...weights]
    .reverse()
    .map((row) => {
      const at = fromDateKey(row.measured_on);
      return at ? { time: at.getTime(), grams: row.grams } : null;
    })
    .filter(
      (point): point is { time: number; grams: number } => point !== null,
    );

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  // The padding keeps the stroke and the dot inside the box: a 2-unit stroke
  // centred on the top point would be clipped in half by the viewport.
  const pad = 5;
  const first = points[0];
  const last = points[points.length - 1];

  let shape: { d: string; cx: number; cy: number } | null = null;

  if (width > 0 && first && last) {
    const lowest = Math.min(...points.map((point) => point.grams));
    const highest = Math.max(...points.map((point) => point.grams));
    // A flat run has no range to divide by, and a single point has no span:
    // both draw down the middle rather than at the top or off the end.
    const span = last.time - first.time;
    const range = highest - lowest;

    const x = (time: number) =>
      span === 0
        ? width / 2
        : pad + ((time - first.time) / span) * (width - pad * 2);
    const y = (grams: number) =>
      range === 0
        ? height / 2
        : height - pad - ((grams - lowest) / range) * (height - pad * 2);

    shape = {
      d: points
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"}${x(point.time).toFixed(1)} ${y(point.grams).toFixed(1)}`,
        )
        .join(" "),
      cx: x(last.time),
      cy: y(last.grams),
    };
  }

  return (
    <View
      testID="weight-line"
      onLayout={onLayout}
      style={{ height }}
      // Decoration: every number in it is written beside it in words, and a
      // reader announcing forty coordinates is worse than silence.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {shape ? (
        <Svg width={width} height={height}>
          <Path
            d={shape.d}
            stroke={colors.textTertiary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle
            cx={shape.cx}
            cy={shape.cy}
            r={3.5}
            fill={colors.accentSecondary}
          />
        </Svg>
      ) : null}
    </View>
  );
}
