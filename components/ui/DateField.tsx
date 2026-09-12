import "dayjs/locale/es";
import { CalendarDays, X } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import DateTimePicker from "react-native-ui-datepicker";
import { NORDIC_ICE } from "./calendar";
import {
  MONTHS_ES_SHORT,
  formatDisplayDate,
  parseISO,
  parseTypedDate,
  toISO,
  yearChoices,
} from "../../lib/dates";
import { Chip } from "./Chip";
import { FieldLabel } from "./FieldLabel";
import { colors, PLACEHOLDER_COLOR, TOUCH_TARGET } from "./tokens";
import { Sheet } from "./Sheet";
import { Text } from "./Text";

type DateFieldProps = {
  label: string;
  /** Stored value, always ISO `YYYY-MM-DD`. */
  value: string | null;
  onChange: (iso: string | null) => void;
  /**
   * Collect month and year only, pinning the day to the 1st.
   *
   * The library has no month-and-year mode: its `onSelectMonth` ends with
   * `setCalendarView('day')`, so picking a month always advances to the day
   * grid. This mode therefore renders the library's month and year grids
   * through `components` overrides that keep selection in local state and
   * never hand it back, which is what keeps the day grid out of reach.
   */
  approximate?: boolean;
  /**
   * How far the picker may reach.
   *
   * **`"past"` by default, because this field was born for a birth date** and
   * nothing is born tomorrow. A treatment's next dose is in the future by
   * definition, so that one asks for `"any"` — and it has to reach backwards
   * too, since a dose that is overdue has a due date that has already passed.
   */
  reach?: "past" | "any";
  /**
   * Offer "Sin fecha" in the picker, for a field whose empty answer is real.
   *
   * A one-off treatment has nothing scheduled after it, and that is a fact
   * rather than a blank waiting to be filled. Off by default: on a field that
   * must hold a date, a way to empty it is a way to lose one.
   */
  clearable?: boolean;
  /**
   * The picker's own heading.
   *
   * **It used to be the string "Fecha de nacimiento", hard-coded**, from when
   * this field only ever collected one date — and the first treatment that
   * borrowed it opened a sheet titled with the wrong subject entirely. The
   * label above the field is shouted in caps and cannot double as a heading,
   * so the title is said once, here, by whoever knows what is being picked.
   */
  title?: string;
  required?: boolean;
  /** Reports the field's offset within its parent, for scroll-to-error. */
  onLayout?: (event: LayoutChangeEvent) => void;
  error?: string | null;
  testID?: string;
};

