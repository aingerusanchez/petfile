import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import {
  colors,
  LoadingScreen,
  Screen,
  ScreenHeader,
  Text,
} from "../components/ui";
import { MONTHS_ES_SHORT, parseISO } from "../lib/dates";
import { getMyPet } from "../lib/pets";
import { fromDateKey } from "../lib/treatments";
import { formatWeight, weightsFor, type PetWeightRow } from "../lib/weights";

/**
 * Every weighing there has ever been, with room to read it.
 *
 * **The miniature answers "which way"; this answers "when, and how much".**
 * Putting every value and every month on the section's own chart would turn a
 * glance into a document — so the labels live here, where there is width for
 * them, and the section keeps the four that fit.
 *
 * **It scrolls sideways rather than squeezing.** Fourteen weighings across a
 * phone is a point every 25dp, which is a row of dots; the chart is as wide as
 * it needs to be and the screen carries it. Turning the phone makes it wider
 * still — which is the real answer to a long line, and one the app cannot
 * force without a native module it does not have today.
 *
 * **The room left at the top is deliberate.** A breed-and-sex average band is
 * a planned feature, and it goes behind this line rather than beside it: the
 * question it answers — "is that normal for a husky?" — is the same question
 * this screen is already about.
 */
export default function Weights() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [rows, setRows] = useState<PetWeightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyPet().then(async ({ pet, error: failure }) => {
      if (cancelled) return;
      if (failure || !pet) return setError(failure ?? "No hay ninguna mascota");
      const { weights, error: listError } = await weightsFor(pet.id, 200);
      if (cancelled) return;
      setRows(weights);
      setError(listError);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const points = [...(rows ?? [])]
    .reverse()
    .map((row) => {
      const at = fromDateKey(row.measured_on);
      return at ? { at, grams: row.grams, on: row.measured_on } : null;
    })
    .filter((p): p is { at: Date; grams: number; on: string } => p !== null);

  // Room per point, so a year of weighings is a line rather than a picket
  // fence. The chart is at least as wide as the window, and wider when the
  // history asks for it.
  const perPoint = 64;
  const padX = 28;
  const chartWidth = Math.max(
    windowWidth - 48,
    padX * 2 + Math.max(points.length - 1, 1) * perPoint,
  );
  const chartHeight = 280;
  const padY = 36;

  const lowest = points.length ? Math.min(...points.map((p) => p.grams)) : 0;
  const highest = points.length ? Math.max(...points.map((p) => p.grams)) : 0;
  const range = highest - lowest || 1;
  const first = points[0];
  const last = points[points.length - 1];
  const span = first && last ? last.at.getTime() - first.at.getTime() : 0;

  const x = (at: Date) =>
    span === 0
      ? chartWidth / 2
      : padX +
        ((at.getTime() - (first?.at.getTime() ?? 0)) / span) *
          (chartWidth - padX * 2);
  const y = (grams: number) =>
    chartHeight - padY - ((grams - lowest) / range) * (chartHeight - padY * 2);

  return (
    <Screen scroll>
      <ScreenHeader
        testID="weights-title"
        backTestID="weights-back"
        title="Peso"
        backTo="Salud"
        onBack={() => router.back()}
      />

      {error ? (
        <Text
          testID="weights-error"
          accessibilityLiveRegion="polite"
          className="text-error"
        >
          {error}
        </Text>
      ) : rows === null ? (
        <LoadingScreen />
      ) : points.length === 0 ? (
        <Text testID="weights-empty" className="text-text-tertiary">
          Todavía no le habéis pesado.
        </Text>
      ) : (
        <>
          <Text className="mb-6 text-text-tertiary">
            {points.length} {points.length === 1 ? "pesaje" : "pesajes"}, de{" "}
            {formatWeight(lowest)} a {formatWeight(highest)}.
          </Text>

          <ScrollView
            testID="weights-chart"
            horizontal
            showsHorizontalScrollIndicator={false}
            // The line reads left to right in time, so a history longer than
            // the screen should open on its oldest end and be walked forward.
            contentContainerStyle={{ paddingRight: 8 }}
          >
            <Svg width={chartWidth} height={chartHeight}>
              {/* Two hairlines rather than a grid: the ends of the range are
                  the only two values a reader needs to place the rest. */}
              <Line
                x1={0}
                y1={y(highest)}
                x2={chartWidth}
                y2={y(highest)}
                stroke={colors.borderDefault}
                strokeWidth={1}
              />
              <Line
                x1={0}
                y1={y(lowest)}
                x2={chartWidth}
                y2={y(lowest)}
                stroke={colors.borderDefault}
                strokeWidth={1}
              />
              <Path
                d={points
                  .map(
                    (point, index) =>
                      `${index === 0 ? "M" : "L"}${x(point.at).toFixed(1)} ${y(
                        point.grams,
                      ).toFixed(1)}`,
                  )
                  .join(" ")}
                stroke={colors.textTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {points.map((point, index) => (
                <Circle
                  key={point.on}
                  cx={x(point.at)}
                  cy={y(point.grams)}
                  r={index === points.length - 1 ? 5 : 3.5}
                  fill={
                    index === points.length - 1
                      ? colors.accentSecondary
                      : colors.textTertiary
                  }
                />
              ))}
            </Svg>

            {/* The labels are Text rather than SVG: they take the app's own
                typeface and its font-size preference, which an `<SvgText>`
                would not. */}
            <View
              style={{
                position: "absolute",
                width: chartWidth,
                height: chartHeight,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
            >
              {points.map((point) => (
                <View
                  key={point.on}
                  style={{
                    position: "absolute",
                    left: x(point.at) - perPoint / 2,
                    top: y(point.grams) - 30,
                    width: perPoint,
                  }}
                >
                  <Text className="text-center text-xs text-text-secondary">
                    {formatWeight(point.grams).replace(" kg", "")}
                  </Text>
                </View>
              ))}
              {points.map((point, index) => {
                // One month label per month, not per point: a fortnightly
                // routine would otherwise write "sep" four times in a row.
                const parts = parseISO(point.on);
                const previous =
                  index > 0 ? parseISO(points[index - 1].on) : null;
                if (
                  !parts ||
                  (previous &&
                    previous.month === parts.month &&
                    previous.year === parts.year)
                )
                  return null;
                return (
                  <View
                    key={`m-${point.on}`}
                    style={{
                      position: "absolute",
                      left: x(point.at) - perPoint / 2,
                      top: chartHeight - 22,
                      width: perPoint,
                    }}
                  >
                    <Text className="text-center text-xs text-text-muted">
                      {MONTHS_ES_SHORT[parts.month - 1].toLowerCase()}{" "}
                      {String(parts.year).slice(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* The list under the line, because a chart is for the shape and a
              list is for the numbers — and a note lives with its weighing. */}
          <View testID="weights-list" className="mt-8">
            {(rows ?? []).map((row) => (
              <View
                key={row.id}
                className="flex-row items-baseline justify-between gap-4 border-b border-border-default py-3 last:border-b-0"
              >
                <Text className="font-semibold text-text-primary">
                  {formatWeight(row.grams)}
                </Text>
                <Text className="text-xs text-text-tertiary">
                  {displayDate(row.measured_on)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

/** "4 de septiembre", and the year when it is not this one. */
function displayDate(iso: string): string {
  const parts = parseISO(iso);
  if (!parts) return iso;
  const month = MONTHS_ES_SHORT[parts.month - 1].toLowerCase();
  const year =
    parts.year === new Date().getFullYear() ? "" : ` de ${parts.year}`;
  return `${parts.day} de ${month}${year}`;
}
