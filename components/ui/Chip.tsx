import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { colors, TOUCH_TARGET } from "./tokens";
import { FieldLabel } from "./FieldLabel";
import { Text } from "./Text";

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Leading icon, drawn in the label's colour. */
  icon?: LucideIcon;
  /**
   * Replaces the default sizing. Chips normally grow to share their
   * `ChipGroup` row; a horizontally scrolling strip needs intrinsic width
   * instead.
   */
  className?: string;
  testID?: string;
};

/**
 * One option in an exclusive single-select row — closer to a segmented control
 * than a tag (DESIGN.md Components > Chips).
 *
 * **Selected state carries a non-chromatic cue.** DESIGN.md's own rule forbids
 * communicating state by colour alone, but the documented chip spec broke it:
 * the selected fill (Elevated Frost) against the resting fill (Fjord Slate)
 * measures 1.16:1, which is imperceptible, leaving the 1px accent border as
 * the only signal. The selected label is therefore set to 700 weight — a
 * cue that survives both a colour-blind viewer and a phone in daylight, and
 * that stays inside The One Family Rule by using a heavier Outfit rather than
 * a second typeface.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
  className = "grow shrink-0 flex-row items-center justify-center gap-2 rounded-xl border py-3",
  testID,
}: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      // See Checkbox: the web renders the role and drops the state.
      aria-checked={selected}
      style={{ minHeight: TOUCH_TARGET }}
      className={`${className} active:opacity-70 ${
        selected
          ? "border-accent-primary bg-elevated"
          : "border-border-default bg-surface"
      }`}
    >
      {Icon ? (
        <Icon
          size={16}
          strokeWidth={selected ? 2.5 : 2}
          color={selected ? colors.textPrimary : colors.textTertiary}
        />
      ) : null}
      {/* One line, always. `shrink-0` above keeps the chip from being squeezed
          below its label, and this keeps the label from breaking mid-word if
          it ever is: at font_scale 1.3 a three-up row rendered "Moderado" as
          "Moderad / o", which is worse than a wrapped row. */}
      <Text
        numberOfLines={1}
        className={`text-text-primary ${selected ? "font-bold" : ""}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ChipGroupProps = {
  children: ReactNode;
  /** The field label, rendered above the row and used to name the group. */
  label: string;
  className?: string;
};

/**
 * The row a set of chips sits in: growing siblings, 12px gap, and it **wraps**.
 *
 * Chips used to be equal-width `flex-1` siblings, which squeezed the longest
 * label instead of yielding: at font_scale 1.3 "Moderado" broke across two
 * lines inside its own chip. They now size to their content and share the
 * slack, so a row that no longer fits flows onto a second line — the label is
 * never the thing that gives. Equal widths were the nicer default and are the
 * thing being traded; a fragmented word is not a trade worth making.
 *
 * Exposes the set as a single radio group so the selected option is announced
 * in context rather than as a series of unrelated buttons.
 */
export function ChipGroup({
  children,
  label,
  className = "mb-5",
}: ChipGroupProps) {
  return (
    <View className={className}>
      {/* The label is rendered here rather than beside the group. Every call
          site used to pass the same string twice — once as a `FieldLabel` and
          once for the group's accessible name — which is two places to forget
          and two chances for them to disagree. */}
      <FieldLabel>{label}</FieldLabel>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        className="flex-row flex-wrap gap-3"
      >
        {children}
      </View>
    </View>
  );
}
