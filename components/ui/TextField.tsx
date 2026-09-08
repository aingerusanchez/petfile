import { useId } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";
import { FieldLabel } from "./FieldLabel";
import { PLACEHOLDER_COLOR } from "./tokens";

type TextFieldProps = Omit<TextInputProps, "className" | "placeholderTextColor"> & {
  label: string;
  /** Marks the field as not required, rendered as a word beside the label. */
  optional?: boolean;
  /** Per-field validation message. Renders below the input and drives the error border. */
  error?: string | null;
  className?: string;
};

/**
 * A labelled text input: Fjord Slate fill, Hairline Frost hairline, 12px
 * radius (DESIGN.md Components > Inputs / Fields).
 *
 * Two gaps DESIGN.md records are closed here rather than left to each screen:
 *
 * - **The label is linked to the input.** The three inputs in onboarding
 *   carried their labels as sibling `<Text>` nodes with no association, so
 *   TalkBack announced three unnamed edit boxes.
 * - **Errors can render per field.** DESIGN.md notes that errors surface as one
 *   block below the whole field group and that "a future form with several
 *   fields at once will need to decide whether that stays true". It does not:
 *   an eight-group form reveals one error at a time, at the bottom, detached
 *   from the field it names. The slot exists here so a screen can attach a
 *   message to the input it belongs to.
 *
 * `keyboardType`, `autoCapitalize`, `autoComplete`, `returnKeyType` and
 * `maxLength` all pass straight through and should be set per field — an
 * ISO-date field raising the alphabetic keyboard is a defect, not a default.
 */
export function TextField({
  label,
  optional = false,
  error = null,
  className = "mb-5",
  ...inputProps
}: TextFieldProps) {
  const labelID = useId();

  return (
    <View className={className}>
      <FieldLabel nativeID={labelID} optional={optional}>
        {label}
      </FieldLabel>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelID}
        placeholderTextColor={PLACEHOLDER_COLOR}
        className={`rounded-xl border bg-surface px-4 py-3 text-text-primary ${
          error ? "border-error" : "border-border-default"
        }`}
      />
      {error ? (
        <Text
          testID={inputProps.testID ? `${inputProps.testID}-error` : undefined}
          accessibilityLiveRegion="polite"
          className="mt-2 text-xs text-error"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