export function DateField({
  label,
  value,
  onChange,
  approximate = false,
  reach = "past",
  clearable = false,
  title = "Elige una fecha",
  required = false,
  onLayout,
  error = null,
  testID,
}: DateFieldProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);

  /**
   * What is in the text field, and the stored value it was last in step with.
   *
   * **Adjusted during render rather than in an effect.** The picker, and a
   * parent clearing the field, both change `value` from outside while the
   * text is the tutor's own half-finished typing — so the text follows the
   * stored value only when the stored value is the thing that moved. This is
   * React's own shape for it; an effect would be the derived-state mistake
   * `react-hooks/set-state-in-effect` exists to catch.
   */
  const [text, setText] = useState(() => formatDisplayDate(value));
  const [syncedValue, setSyncedValue] = useState(value);
  const [typedError, setTypedError] = useState<string | null>(null);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(formatDisplayDate(value));
    setTypedError(null);
  }

  /**
   * Turns what was typed into a date, when focus leaves.
   *
   * Empty is an answer where the field allows one and a blank where it does
   * not — the same `clearable` the picker's "Sin fecha" honours — and anything
   * that is not a date says so rather than silently keeping the old one.
   */
  function commitTyped() {
    if (approximate) return;

    const trimmed = text.trim();
    if (!trimmed) {
      setTypedError(null);
      if (value !== null) onChange(null);
      return;
    }

    const parts = parseTypedDate(trimmed);
    if (!parts) {
      setTypedError("Escríbela como DD/MM/AAAA");
      return;
    }

    const at = new Date(parts.year, parts.month - 1, parts.day);
    if (reach === "past" && at.getTime() > endOfToday(today)) {
      setTypedError("Todavía no ha llegado ese día");
      return;
    }

    setTypedError(null);
    const iso = toISO(parts);
    // Normalising in place is the correction Android honours, and the one a
    // live mask does not: "1092026" becomes "01/09/2026" the moment focus
    // goes somewhere else.
    setText(formatDisplayDate(iso));
    setSyncedValue(iso);
    if (iso !== value) onChange(iso);
  }
  const [draft, setDraft] = useState<Date>(today);
  const [draftYear, setDraftYear] = useState(today.getFullYear());
  const [draftMonth, setDraftMonth] = useState(today.getMonth() + 1);

  function openPicker() {
    const parts = parseISO(value);
    setDraftYear(parts?.year ?? today.getFullYear());
    setDraftMonth(parts?.month ?? today.getMonth() + 1);
    setDraft(parts ? new Date(parts.year, parts.month - 1, parts.day) : today);
    setOpen(true);
  }

  function confirm() {
    const iso = approximate
      ? toISO({ year: draftYear, month: draftMonth, day: 1 })
      : toISO({
          year: draft.getFullYear(),
          month: draft.getMonth() + 1,
          day: draft.getDate(),
        });

    // **The picker's answer replaces whatever was typed, even when it agrees
    // with what was stored.** Resyncing only on a *changed* value left a
    // refused "31/02/2026" sitting in the field with its error under it after
    // the tutor had gone to the calendar and chosen the very date that was
    // already saved — the one path where nothing changes and everything on
    // screen is stale.
    setText(formatDisplayDate(iso));
    setSyncedValue(iso);
    setTypedError(null);

    onChange(iso);
    setOpen(false);
  }

  const display = formatDisplayDate(value, approximate);

  return (
    <View className="mb-5" onLayout={onLayout}>
      <FieldLabel required={required} errored={!!error}>
        {label}
      </FieldLabel>

      {/* **The field is typed and the picker is behind its own icon.** It was
          one button: every date went through three taps in a calendar,
          including the ones somebody already knew — a birth date four years
          back is a year of paging. Now the text area takes `DD/MM/AAAA` and
          the glyph opens the calendar for the dates that are easier to point
          at than to spell.

          **No live mask, and that is not an oversight.** Inserting the slashes
          as the digits arrive was built, tested and removed here for the time
          fields: a focused `TextInput` on Android ignores a value the JS layer
          rewrites, so typing `9000` left `9000` on screen while state held
          `90:00`. It worked in the browser and nowhere else. The correction
          the platform does honour is the one on blur, which is what this does
          — and it is the same bargain the time fields already advertise.

          Approximate mode keeps the single button: a month and a year is two
          choices off a grid, and there is nothing to type. */}
      {approximate ? (
        <Pressable
          testID={testID}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={
            display
              ? `${label}: ${display}. Pulsa para cambiar`
              : `${label}. Pulsa para elegir`
          }
          style={{ minHeight: TOUCH_TARGET }}
          className={`flex-row items-center justify-between rounded-xl border bg-surface px-4 py-3 active:opacity-70 ${
            error ? "border-error" : "border-border-default"
          }`}
        >
          <Text
            className={display ? "text-text-primary" : "text-text-tertiary"}
          >
            {display || "Mes y año"}
          </Text>
          <CalendarDays size={18} color={colors.textTertiary} />
        </Pressable>
      ) : (
        <View
          className={`flex-row items-center rounded-xl border bg-surface ${
            error || typedError ? "border-error" : "border-border-default"
          }`}
        >
          <TextInput
            testID={testID}
            value={text}
            onChangeText={(next) => {
              setText(next);
              setTypedError(null);
            }}
            onBlur={commitTyped}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={PLACEHOLDER_COLOR}
            accessibilityLabel={label}
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={10}
            // `pl-4` and not `px-4`: Android drops `padding-inline` on a
            // TextInput. The floor and the centring are the same two the
            // other fields need.
            style={{
              minHeight: TOUCH_TARGET,
              minWidth: 0,
              textAlignVertical: "center",
            }}
            className="flex-1 py-3 pr-2 pl-4 font-sans text-text-primary"
          />
          <Pressable
            testID={testID ? `${testID}-picker` : undefined}
            onPress={() => {
              // Whatever is half-typed loses to the calendar rather than
              // fighting it: opening the picker is choosing to point instead.
              commitTyped();
              openPicker();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label}. Elegir en el calendario`}
            style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
            className="items-center justify-center active:opacity-70"
          >
            <CalendarDays size={18} color={colors.textTertiary} />
          </Pressable>
        </View>
      )}

      {typedError ? (
        <Text
          testID={testID ? `${testID}-typed-error` : undefined}
          accessibilityLiveRegion="polite"
          className="mt-2 text-xs text-error"
        >
          {typedError}
        </Text>
      ) : null}

      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          accessibilityLiveRegion="polite"
          className="mt-2 text-xs text-error"
        >
          {error}
        </Text>
      ) : null}

      {/* Scrim tap, the X, Cancelar and Android's system Back all dismiss
          without saving. The Back gesture is never trapped. */}
      {open ? (
        <Sheet onClose={() => setOpen(false)}>
          <>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-bold text-xl text-text-primary">
                {title}
              </Text>
              <Pressable
                testID="datepicker-close"
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar sin guardar"
                // A literal square, not `h-12 w-12`: those are 3rem, which
                // native resolves to 42dp.
                style={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
                className="items-center justify-center rounded-xl active:opacity-70"
              >
                <X size={20} color={colors.textTertiary} />
              </Pressable>
            </View>

            {approximate ? (
              /*
               * A month-and-year selector, not a calendar.
               *
               * `react-native-ui-datepicker` cannot do this mode: its
               * `onSelectMonth` ends in `setCalendarView('day')`, and a
               * `components.Month` override does not help because the library
               * wraps the override in its own Pressable that calls that same
               * handler — so a tap would still fall through to the day grid.
               * Rather than defeat the library with a remount hack, this mode
               * is two rows of the system's own Chip: a year strip and a month
               * grid. The exact-date mode below is the library's, unchanged.
               */
              <View testID="datepicker-approx">
                <FieldLabel>Año</FieldLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-5"
                  contentContainerClassName="gap-3"
                >
                  {yearChoices(today).map((year) => (
                    <Chip
                      key={year}
                      testID={`datepicker-year-${year}`}
                      label={String(year)}
                      selected={draftYear === year}
                      onPress={() => setDraftYear(year)}
                      className="shrink-0 items-center justify-center rounded-xl border px-5 py-3"
                    />
                  ))}
                </ScrollView>

                <FieldLabel>Mes</FieldLabel>
                {[0, 1, 2, 3].map((row) => (
                  <View key={row} className="mb-3 flex-row gap-3">
                    {MONTHS_ES_SHORT.slice(row * 3, row * 3 + 3).map(
                      (short, column) => {
                        const month = row * 3 + column + 1;
                        return (
                          <Chip
                            key={short}
                            testID={`datepicker-month-${month}`}
                            label={short}
                            selected={draftMonth === month}
                            onPress={() => setDraftMonth(month)}
                          />
                        );
                      },
                    )}
                  </View>
                ))}

                <Text
                  testID="datepicker-preview"
                  accessibilityLiveRegion="polite"
                  className="mt-2 text-text-tertiary"
                >
                  {formatDisplayDate(
                    toISO({ year: draftYear, month: draftMonth, day: 1 }),
                    true,
                  )}
                </Text>
              </View>
            ) : (
              <DateTimePicker
                mode="single"
                locale="es"
                // **Monday, like every calendar in Spain.** The month
                // calendar has said so since it was written and this one had
                // not, so the same app showed two different weeks: the diary's
                // grid starting on Monday and the picker underneath it
                // starting on Sunday. A locale-driven first day belongs in
                // Ajustes the day the app leaves es-ES; today it is one
                // number and one truth.
                firstDayOfWeek={1}
                date={draft}
                onChange={({ date }) => {
                  if (date) setDraft(new Date(date as string | number | Date));
                }}
                maxDate={reach === "past" ? today : undefined}
                showOutsideDays={false}
                monthCaptionFormat="full"
                classNames={NORDIC_ICE}
              />
            )}

            {clearable ? (
              <Pressable
                testID="datepicker-clear"
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Sin fecha"
                style={{ minHeight: TOUCH_TARGET }}
                className="mt-2 items-center justify-center active:opacity-70"
              >
                <Text className="font-semibold text-accent-secondary">
                  Sin fecha
                </Text>
              </Pressable>
            ) : null}

            <View className="mt-4 flex-row gap-3">
              <Pressable
                testID="datepicker-cancel"
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                style={{ minHeight: TOUCH_TARGET }}
                className="flex-1 items-center justify-center rounded-xl border border-border-strong py-4 active:opacity-70"
              >
                <Text className="text-text-secondary">Cancelar</Text>
              </Pressable>
              <Pressable
                testID="datepicker-confirm"
                onPress={confirm}
                accessibilityRole="button"
                accessibilityLabel="Confirmar"
                style={{ minHeight: TOUCH_TARGET }}
                className="flex-1 items-center justify-center rounded-xl bg-accent-primary py-4 active:opacity-70"
              >
                <Text className="font-semibold text-on-accent">Confirmar</Text>
              </Pressable>
            </View>
          </>
        </Sheet>
      ) : null}
    </View>
  );
}

/** The last instant of a day, so "today" is allowed where the future is not. */
function endOfToday(today: Date): number {
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();
}
