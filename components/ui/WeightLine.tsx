import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { MONTHS_ES_SHORT, parseISO } from "../../lib/dates";
import { fromDateKey } from "../../lib/treatments";
import { formatWeight, type PetWeightRow } from "../../lib/weights";
import { Text } from "./Text";
import { colors } from "./tokens";

/**
 * The weight, as a shape — and enough numbers to know what shape.
 *
 * **Spaced by date, not by index.** Evenly spaced points would draw a weekly
 * routine and a six-month gap identically, which is the one thing a growth
 * line must not do: a puppy weighed in March and again in September has a
 * story between those points, and a straight rise over two evenly placed dots
 * tells it as if it were a fortnight. The x axis is time.
 *
 * **It shipped without a single number on it and that was a mistake.** A line
 * that says only "upwards" answers a question nobody asked; the two things a
 * tutor actually reads off a growth curve are *how much* it climbed and *over
 * how long*. So the ends of the range are written at the top and bottom left,
 * and the first and last months under the ends. Four small labels, no axis, no
 * grid — the frame of a chart costs more room than it returns at this size.
 *
 * **No zero baseline.** A y axis from zero flattens every real change a dog
 * makes into a horizontal line; the range is fitted to the data, with the
 * exaggeration accepted and then named by the labels, which is what stops a
 * flat month from reading as a cliff.
 *
 * **A dot per measurement, and the last one accented.** They were left out at
 * first on the grounds that a dot per point turns a line into a constellation;
 * at 3.5 units they read as texture on the line rather than as marks, and they
 * are the only thing that says *this is seven weighings* rather than a curve
 * somebody drew.
 */
export function WeightLine({
  weights,
  height = 72,
  endInset = 0,
}: {
  /** Newest first, as `weightsFor` returns them. */
  weights: PetWeightRow[];
  height?: number;
  /**
   * Room to leave at the right of the month labels.
   *
   * For a caller that anchors something in the chart's bottom-right corner —
   * the section's maximise mark sat squarely on the last month until this
   * existed.
   */
  endInset?: number;
}) {
  const [width, setWidth] = useState(0);

  const points = [...weights]
    .reverse()
    .map((row) => {
      const at = fromDateKey(row.measured_on);
      return at
        ? { time: at.getTime(), grams: row.grams, on: row.measured_on }
        : null;
    })
    .filter(
      (point): point is { time: number; grams: number; on: string } =>
        point !== null,
    );

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  // The padding keeps the stroke and the dots inside the box: a 2-unit stroke
  // centred on the top point would be clipped in half by the viewport.
  const pad = 6;
  const first = points[0];
  const last = points[points.length - 1];

  const lowest = points.length ? Math.min(...points.map((p) => p.grams)) : 0;
  const highest = points.length ? Math.max(...points.map((p) => p.grams)) : 0;

  let shape: { d: string; dots: { cx: number; cy: number }[] } | null = null;

  if (width > 0 && first && last) {
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
            `${index === 0 ? "M" : "L"}${x(point.time).toFixed(1)} ${y(
              point.grams,
            ).toFixed(1)}`,
        )
        .join(" "),
      dots: points.map((point) => ({
        cx: x(point.time),
        cy: y(point.grams),
      })),
    };
  }

  // A flat run has one number, not two: "22,5" written twice on one line is a
  // range that is not a range.
  const climbed = highest !== lowest;

  return (
    <View>
      <View className="flex-row items-stretch gap-2">
        {/* The range, read off the ends of the line it belongs to. */}
        <View
          style={{ height }}
          className="w-12 shrink-0 justify-between py-0.5"
        >
          <Text className="text-right text-xs text-text-muted">
            {shortWeight(highest)}
          </Text>
          {climbed ? (
            <Text className="text-right text-xs text-text-muted">
              {shortWeight(lowest)}
            </Text>
          ) : null}
        </View>

        <View
          testID="weight-line"
          onLayout={onLayout}
          style={{ height }}
          className="min-w-0 flex-1"
          // Decoration: every number in it is written beside it in words, and
          // a reader announcing forty coordinates is worse than silence.
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
              {shape.dots.slice(0, -1).map((dot, index) => (
                <Circle
                  key={index}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={2.5}
                  fill={colors.textTertiary}
                />
              ))}
              <Circle
                cx={shape.dots[shape.dots.length - 1].cx}
                cy={shape.dots[shape.dots.length - 1].cy}
                r={3.5}
                fill={colors.accentSecondary}
              />
            </Svg>
          ) : null}
        </View>
      </View>

      {/* The span, under the ends it belongs to. Months rather than dates: the
          line is about how long, and "mar" beside "sep" says six months
          faster than two full dates do.

          **The right-hand month yields to whatever is anchored in the corner.**
          The section puts a maximise mark there, and the last month was sitting
          underneath it — so the label stops short by exactly that much rather
          than the mark moving somewhere it means less. `endInset` is the
          caller's business: a line with nothing in its corner gives the month
          the whole width back. */}
      {first && last ? (
        <View className="mt-1 flex-row">
          <View className="w-12 shrink-0" />
          <View className="min-w-0 flex-1 flex-row justify-between">
            <Text testID="weight-line-from" className="text-xs text-text-muted">
              {shortMonth(first.on)}
            </Text>
            {first.on === last.on ? null : (
              <Text
                testID="weight-line-to"
                style={{ marginRight: endInset }}
                className="text-xs text-text-muted"
              >
                {shortMonth(last.on)}
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** "22,5" — the unit is written large right above this, so it is not repeated. */
function shortWeight(grams: number): string {
  return formatWeight(grams).replace(" kg", "");
}

/** "mar" — and "mar 25" when the year is not this one. */
function shortMonth(iso: string): string {
  const parts = parseISO(iso);
  if (!parts) return "";
  const month = MONTHS_ES_SHORT[parts.month - 1].toLowerCase();
  return parts.year === new Date().getFullYear()
    ? month
    : `${month} ${String(parts.year).slice(2)}`;
}
