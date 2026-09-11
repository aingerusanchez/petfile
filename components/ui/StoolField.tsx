import { Pressable, View } from "react-native";
import {
  MAX_STOOLS,
  STOOL_IDEAL,
  STOOL_SCALE,
  stoolLabel,
  stoolSpoken,
  type Stools,
} from "../../lib/stools";
import { Text } from "./Text";
import { TOUCH_TARGET } from "./tokens";

/**
 * The button that reveals the scale, in the slot beside the note.
 *
 * **It sits with the note because that is what it replaces.** Until now the
 * only way to record a stool was to type "💩" into the note, which the app
 * could read nothing out of. Putting the control where the habit already was
 * makes it the obvious next thing rather than a new field to learn — and it
 * costs the walk no vertical space at all until somebody asks for it.
 *
 * The same press closes it, which is why this is a toggle and not two
 * controls. A walk with nothing to report never opens it.
 */
export function StoolToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      testID="stool-toggle"
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={
        open ? "Cerrar la escala de kakas" : "Apuntar una kaka"
      }
      accessibilityState={{ expanded: open }}
      style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
      className={`items-center justify-center rounded-xl border active:opacity-70 ${
        open
          ? "border-accent-primary bg-elevated"
          : "border-border-default bg-surface"
      }`}
    >
      <Text style={{ fontSize: 20, lineHeight: 26 }}>💩</Text>
    </Pressable>
  );
}

/**
 * What the dog left on the walk, on a five-point scale.
 *
 * **The button does not add; it reveals a palette, and the palette adds.**
 * Adding first and choosing after would need a default, and a default is a
 * fabricated value one careless tap away — the same reason the walk proposes
 * no duration. Tapping an option appends it **and leaves the palette open**,
 * so the second stool of a walk costs one more tap.
 *
 * **The scale runs backwards, 5 to 1.** Read left to right that is the wrong
 * way round, and it puts "Perfecta" — the one tapped on almost every walk —
 * under the thumb instead of across the phone from it. The order still
 * carries the scale; it just runs toward the hand.
 *
 * **Five in one row, never wrapped.** They grow to share the width and shrink
 * to fit; a wrapped row would move the options between taps, and this is a
 * control tapped two or three times in a row.
 *
 * **What grows goes above what repeats.** A bottom sheet grows upward, so
 * anything appearing below the palette lifts it out from under the thumb
 * aiming at it — measured on the device at 110dp, and the tap that followed
 * landed on the control that had taken its place. The collected ones are
 * therefore between the note and the palette: adding one leaves every option
 * exactly where it was.
 *
 * **Tapping a collected one removes it**, which is the whole repair for a
 * mis-tap: one press, no confirmation, no menu. They are values in an unsaved
 * form rather than stored records, so the rule that keeps delete out of a list
 * is not what is at stake.
 *
 * **No colour ramp.** Five steps invite a traffic light, and red already means
 * an incident and amber medication on this app's calendar. Consistency is not
 * an alert.
 *
 * **The ideal is marked instead, and it had to be.** A five-point scale reads
 * as one-ended — the assumption is that the best is whatever is furthest from
 * diarrhoea — and the person who designed this scale with me read it that way
 * himself. A sentence under the row would be read once and never again; a mark
 * is there every time. So the healthy step carries a stronger hairline and its
 * word in the primary tone, one step up in weight and nothing else: no hue, no
 * badge, and the other four unchanged.
 */
export function StoolField({
  open,
  value,
  onChange,
}: {
  open: boolean;
  value: Stools;
  onChange: (next: Stools) => void;
}) {
  const full = value.length >= MAX_STOOLS;

  if (!open && value.length === 0) return null;

  return (
    <View className="mb-5">
      {value.length > 0 ? (
        <View className="mb-3 flex-row flex-wrap gap-2">
          {value.map((stool, index) => (
            <Pressable
              // The index is the identity: two stools can share a value, and
              // removing the first of two "2"s must not remove the second.
              key={`${index}-${stool}`}
              testID={`stool-token-${index}`}
              onPress={() => onChange(value.filter((_, at) => at !== index))}
              accessibilityRole="button"
              accessibilityLabel={`Quitar kaka ${stoolSpoken(stool)}`}
              style={{ minHeight: TOUCH_TARGET }}
              className="flex-row items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 active:opacity-70"
            >
              <Text className="font-semibold text-text-primary">
                {`${stool} · ${stoolLabel(stool)}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {open ? (
        <View className="flex-row gap-2">
          {[...STOOL_SCALE].reverse().map((step) => {
            const ideal = step.value === STOOL_IDEAL;
            return (
              <Pressable
                key={step.value}
                testID={`stool-add-${step.value}`}
                onPress={() => onChange([...value, step.value])}
                disabled={full}
                accessibilityRole="button"
                accessibilityLabel={`Apuntar kaka ${step.spoken}${
                  ideal ? ". Es la buena" : ""
                }`}
                accessibilityState={{ disabled: full }}
                // See Button: the web renders the role and drops the state.
                aria-disabled={full}
                style={{ minHeight: TOUCH_TARGET }}
                className={`min-w-0 flex-1 items-center justify-center rounded-xl border bg-surface px-1 py-2 ${
                  ideal ? "border-border-strong" : "border-border-default"
                } ${full ? "opacity-40" : "active:opacity-70"}`}
              >
                <Text className="font-semibold text-text-primary">
                  {step.value}
                </Text>
                {/* One line, always, and allowed to shrink: five in a row on a
                  375dp phone is 67dp each, and a wrapped word inside its own
                  button reads worse than a shorter one. */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className={`text-xs ${
                    ideal
                      ? "font-semibold text-text-primary"
                      : "text-text-tertiary"
                  }`}
                >
                  {step.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
