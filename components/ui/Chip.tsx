import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { colors, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Leading icon, drawn in the label's colour. */
  icon?: LucideIcon;
  /**
   * Replaces the default equal-width sizing. Chips normally fill a `ChipGroup`
   * row via `flex-1`; a horizontally scrolling strip needs intrinsic width
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
  className = "flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3",
  testID,
}: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      style={{ minHeight: TOUCH_TARGET }}
      className={`${className} ${
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
      <Text className={`text-text-primary${selected ? " font-bold" : ""}`}>
        {label}
      </Text>
    </Pressable>
  );
}

type ChipGroupProps = {
  children: ReactNode;
  /** Names the group for screen readers; pass the same text as the field label. */
  label: string;
  className?: string;
};

/**
 * The equal-width row a set of chips sits in: `flex-1` siblings, 12px gap.
 * Exposes the set as a single radio group so the selected option is announced
 * in context rather than as a series of unrelated buttons.
 */
export function ChipGroup({
  children,
  label,
  className = "mb-5",
}: ChipGroupProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={`flex-row gap-3 ${className}`}
    >
      {children}
    </View>
  );
}
