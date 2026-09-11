import { useId } from "react";
import {
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from "react-native";
import { FieldLabel } from "./FieldLabel";
import { PLACEHOLDER_COLOR, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

type TextFieldProps = Omit<
  TextInputProps,
  "className" | "placeholderTextColor"
> & {
  label: string;
  /** Marks the field as one that blocks a save. */
  required?: boolean;
  /**
   * The unit the field is measured in — "min.", "kg", "€" — shown inside the
   * field at its right edge.
   *
   * Inside the field rather than in the label or under it, for the reason a
   * price field puts the currency there: the unit belongs to the value being
   * typed, so it should sit next to the value. It is drawn in the placeholder
   * tone so it reads as part of the field's furniture and not as something the
   * tutor entered, and it survives typing, which a placeholder does not.
   */
  suffix?: string;
  /** How the suffix is read aloud, when the abbreviation would not be. */
  suffixLabel?: string;
  /** Reports the field's offset within its parent, for scroll-to-error. */
  onLayout?: (event: LayoutChangeEvent) => void;
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
 * **The border lives on a row wrapper, not on the input.** That is what lets a
 * unit sit inside the field, and it costs one thing worth naming: the input no
 * longer covers the last few pixels under the suffix, so a tap landing exactly
 * on "min." does not focus the field. The input still fills everything else.
 *
 * `keyboardType`, `autoCapitalize`, `autoComplete`, `returnKeyType` and
 * `maxLength` all pass straight through and should be set per field — an
 * ISO-date field raising the alphabetic keyboard is a defect, not a default.
 */
/**
 * Three lines, which is what a note about a vet visit tends to take.
 *
 * Not a `numberOfLines`: on Android that prop caps a multiline input rather
 * than sizing it, so a fourth line would be unreachable. A minimum height and
 * the field grows.
 */
const MULTILINE_HEIGHT = 88;

export function TextField({
  label,
  required = false,
  suffix,
  suffixLabel,
  onLayout,
  error = null,
  className = "mb-5",
  ...inputProps
}: TextFieldProps) {
  const labelID = useId();

  return (
    <View className={className} onLayout={onLayout}>
      <FieldLabel nativeID={labelID} required={required} errored={!!error}>
        {label}
      </FieldLabel>
      <View
        style={{ minHeight: TOUCH_TARGET }}
        className={`flex-row items-center rounded-xl border bg-surface ${
          error ? "border-error" : "border-border-default"
        }`}
      >
        <TextInput
          {...inputProps}
          // The unit is part of what the field is asking for, so it belongs in
          // the accessible name: a screen reader gets no benefit from a glyph
          // sitting to the right of an input.
          accessibilityLabel={
            suffix ? `${label}, ${suffixLabel ?? suffix}` : label
          }
          accessibilityLabelledBy={labelID}
          placeholderTextColor={PLACEHOLDER_COLOR}
          // The 48dp floor, plus the vertical centring it needs: Android draws
          // a TextInput's text from the top of its box, so a minHeight without
          // this leaves the value riding above the field's middle.
          //
          // `minWidth: 0` is what lets `flex-1` actually shrink: on the web a
          // TextInput is an <input>, whose default intrinsic width is about 20
          // characters, so inside a narrowed field the row grew past its
          // container and pushed the unit out over the controls beside it.
          //
          // **A multiline field starts at the top and stands three lines
          // tall.** Centring a note that has grown to four lines would leave
          // the first one floating in the middle of the box while the caret
          // sat elsewhere, and Android's default height for a multiline input
          // is one line — which reads as a single-line field that mysteriously
          // wraps.
          style={{
            minHeight: inputProps.multiline ? MULTILINE_HEIGHT : TOUCH_TARGET,
            minWidth: 0,
            textAlignVertical: inputProps.multiline ? "top" : "center",
          }}
          // `pl-4 pr-*` and not `px-4`: Android drops `padding-inline` on a
          // TextInput, which measured 4.9dp against the 16 the browser showed.
          className={`flex-1 py-3 pl-4 font-sans text-text-primary ${
            suffix ? "pr-2" : "pr-4"
          }`}
        />
        {suffix ? (
          <Text
            // Named on the input above, so this is decoration to a screen
            // reader — and it must not swallow taps meant for the field.
            accessible={false}
            style={{ pointerEvents: "none" }}
            className="pr-4 text-text-tertiary"
          >
            {suffix}
          </Text>
        ) : null}
      </View>
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
