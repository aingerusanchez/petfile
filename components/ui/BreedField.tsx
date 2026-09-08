import { useId, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { isKnownBreed, searchBreeds } from "../../lib/breeds";
import { FieldLabel } from "./FieldLabel";
import { PLACEHOLDER_COLOR } from "./tokens";

type BreedFieldProps = {
  label: string;
  value: string | null;
  onChange: (breed: string | null) => void;
  required?: boolean;
  /** Reports the field's offset within its parent, for scroll-to-error. */
  onLayout?: (event: import("react-native").LayoutChangeEvent) => void;
  error?: string | null;
  placeholder?: string;
  testID?: string;
};

/**
 * A combobox for breed: suggests from a curated list, accepts anything.
 *
 * **Why not free text.** `breed_primary` has no enum or foreign key, so the
 * same dog can be recorded as "Husky Siberiano", "husky", "Siberian Husky" or
 * "Huski". Breed is now one of the fields a tutor uses to tell pets apart, and
 * the breed-percentile weight band PRODUCT.md has parked needs a normalised
 * value to be computable at all.
 *
 * **Why not a closed dropdown.** Mixed breeds, unknown provenance and regional
 * names sit outside any list. Typing is always allowed; the suggestions only
 * make the canonical spelling the path of least resistance.
 */
export function BreedField({
  label,
  value,
  onChange,
  required = false,
  onLayout,
  error = null,
  placeholder,
  testID,
}: BreedFieldProps) {
  const labelID = useId();
  const [focused, setFocused] = useState(false);
  const text = value ?? "";
  const suggestions = focused ? searchBreeds(text) : [];
  const recognised = text.trim().length > 0 && isKnownBreed(text);

  return (
    <View className="mb-5" onLayout={onLayout}>
      <FieldLabel nativeID={labelID} required={required} errored={!!error}>
        {label}
      </FieldLabel>

      <TextInput
        testID={testID}
        value={text}
        onChangeText={(next) => onChange(next || null)}
        onFocus={() => setFocused(true)}
        // Delay the blur so a tap on a suggestion lands before the list unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelID}
        // A breed is a proper noun: sentence-case would lower-case the second
        // word of "Husky Siberiano", and autocorrect actively mangles them.
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="next"
        maxLength={60}
        className={`rounded-xl border bg-surface px-4 py-3 text-text-primary ${
          error ? "border-error" : "border-border-default"
        }`}
      />

      {suggestions.length > 0 ? (
        <View
          accessibilityRole="list"
          accessibilityLabel={`Sugerencias para ${label}`}
          className="mt-2 overflow-hidden rounded-xl border border-border-default bg-elevated"
        >
          {suggestions.map((breed) => (
            <Pressable
              key={breed}
              testID={`breed-suggestion-${breed}`}
              onPress={() => {
                onChange(breed);
                setFocused(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={breed}
              className="border-b border-border-default px-4 py-3 last:border-b-0"
            >
              <Text className="text-text-primary">{breed}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Confirms the typed value landed on a known breed. Free text is valid,
          so this is reassurance, never a warning about being off-list. */}
      {recognised && !focused ? (
        <Text className="mt-2 text-xs text-text-tertiary">
          Esa la conocemos
        </Text>
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
