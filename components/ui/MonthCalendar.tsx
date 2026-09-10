import { Cake } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import DateTimePicker from "react-native-ui-datepicker";
import { birthdayOn } from "../../lib/dates";
import { dayKey } from "../../lib/events";
import { NORDIC_ICE } from "./calendar";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

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

/**
 * The strip under each day's number, in dp, and the cake that shares it.
 *
 * **It is reserved on every cell, birthday or not.** The library centres a
 * cell's content in a fixed row height, so a taller cell does not push the
 * grid around — it shifts its own number up by the difference, which reads as
 * one number sitting crooked in its row. A constant slot costs nothing.
 *
 * 28 + 2 + 10 is 40dp of a 42.5dp cell, measured on the device. That is the
 * ceiling: the cake cannot grow without the month growing with it.
 */
const BOTTOM_SLOT = 10;
const CAKE = 10;

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
  /**
   * The animal's birth date, ISO. Marked with a cake — including the 1st of
   * the month when the date is approximate, which is the convention the tutor
   * opted into rather than a day the app invented.
   */
  birthDate?: string | null;
  /** Jumps back to today and closes. */
  onToday: () => void;
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
  birthDate = null,
  onToday,
  testID,
}: MonthCalendarProps) {
  const [shown, setShown] = useState(value);
  // `maxDate` is today on this surface, which is what the button offers to go
  // back to. Already there, it stays visible and inert rather than vanishing —
  // the same call the forward arrow makes in the header above.
  const atToday = dayKey(value) === dayKey(maxDate);

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

            const years = birthdayOn(new Date(day.date), birthDate);
            const birthday = years !== null;

            const said = [
              birthday
                ? years === 0
                  ? "nació este día"
                  : `cumple ${years} ${years === 1 ? "año" : "años"}`
                : null,
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

                {/* The strip under the number holds two independent things,
                    side by side when a day carries both.

                    **The bar is the day view's own goal bar, in miniature —
                    in the colour that bar wears when the goal is met.** Which
                    is the point of the pair rather than a coincidence:
                    whatever colour goes here appears on most days of the
                    month, so it is the one mark that cannot be an alarm. See
                    the day view.

                    **The cake is the rarest mark on the calendar** — once a
                    year against the goal's eighteen days a month — and it is
                    still in Aqua Glaciar rather than a new hue: the palette
                    has no colour left that is neither an alarm nor an
                    instruction, and a cake at 10dp is a shape nothing else
                    here resembles. It gets the strip rather than a corner
                    because both corners are event marks and a birthday is
                    not an event that was logged; it is what the date is. */}
                <View
                  style={{
                    marginTop: 2,
                    height: BOTTOM_SLOT,
                    columnGap: 3,
                  }}
                  className="flex-row items-center justify-center"
                >
                  {met ? (
                    <View className="h-[4px] w-[16px] rounded-xl bg-accent-secondary" />
                  ) : null}
                  {birthday ? (
                    // Wrapped so the mark carries a testID of its own: the
                    // icon forwards unknown props to its `Svg`, which is not
                    // a contract worth leaning on.
                    <View testID="calendar-mark-birthday">
                      <Cake
                        size={CAKE}
                        color={colors.accentSecondary}
                        strokeWidth={2.5}
                      />
                    </View>
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
          question nobody asked of a legend. A label per mark, and no more.

          The cake is left out of it deliberately: it is the one mark that
          explains itself, and the header names it in words the moment you
          land on the day. */}
      {/* Centred rather than bottom-aligned: on one line the legend then
          pairs with the button's middle instead of sitting under it, and a
          legend wrapped by a large font still reads as its opposite number. */}
      <View className="mt-2 flex-row items-center justify-between gap-4">
        <View className="flex-1 flex-row flex-wrap items-center gap-x-4 gap-y-2">
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

        {/* **The way back, in the corner the legend does not reach.** Walking
            home a day at a time is the one thing the arrows are bad at, and
            the calendar is where somebody ends up after going looking. It
            sits in its own column so the legend can wrap under a large font
            without ever running into it, and it wears the chip's own
            vocabulary — a hairline pill — because a bare word beside three
            labels reads as a fourth label. */}
        <Pressable
          testID="calendar-today"
          onPress={onToday}
          disabled={atToday}
          accessibilityRole="button"
          accessibilityLabel="Ir a hoy"
          accessibilityState={{ disabled: atToday }}
          // See Button: the web renders the role and drops the state.
          aria-disabled={atToday}
          style={{ minHeight: TOUCH_TARGET }}
          className={`shrink-0 items-center justify-center rounded-xl border px-4 ${
            atToday
              ? "border-border-default"
              : "border-border-strong active:opacity-70"
          }`}
        >
          <Text
            className={`font-semibold text-xs ${
              atToday ? "text-text-muted" : "text-text-secondary"
            }`}
          >
            Hoy
          </Text>
        </Pressable>
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
