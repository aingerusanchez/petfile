import "dayjs/locale/es";
import { CalendarDays, X } from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from "react-native";
import DateTimePicker from "react-native-ui-datepicker";
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
import { Text } from "./Text";

/**
 * Nordic Ice theming for `react-native-ui-datepicker`.
 *
 * Every visible key is set rather than merged over `useDefaultClassNames()`:
 * the library's defaults reference `text-foreground` and `bg-accent`, classes
 * this project's Tailwind theme does not define, so a partial override would
 * leave them resolving to nothing — invisible text on an invisible fill.
 */
// `ClassNames` is not part of the library's public exports, so the type is
// inferred from the component's own props rather than re-declared.
type CalendarClassNames = NonNullable<
  React.ComponentProps<typeof DateTimePicker>["classNames"]
>;

const NORDIC_ICE: CalendarClassNames = {
  header: "mb-4",
  // `capitalize` matters: dayjs's Spanish locale renders "septiembre", and the
  // header caption is the library's own, so this is the only hook for it.
  month_selector_label: "text-text-primary font-semibold capitalize",
  year_selector_label: "text-text-primary font-semibold",
  // Literal 48px minimums, not `h-12`/`p-3`: the month arrows measured
  // 27x24dp on device, barely half Android's floor, and every rem-based
  // utility would have landed at 42. These are the library's own pressables,
  // so the size has to arrive through the classNames it accepts.
  button_prev:
    "min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-border-default bg-base",
  button_next:
    "min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-border-default bg-base",
  month_selector: "min-h-[48px] justify-center px-2",
  year_selector: "min-h-[48px] justify-center px-2",
  weekdays: "mb-1",
  weekday_label: "text-xs font-semibold uppercase text-text-tertiary",
  day_cell: "p-0.5",
  day: "min-h-[48px] rounded-xl",
  // The library renders its own Text nodes, so the typeface reaches them
  // through these classNames rather than through the Text primitive.
  day_label: "font-sans text-text-primary",
  today: "rounded-xl border border-border-strong",
  today_label: "font-sans text-text-primary",
  selected: "rounded-xl border border-accent-primary bg-elevated",
  selected_label: "font-bold text-text-primary",
  outside_label: "font-sans text-text-tertiary opacity-50",
  disabled: "opacity-40",
  disabled_label: "font-sans text-text-tertiary",
  month: "rounded-xl",
  month_label: "font-sans text-text-primary",
  selected_month: "rounded-xl border border-accent-primary bg-elevated",
  selected_month_label: "font-bold text-text-primary",
  year: "rounded-xl",
  year_label: "font-sans text-text-primary",
  selected_year: "rounded-xl border border-accent-primary bg-elevated",
  selected_year_label: "font-bold text-text-primary",
};

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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Scrim tap, the X, Cancelar and Android's system Back all dismiss
            without saving. The Back gesture is never trapped. */}
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Cerrar"
          className="flex-1 justify-end bg-base/80"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-xl border border-border-default bg-surface p-5"
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-bold text-xl text-text-primary">
                {approximate ? "Mes y año" : "Fecha de nacimiento"}
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
                date={draft}
                onChange={({ date }) => {
                  if (date) setDraft(new Date(date as string | number | Date));
                }}
                maxDate={today}
                showOutsideDays={false}
                monthCaptionFormat="full"
                classNames={NORDIC_ICE}
              />
            )}

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
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
