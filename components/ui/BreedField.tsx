import type { LayoutChangeEvent } from "react-native";
import { isKnownBreed, searchBreeds } from "../../lib/breeds";
import { SuggestField } from "./SuggestField";

type BreedFieldProps = {
  label: string;
  value: string | null;
  onChange: (breed: string | null) => void;
  required?: boolean;
  /** Reports the field's offset within its parent, for scroll-to-error. */
  onLayout?: (event: LayoutChangeEvent) => void;
  error?: string | null;
  placeholder?: string;
  /**
   * Called when the field takes focus, so the screen can bring it and the
   * suggestions it is about to open above the keyboard.
   */
  onFocus?: () => void;
  testID?: string;
};

/**
 * A combobox for breed: suggests from a curated list, accepts anything.
 *
 * **Why not free text alone.** `breed_primary` has no enum or foreign key, so
 * the column will hold whatever is typed — and a household that writes "husky"
 * one day and "Husky Siberiano" the next has two breeds for one dog. The list
 * makes the curated spelling the easy one without ever refusing another: a
 * mixed-breed rescue's real answer, and most working names, sit outside any
 * list.
 *
 * **The mechanism now lives in `SuggestField`**, extracted the day the vaccines
 * needed the same thing. What stays here is what is true of breeds: the list
 * itself, the proper-noun capitalisation, and the reassurance that a typed
 * name landed on one the app knows.
 */
export function BreedField(props: BreedFieldProps) {
  return (
    <SuggestField
      {...props}
      search={searchBreeds}
      isKnown={isKnownBreed}
      knownHint="Esa la conocemos"
      suggestionPrefix="breed-suggestion"
    />
  );
}
