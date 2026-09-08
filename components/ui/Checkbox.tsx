import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors } from "./tokens";

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Secondary line under the label, for stating what ticking the box does. */
  hint?: string;
  testID?: string;
};

/**
 * A voluntary boolean flag, unchecked by default.
 *
 * **Why this exists instead of another chip row.** Onboarding had three
 * adjacent Sí/No chip rows that looked identical but behaved differently: two
 * of them rendered "No" pre-selected with the accent border on first paint, so
 * an untouched assumption was indistinguishable from a deliberate answer, and
 * the polarity flipped between them. A tutor tapping down the left column
 * answered "no mestizo, fecha exacta" without ever deciding either.
 *
 * A checkbox says what a chip pair could not: this is off unless you turn it
 * on. Both flags it replaces (`isMixed`, `birthDateApproximate`) qualify the
 * field above them and are only ever asserted deliberately, so "unchecked" is
 * the honest resting state rather than a hidden answer.
 *
 * `spayedNeutered` deliberately stays a three-way chip row: "no lo sé" is a
 * real answer there (an adopted dog's history is often unknown), and a
 * checkbox cannot express a third state.
 *
 * The tick is a real SVG icon, never a Unicode glyph: Outfit's charset does
 * not cover the check characters, so a glyph would silently fall back to
 * another typeface and break The One Family Rule.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  testID,
}: CheckboxProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked }}
      // 48dp minimum touch target (Android): 12px padding + a 24px box.
      className="flex-row items-start gap-3 rounded-xl py-3"
    >
      {/* The first recorded exception to The One Radius Rule, and it is forced:
          12px on a 24px box is a circle, which reads as a radio button and
          means the wrong thing. 6px is half the system radius — proportional
          to the control rather than a fresh arbitrary value. Recorded in
          DESIGN.md > Shapes. */}
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          checked
            ? "border-accent-primary bg-accent-primary"
            : "border-border-strong bg-surface"
        }`}
      >
        {checked ? <Check size={16} strokeWidth={3} color={colors.onAccent} /> : null}
      </View>
      <View className="flex-1">
        <Text
          className={`text-text-primary${checked ? " font-semibold" : ""}`}
        >
          {label}
        </Text>
        {hint ? (
          <Text className="mt-1 text-xs text-text-tertiary">{hint}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
