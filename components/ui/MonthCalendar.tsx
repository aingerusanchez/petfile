import { useState } from "react";
import { View } from "react-native";
import DateTimePicker from "react-native-ui-datepicker";
import { dayKey } from "../../lib/events";
import { NORDIC_ICE } from "./calendar";
import { Text } from "./Text";

/**
 * The floor for the box around a day's number, in dp.
 *
 * Round, so the radius is half of it: the One Radius Rule governs corners, and
 * a circle has none. Grown by its own padding when the text is larger, which
 * is why it is a minimum rather than a size.
 */
const DAY_CHIP = 28;

/**
 * How far the day numbers are allowed to scale with the system font size.
 *
 * The library lays the month out on a fixed row height, so past a point the
 * numbers stop fitting the grid however this component draws them — capping is
 * the honest answer rather than clipping. 1.5 was measured on the device as
 * the last scale where a two-digit number still fits comfortably.
 */
const DAY_MAX_SCALE = 1.5;

/** What one day carries, from `summariseMonth` in `lib/events.ts`. */
export type CalendarMark = {
  walkedMinutes: number;
  hasIncident: boolean;
  hasMedication: boolean;
};

type MonthCalendarProps = {
  /** Keyed `YYYY-MM-DD`. A day absent from the map has nothing logged. */
  marks: Map<string, CalendarMark>;
  /** The current daily target, for the bar. Null hides it entirely. */
  goalMinutes: number | null;
  /** Selected day. */
  value: Date;
  /** Latest selectable day — today, on this surface. */
  maxDate: Date;
  onSelect: (day: Date) => void;
  /** Fires when the visible month changes, so the caller can fetch its marks. */
  onMonthChange: (month: Date) => void;
  testID?: string;
};

/**
 * The local `YYYY-MM-DD` a library day falls on.
 *
 * **`day.date` is an instant, not a date.** It arrives as
 * `"2026-08-31T22:00:00.000Z"` for the 1st of September — Madrid is UTC+2, so
 * local midnight is the previous day in UTC. Slicing the first ten characters
 * looked safe and was wrong by a day for every timezone east of Greenwich,
 * which is the kind of thing that marks the wrong cell and nothing complains.
 * It has to go through local getters.
 */
function keyOf(date: string): string {
  const at = new Date(date);
  return Number.isNaN(at.getTime()) ? "" : dayKey(at);
}

/**
 * A month of days, each saying what happened on it.
 *
 * **Hue is reserved for what is rare.** Measured against the household's own
 * pattern — roughly one incident and one medication a month against eleven
 * days short of the goal and eighteen that met it — the two common states are
 * the background texture of a month and the two rare ones are events. So the
 * everyday states differ in **weight**, not colour, and any hue at all means
 * something happened:
 *
 * | | mark | colour |
 * |---|---|---|
 * | Met the goal | a bar under the number | Aqua Glaciar |
 * | Fell short | the number, no bar | `text-primary` |
 * | Nothing logged | the number, dimmed | `text-muted` |
 * | Medication | a ring | Warning Amber |
 * | Incident | a filled dot | Error Red |
 *
 * The rule holds for every hue, including the friendly one. A month has about
 * eighteen days that met the goal, so **whatever colour that mark is becomes
 * the calendar's background colour rather than its exception** — which is why
 * the day view's bar stopped turning Success Green and turns the secondary
 * accent instead. Aqua Glaciar is already the quiet half of the accent family;
 * red and amber stay the only alarms. Which leaves the two other common states
 * — short of the goal, and nothing logged — differing in weight alone.
 *
 * **The bar is the day view's own goal bar, in miniature** — same element,
 * same colour, same words, so it needs no learning. That is also what makes
 * every other mark legible: the calendar and the log share one vocabulary, so
 * an amber ring on the 8th is the amber pill in the 8th's own list.
 *
 * **The event dot and the goal bar are different elements**, which is what
 * lets a day say "met the goal *and* had an incident". Only the two dots
 * collapse: an incident outranks a medication, because a day has one headline.
 *
 * **Shape carries the meaning as well as colour.** A red dot and an amber dot
 * differ in fill as well as hue, and the day's accessible name says it in
 * words — this is the app's first surface that would otherwise communicate by
 * colour alone, which is the one thing its own rules forbid.
 *
 * **A day is two focus stops, and that is the library's doing.** It wraps
 * `components.Day` in its own `Pressable` with a hardcoded
 * `accessibilityLabel` of the number and offers no way to change it, so the
 * label that says what happened has to live on a node inside it: TalkBack
 * lands on "8, botón" and then on "8, objetivo conseguido, con medicación".
 * Measured on the device — both nodes are focusable and share the same
 * bounds. The alternative is one stop that says only "8", which puts the
 * whole month back to communicating by colour alone. The second stop is
 * redundant, never wrong, and the number is repeated inside it deliberately
 * so each stop stands on its own.
 *
 * Contrast on the sheet's Fjord Slate, all above the 3:1 a non-text indicator
 * needs: Error Red 4.53:1, Warning Amber 7.93:1, Aqua Glaciar 10.02:1, Mist
 * Grey 3.58:1. **Snow White was the first proposal for "fell short" and was
 * measured out of it at 15.54:1** — three and a half times the red alert, on
 * the most common state of the month, which would have made failure the
 * loudest mark on the calendar and the alarm the quietest.
 */
