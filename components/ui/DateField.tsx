import "dayjs/locale/es";
import { CalendarDays, X } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from "react-native";
import DateTimePicker from "react-native-ui-datepicker";
import { NORDIC_ICE } from "./calendar";
import {
  MONTHS_ES_SHORT,
  formatDisplayDate,
  parseISO,
  toISO,
  yearChoices,
} from "../../lib/dates";
import { Chip } from "./Chip";
import { FieldLabel } from "./FieldLabel";
import { colors, TOUCH_TARGET } from "./tokens";
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
    onChange(
      approximate
        ? toISO({ year: draftYear, month: draftMonth, day: 1 })
        : toISO({
            year: draft.getFullYear(),
            month: draft.getMonth() + 1,
            day: draft.getDate(),
          }),
    );
    setOpen(false);
  }

  const display = formatDisplayDate(value, approximate);

  return (
    <View className="mb-5" onLayout={onLayout}>
      <FieldLabel required={required} errored={!!error}>
        {label}
      </FieldLabel>

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
        <Text className={display ? "text-text-primary" : "text-text-tertiary"}>
          {display || (approximate ? "Mes y año" : "DD/MM/AAAA")}
        </Text>
        <CalendarDays size={18} color={colors.textTertiary} />
      </Pressable>

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
