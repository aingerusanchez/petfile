import type DateTimePicker from "react-native-ui-datepicker";

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
export type CalendarClassNames = NonNullable<
  React.ComponentProps<typeof DateTimePicker>["classNames"]
>;

export const NORDIC_ICE: CalendarClassNames = {
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
  month_selector: "min-h-[48px] min-w-[48px] justify-center px-2",
  // The width matters too: "2026" with `px-2` measured 43.7dp on the device,
  // and Android's floor applies to both axes.
  year_selector: "min-h-[48px] min-w-[48px] justify-center px-2",
  weekdays: "mb-1",
  weekday_label: "text-xs font-semibold uppercase text-text-tertiary",
  // **No padding here, and the reason is the touch target.** A column is
  // 48.1dp on a 375dp phone — seven of them exactly fill the panel — and
  // `p-0.5` (1.75dp a side on native) took the pressable inside it down to
  // 44.6. Measured on the device, on both calendars, 60 targets. The cell's
  // content is a centred 28dp chip either way, so the padding bought nothing
  // and cost the floor on the horizontal axis, which this file's own comment
  // above says applies.
  day_cell: "",
  // **This never reaches a calendar with a custom `Day`.** The library applies
  // `classNames.day` to its own Pressable only in the default branch; the
  // `components.Day` branch passes `style` and drops the className, the same
  // way it drops `selected` and `today`. `MonthCalendar` sets the floor on its
  // own cell instead — see `CONTAINER_HEIGHT` there. Kept for `DateField`, which
  // the library's own day.
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
