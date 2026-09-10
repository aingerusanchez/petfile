import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { colors, pressed, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Secondary line under the label, for stating what ticking the box does. */
  hint?: string;
  /**
   * What a screen reader announces, when the visible label only makes sense
   * next to the field above it — "Aproximado" on its own names nothing.
   * Defaults to `label`.
   */
  accessibilityLabel?: string;
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
/**
 * The box's side, and the label's line height.
 *
 * A literal, and both from the same constant, because the two only share a
 * centre while they are the same height — and neither can be expressed as a
 * class here. Tailwind's `h-6` is rem-based, which the native compiler
 * resolves to 21 rather than 24, and `leading-6` reaches native as a
 * `calc()`, which that compiler warns on and discards: measured on device,
 * every `leading-*` class was inert and the label rode 2dp above the box.
 */
const BOX = 24;

/**
 * Padding that makes the row exactly one touch target tall.
 *
 * Derived rather than picked: 12 + a 24dp box + 12 is 48, so a single-line row
 * meets Android's minimum *and* centres the box by construction — no minHeight
 * leaving slack at the bottom. `py-3` was the intent and delivered 10.5dp,
 * which is where the measured 44.9dp came from.
 */
const PAD_Y = (TOUCH_TARGET - BOX) / 2;

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  accessibilityLabel,
  testID,
}: CheckboxProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      aria-checked={checked}
      accessibilityState={{ checked }}
      // Both, on purpose. `accessibilityState` is what Android reads;
      // react-native-web renders `role="checkbox"` from it but leaves out
      // `aria-checked`, so on the web target the box announced no state at
      // all. The web is only the review harness here, but a control that
      // cannot say whether it is ticked is worth two props.
      style={(state) => [{ paddingVertical: PAD_Y }, pressed(state)]}
      className="flex-row items-start gap-3 rounded-xl"
    >
      {/* The first recorded exception to The One Radius Rule, and it is forced:
          12px on a 24px box is a circle, which reads as a radio button and
          means the wrong thing. 6px is half the system radius — proportional
          to the control rather than a fresh arbitrary value. Recorded in
          DESIGN.md > Shapes. */}
      <View
        style={{ width: BOX, height: BOX }}
        className={`items-center justify-center rounded-md border ${
          checked
            ? "border-accent-primary bg-accent-primary"
            : "border-border-strong bg-surface"
        }`}
      >
        {checked ? (
          <Check size={16} strokeWidth={3} color={colors.onAccent} />
        ) : null}
      </View>
      <View className="flex-1">
        {/* The row is items-start so the box stays level with the first line
            when the label wraps or a hint follows; a line box the same height
            as the box is what puts the two on one centre. What remains is the
            font's own asymmetry — the ink sits 2.5 physical px (0.8dp) above
            the centre on device — which is below perceptibility and not worth
            a magic offset. */}
        <Text
          style={{ lineHeight: BOX }}
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
