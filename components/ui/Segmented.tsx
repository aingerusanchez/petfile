import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * One of two or three, in a single joined track — and the chosen one inverts.
 *
 * **A subtle segmented control is not available in this palette, and that is
 * measured.** Elevated Frost on Fjord Slate is 1.16:1, which is the reason the
 * chips carry a weight change instead of a fill and the reason a quiet track
 * with a quietly raised segment would read as two words floating in a box.
 * Inversion is what this palette can actually do: the selected segment takes
 * Ice Blue Glacial and its label goes dark, which is a luminance difference
 * nobody can miss and which survives both colour blindness and daylight.
 *
 * **It is also not a new idea here.** The calendar's selected day and the clock
 * face's chosen number are both a filled Ice Blue Glacial with `on-accent`
 * text. This is the third place the app says "the chosen one is the filled
 * one", and a third dialect for the same sentence would be the defect.
 *
 * **Joined, unlike `ChipGroup`.** Separate chips are a set of options; a track
 * with a divide down it is one setting with two sides, which is what a pair of
 * tabs over a single body actually is. The fill boundary *is* the divider — one
 * segment is always filled and the other never is — so the track needs no rule
 * drawn inside it.
 *
 * **Full width, and the segments split it evenly.** Sized to their labels the
 * two sides come out different widths, which reads as two buttons that happen
 * to touch; an even split reads as one track with a position in it. What makes
 * that affordable is the inversion — a filled segment says "state", where two
 * bordered pills across a card said "two large buttons".
 *
 * **An icon is optional and earns its place by being scanned rather than
 * read.** Both labels are always on screen, so nothing here is a rebus; the
 * glyph is what lets an eye find the emergency side without reading either.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "mb-5",
}: {
  options: { value: T; label: string; icon?: LucideIcon; testID?: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for a screen reader: the setting, not the options. */
  label: string;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      // `overflow-hidden` is what clips the selected fill to the track's own
      // corners; without it a filled end segment renders square inside a
      // rounded box.
      className={`flex-row overflow-hidden rounded-xl border border-border-strong ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            // See Checkbox: the web renders the role and drops the state.
            aria-checked={selected}
            style={{ minHeight: TOUCH_TARGET }}
            className={`flex-1 flex-row items-center justify-center gap-2 px-3 py-3 active:opacity-70 ${
              selected ? "bg-accent-primary" : "bg-surface"
            }`}
          >
            {Icon ? (
              <Icon
                size={16}
                strokeWidth={selected ? 2.5 : 2}
                color={selected ? colors.onAccent : colors.textTertiary}
              />
            ) : null}
            {/* One line, always: the chip's own lesson, where a three-up row
                at font_scale 1.3 broke a label mid-word inside its own box. */}
            <Text
              numberOfLines={1}
              className={
                selected
                  ? "font-semibold text-on-accent"
                  : "text-text-secondary"
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
