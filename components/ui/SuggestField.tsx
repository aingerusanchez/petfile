import { useId, useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { FieldLabel } from "./FieldLabel";
import { Text } from "./Text";
import { PLACEHOLDER_COLOR, TOUCH_TARGET } from "./tokens";

type SuggestFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** What to offer for what has been typed so far. Empty hides the list. */
  search: (text: string) => string[];
  /** Whether the typed value landed on something the app knows. */
  isKnown?: (text: string) => boolean;
  /** The reassurance shown when it did. Reassurance, never a warning. */
  knownHint?: string;
  /** Namespaces the suggestions' testIDs, one prefix per field. */
  suggestionPrefix: string;
  required?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  error?: string | null;
  placeholder?: string;
  /** Proper nouns take "words"; anything else should say so. */
  autoCapitalize?: "none" | "sentences" | "words";
  maxLength?: number;
  /**
   * Called when the field takes focus, so the screen can bring it and the
   * suggestions it is about to open above the keyboard.
   */
  onFocus?: () => void;
  testID?: string;
};

/**
 * A text field that suggests, and accepts anything.
 *
 * **Extracted from the breed field the day a second list needed it.** The
 * vaccines outgrew a row of chips — six options and a wrap — and they are the
 * same shape of problem breeds were: a list long enough to be worth offering,
 * open enough that refusing what is not on it would be refusing the truth.
 *
 * **Typing is always allowed; the suggestions only help.** That is the whole
 * contract, and it is why this is a combobox rather than a picker. What a
 * caller does about spelling is its own business — a field that keys a
 * schedule normalises what it stores, and one that only labels a dog does not.
 */
export function SuggestField({
  label,
  value,
  onChange,
  search,
  isKnown,
  knownHint,
  suggestionPrefix,
  required = false,
  onLayout,
  error = null,
  placeholder,
  autoCapitalize = "words",
  maxLength = 60,
  onFocus,
  testID,
}: SuggestFieldProps) {
  const labelID = useId();
  const [focused, setFocused] = useState(false);
  const text = value ?? "";
  const suggestions = focused ? search(text) : [];
  const recognised = text.trim().length > 0 && !!isKnown?.(text);

  return (
    <View className="mb-5" onLayout={onLayout}>
      <FieldLabel nativeID={labelID} required={required} errored={!!error}>
        {label}
      </FieldLabel>

      <TextInput
        testID={testID}
        value={text}
        onChangeText={(next) => onChange(next || null)}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        // Delay the blur so a tap on a suggestion lands before the list unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        // The 48dp floor, plus the vertical centring it needs: Android draws a
        // TextInput's text from the top of its box, so a minHeight without
        // this leaves the value riding above the field's middle.
        style={{ minHeight: TOUCH_TARGET, textAlignVertical: "center" }}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelID}
        // A breed is a proper noun and so is a vaccine: sentence-case would
        // lower-case the second word of "Husky Siberiano" or "Tos de las
        // perreras", and autocorrect actively mangles both.
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="next"
        maxLength={maxLength}
        className={`rounded-xl border bg-surface py-3 pr-4 pl-4 font-sans text-text-primary ${
          error ? "border-error" : "border-border-default"
        }`}
      />

      {suggestions.length > 0 ? (
        <View
          accessibilityRole="list"
          accessibilityLabel={`Sugerencias para ${label}`}
          className="mt-2 overflow-hidden rounded-xl border border-border-default bg-elevated"
        >
          {suggestions.map((option) => (
            <Pressable
              key={option}
              testID={`${suggestionPrefix}-${option}`}
              onPress={() => {
                onChange(option);
                setFocused(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={option}
              style={{ minHeight: TOUCH_TARGET }}
              className="justify-center border-b border-border-default px-4 py-3 last:border-b-0 active:opacity-70"
            >
              <Text className="text-text-primary">{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Confirms the typed value landed on something known. Free text is
          valid, so this is reassurance, never a warning about being off-list. */}
      {recognised && knownHint && !focused ? (
        <Text className="mt-2 text-xs text-text-tertiary">{knownHint}</Text>
      ) : null}

      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          accessibilityLiveRegion="polite"
          className="mt-2 text-xs text-error"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