export function MonthCalendar({
  marks,
  goalMinutes,
  value,
  maxDate,
  onSelect,
  onMonthChange,
  testID,
}: MonthCalendarProps) {
  const [shown, setShown] = useState(value);

  return (
    <View testID={testID}>
      <DateTimePicker
        mode="single"
        date={value}
        maxDate={maxDate}
        locale="es"
        firstDayOfWeek={1}
        classNames={NORDIC_ICE}
        onChange={({ date }) => {
          if (date) onSelect(new Date(date as string | number | Date));
        }}
        onMonthChange={(month) => {
          const next = new Date(shown);
          next.setDate(1);
          next.setMonth(month);
          setShown(next);
          onMonthChange(next);
        }}
        onYearChange={(year) => {
          const next = new Date(shown);
          next.setDate(1);
          next.setFullYear(year);
          setShown(next);
          onMonthChange(next);
        }}
        components={{
          Day: (day) => {
            const mark = marks.get(keyOf(day.date));
            const logged = !!mark;
            const met =
              !!mark &&
              goalMinutes !== null &&
              mark.walkedMinutes >= goalMinutes;

            const said = [
              logged ? null : "sin registros",
              met
                ? "objetivo conseguido"
                : logged
                  ? "objetivo sin conseguir"
                  : null,
              mark?.hasIncident ? "con incidencia" : null,
              mark?.hasMedication ? "con medicación" : null,
            ].filter(Boolean);

            return (
              <View
                accessible
                accessibilityLabel={
                  said.length > 0
                    ? `${day.number}, ${said.join(", ")}`
                    : String(day.number)
                }
                className="h-full w-full items-center justify-center"
              >
                {/* **The event sits in the corner, not above the number.**
                    Stacked, it read as belonging to the row above — a ring
                    over the 8 and a bar under the 1 are two rows apart and
                    four pixels apart. The corner is also where this app
                    already puts a badge, on the portrait.

                    **And each kind has its own corner, so a day can carry
                    both.** They used to collapse, on the reasoning that a day
                    has one headline and an incident outranks a medication —
                    which quietly threw away the medication on the one day it
                    mattered most, the day something also went wrong. Side by
                    side they would not fit: two 6px marks and a gap reach
                    across 15dp of a 44dp cell and land on the round chip's
                    top edge, where an amber ring on Ice Blue Glacial is
                    illegible. Opposite corners cost nothing and buy a third
                    channel — medication is always left, an incident always
                    right — on top of hue and fill. */}
                {mark?.hasMedication ? (
                  <View
                    testID="calendar-mark-medication"
                    style={{ position: "absolute", top: 4, left: 4 }}
                    className="h-[6px] w-[6px] rounded-[3px] border border-warning"
                  />
                ) : null}
                {mark?.hasIncident ? (
                  <View
                    testID="calendar-mark-incident"
                    style={{ position: "absolute", top: 4, right: 4 }}
                    className="h-[6px] w-[6px] rounded-[3px] bg-error"
                  />
                ) : null}

                {/* **Selection is drawn here, not inherited.** A custom `Day`
                    replaces the library's cell content, so its `selected`
                    styling never reaches the number — the chosen day was
                    indistinguishable from any other. Same vocabulary as the
                    chips: the accent fills what is chosen, a hairline marks
                    today when it is not. */}
                <View
                  // **The chip grows with the number; the grid cannot.**
                  // Fixed at 28dp square it held "10" flush against the
                  // circle at font_scale 1.5, measured on the device, and
                  // would have clipped above that. So the size is a floor
                  // with padding around the digits — and the digits are
                  // capped, because the library computes a fixed row height
                  // and nothing here can make the month taller.
                  style={{
                    minWidth: DAY_CHIP,
                    minHeight: DAY_CHIP,
                    paddingHorizontal: 5,
                    borderRadius: DAY_CHIP / 2,
                  }}
                  className={`items-center justify-center ${
                    day.isSelected
                      ? "bg-accent-primary"
                      : day.isToday
                        ? "border border-border-strong"
                        : ""
                  }`}
                >
                  <Text
                    maxFontSizeMultiplier={DAY_MAX_SCALE}
                    className={
                      day.isSelected
                        ? "font-bold text-on-accent"
                        : logged
                          ? "text-text-primary"
                          : "text-text-muted"
                    }
                  >
                    {day.number}
                  </Text>
                </View>

                {/* **The day view's goal bar, in miniature — in the colour
                    that bar wears when the goal is met.** Which is the point
                    of the pair rather than a coincidence: whatever colour goes
                    here appears on most days of the month, so it is the one
                    mark that cannot be an alarm. See the day view. */}
                <View className="mt-1 h-[4px] w-[16px] items-center">
                  {met ? (
                    <View className="h-[4px] w-[16px] rounded-xl bg-accent-secondary" />
                  ) : null}
                </View>
              </View>
            );
          },
        }}
      />

      {/* **The legend names the mark, not the rule.** It carried the
          threshold — "Cumplió 1h" — on the argument that the bar is measured
          against the *current* goal and an invisible rule cannot be trusted.
          But the goal is already on the screen underneath, spelled out over
          the day's own bar, and a legend that restates it is answering a
          question nobody asked of a legend. Three labels, three marks. */}
      <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-2">
        <Legend
          className="h-[4px] w-[16px] rounded-xl bg-accent-secondary"
          label="Objetivo conseguido"
        />
        <Legend
          className="h-[6px] w-[6px] rounded-[3px] border border-warning"
          label="Medicación"
        />
        <Legend
          className="h-[6px] w-[6px] rounded-[3px] bg-error"
          label="Incidencia"
        />
      </View>
    </View>
  );
}

/**
 * Every mark is sized in arbitrary pixels, never in rem.
 *
 * The native CSS compiler resolves `1rem` to 14 rather than 16, so `h-7` is
 * 24.5dp on the device and 28 in the browser — and `rounded-full` compiles to
 * a `calc()` the compiler discards outright, which would leave the selected
 * day a square. Marks are small enough that a 12.5% shrink would not break
 * anything, but the number has to fit its box, and one rule for all of them
 * is cheaper than remembering which ones were allowed to drift.
 */
function Legend({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={className} />
      <Text className="text-xs text-text-tertiary">{label}</Text>
    </View>
  );
}
