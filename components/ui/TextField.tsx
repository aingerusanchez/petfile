import { useId, type ReactNode } from "react";
import {
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from "react-native";
import { FieldLabel } from "./FieldLabel";
import { atLimit, clampToLimit, showsCounter } from "../../lib/limit";
import { PLACEHOLDER_COLOR, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

type TextFieldProps = Omit<
  TextInputProps,
  "className" | "placeholderTextColor"
> & {
  label: string;
  /**
   * A control anchored in the field's own bottom-right corner.
   *
   * **For the furniture of a textarea, not for its value.** A three-line note
   * has empty space nobody is typing into, and a mark that belongs to the
   * field — what formatting it understands — reads better there than stacked
   * beside it, where its height has to be argued with the field's. The
   * caller draws it faint enough to sit over text; see `MarkdownHelp`.
   */
  corner?: ReactNode;
  /**
   * A control at the field's right edge, inline with its value.
   *
   * Where the date field keeps its calendar glyph: the field is typed and the
   * picker is the alternative, not the other way round.
   */
  trailing?: ReactNode;
  /**
   * The most characters the field takes, counted under it (`72/500`).
   *
   * **Outside the field, bottom-right.** The inside of that corner already
   * holds the Markdown help, and two things in one corner is one too many.
   * The counter appears once most of the limit is used, and a field at its
   * limit stops growing rather than warning — see `lib/limit.ts` for why, and
   * for what happens to a value that is already longer.
   *
   * **Set it instead of `maxLength`, not as well**: this prop is what supplies
   * the platform cap, and only while the value fits under it.
   *
   * It needs a controlled field driven by `onChangeText`: the clamp wraps that
   * handler and the count reads `value`, so an uncontrolled field would count
   * an empty string forever and an `onChange` caller would bypass the clamp.
   */
  limit?: number;
  /** Marks the field as one that blocks a save. */
  required?: boolean;
  /**
   * The field cannot be typed into right now, and says so.
   *
   * **Drawn in the tertiary tone, not faded.** A value that has gone to
   * `text-muted` stops being legible against this fill — tertiary keeps it at
   * 6.64:1 and still reads as "not for you to change". It is for a field that
   * would be editable under other circumstances; a field that is only ever a
   * reading takes `editable={false}` and keeps the ordinary tone, so it does
   * not look like something to fight.
   */
  disabled?: boolean;
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
  disabled = false,
  suffix,
  suffixLabel,
  corner,
  limit,
  trailing,
  onLayout,
  error = null,
  className = "mb-5",
  ...inputProps
}: TextFieldProps) {
  const labelID = useId();

  // `value` is a controlled input's, and `limit` is only meaningful on one.
  const current = inputProps.value ?? "";
  const { onChangeText } = inputProps;

  /**
   * **Read-only is not disabled, and it had no way of being said.**
   *
   * A disabled field is one the tutor could change under other circumstances;
   * a read-only one is a value this form computes and will never take typing.
   * `accessibilityState` has a key for the first and none for the second, so
   * the duration field — read-only through `editable={false}` — announced
   * `disabled: false` and nothing else, which reads as an ordinary input that
   * silently refuses the keyboard.
   *
   * The accessible name is the only channel both platforms carry, so that is
   * where it goes. On the web react-native-web also writes a `readonly`
   * attribute from `editable={false}` and a screen reader says it twice;
   * saying it once in the tutor's own language is worth the repetition.
   */
  const readOnly = !disabled && inputProps.editable === false;
  const name = suffix ? `${label}, ${suffixLabel ?? suffix}` : label;

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
        {corner ? (
          <View
            // Over the field's own bottom-right, inside its border. Absolute
            // so it takes no width from the input: a note is typed across the
            // whole field and only ever reaches this corner on its last line.
            style={{ position: "absolute", right: 6, bottom: 6, zIndex: 1 }}
          >
            {corner}
          </View>
        ) : null}
        <TextInput
          {...inputProps}
          editable={disabled ? false : inputProps.editable}
          // **The platform's cap only while the value fits under it.** Handed a
          // note longer than the limit it may cut it as it is displayed (see
          // `clampToLimit`), so an over-length note drops the cap and the
          // handler below does the binding instead.
          maxLength={
            limit === undefined
              ? inputProps.maxLength
              : current.length <= limit
                ? limit
                : undefined
          }
          onChangeText={
            limit === undefined || !onChangeText
              ? onChangeText
              : (next) => onChangeText(clampToLimit(current, next, limit))
          }
          // Spread *after* `inputProps`, so it must not throw a caller's own
          // state away: it adds `disabled` when this field is disabled and
          // otherwise hands whatever arrived straight through. Written as
          // `{{ disabled }}` it overwrote every other key a caller had set,
          // and announced `disabled: false` on fields that are nothing of the
          // kind.
          accessibilityState={
            disabled
              ? { ...inputProps.accessibilityState, disabled: true }
              : inputProps.accessibilityState
          }
          // The unit is part of what the field is asking for, so it belongs in
          // the accessible name: a screen reader gets no benefit from a glyph
          // sitting to the right of an input.
          accessibilityLabel={readOnly ? `${name}, solo lectura` : name}
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
          className={`flex-1 py-3 pl-4 font-sans ${
            disabled ? "text-text-tertiary" : "text-text-primary"
          } ${suffix ? "pr-2" : "pr-4"}`}
        />
        {trailing}
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
      {limit !== undefined && showsCounter(current.length, limit) ? (
        <Text
          testID={inputProps.testID ? `${inputProps.testID}-count` : undefined}
          // Read as a sentence, not as a fraction. Announced only when the
          // field fills: a live region on every keystroke past 400 would talk
          // over the person typing.
          accessibilityLabel={`${current.length} de ${limit} caracteres`}
          accessibilityLiveRegion={
            atLimit(current.length, limit) ? "polite" : "none"
          }
          // `text-xs`, the size the error below it takes. A count is
          // decorative and an error blocks the save; drawing the count a step
          // larger put them the wrong way round.
          className={`mt-1 self-end text-xs ${
            atLimit(current.length, limit)
              ? "text-warning"
              : "text-text-tertiary"
          }`}
        >
          {current.length}/{limit}
        </Text>
      ) : null}
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
