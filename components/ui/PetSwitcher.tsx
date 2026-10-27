import { Check, ChevronDown, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * One pet as the switcher needs it — a face, a name and an id.
 *
 * Deliberately not the `Pet` row: this component never reads the database and
 * never signs a URL. It is handed a list and gives back an id.
 */
export type PetChoice = {
  id: string;
  name: string;
  /** A signed URL from `lib/photos.ts`, or null while there is no photo. */
  photoUri: string | null;
};

type PetSwitcherProps = {
  /** Every pet this tutor can reach, in the order they should be offered. */
  pets: PetChoice[];
  /** Whichever of them the phone is looking at right now. */
  activeId: string;
  /** Called with the chosen id. The sheet is already closing when it runs. */
  onSelect: (id: string) => void;
};

/** The portrait in the row and in each option: the same face at the same size. */
const FACE = 40;

/**
 * Below this there is nothing to switch between and the component draws
 * nothing — see the docblock below for why.
 *
 * Exported because a caller has to know it too: the switcher renders a
 * fragment, so the gap between it and whatever follows belongs to the screen,
 * and a screen that always reserved that gap would leave 24dp of nothing on
 * the single-pet profile. One constant rather than two hard-coded `2`s that
 * could drift apart.
 */
export const MIN_SWITCHABLE_PETS = 2;

/**
 * The control that says which pet you are looking at, and changes it.
 *
 * **With one pet it draws nothing at all.** A household with a single dog has
 * no switching to do, and a chevron beside his name would invite a tap that
 * opens a sheet with one option in it — a control that exists only to say it
 * has nothing to offer. So the whole thing is absent below two pets, which
 * also means the single-pet app is byte-for-byte the screen it was before
 * this existed.
 *
 * **It knows nothing about storage.** `useActivePet` lives in `lib/pet.tsx`
 * and this component never touches it: the list, the active id and what to do
 * about a tap all arrive as props. That is what lets Perfil and the header
 * share one switcher without agreeing on where the choice is kept.
 *
 * **The row announces itself as a control, not as a pet.** A name and a
 * chevron read as a heading with a decoration beside it; "Cambiar de mascota.
 * Ahora: Loki" is the only version that says there is something to press and
 * what pressing it would change.
 *
 * **The sheet is an exclusive single-select, so it speaks the dialect the
 * chips already speak** — a `radiogroup` of `radio`s, with the state on both
 * `accessibilityState` and `aria-checked` because react-native-web renders
 * the role and drops the state (see `Checkbox`). The chosen one also carries
 * a `Check` in the accent and a heavier name, because a tinted fill is not
 * available in this palette: Elevated Frost on Fjord Slate measures 1.16:1,
 * which is the same imperceptible step that forced the chips' selected state
 * to carry a weight change.
 */
export function PetSwitcher({ pets, activeId, onSelect }: PetSwitcherProps) {
  // **The hook comes first and the invisibility guard comes second.** An early
  // `return` above `useState` is a `rules-of-hooks` error in this repo, not a
  // warning — the same trap that hoisted two `useCallback`s over the early
  // returns in `app/(tabs)/index.tsx`.
  const [open, setOpen] = useState(false);

  if (pets.length < MIN_SWITCHABLE_PETS) return null;

  // An `activeId` naming no pet is a caller's bug — a pet deleted on another
  // phone, say. The row falls back to the first of the list rather than
  // rendering a control with no name on it.
  const active = pets.find((pet) => pet.id === activeId) ?? pets[0];

  return (
    <>
      <Pressable
        testID="pet-switcher"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar de mascota. Ahora: ${active.name}`}
        // A plain object, never a callback: given both a `className` and a
        // callback `style`, native drops the callback entirely and the
        // control silently loses its touch floor. `TOUCH_TARGET` rather than
        // `min-h-12`, which is 3rem and lands at 42dp on the device.
        style={{ minHeight: TOUCH_TARGET }}
        // `self-start` so the pressable hugs the name: stretched across a
        // header it would turn the empty space beside the chevron into a tap
        // that opens the sheet.
        //
        // Kept when the switcher was actually placed, in Perfil. Full width
        // with the chevron against the right edge is the list-row idiom — it
        // promises a screen to navigate to — and this opens a menu in place.
        // A name with a chevron immediately after it is the shape that says
        // so, and it lines up with the portrait-and-name block directly
        // below, which is left-hugging too.
        className="flex-row items-center gap-3 self-start pr-1 active:opacity-70"
      >
        <Avatar uri={active.photoUri} name={active.name} size={FACE} />
        {/* `shrink`, not just `numberOfLines`. `flexShrink` is 0 by default in
            React Native, so without it the name takes whatever width it wants
            and the chevron is pushed off the right edge — the name field
            accepts 40 characters, which is already wider than the row has.
            `numberOfLines` only ellipsizes a box that has been made narrower;
            it does not make one narrower. `shrink` rather than the sheet's
            `flex-1` because the row is `self-start` and must keep hugging its
            content at ordinary lengths. */}
        <Text
          numberOfLines={1}
          className="shrink font-semibold text-text-primary"
        >
          {active.name}
        </Text>
        <ChevronDown size={20} strokeWidth={2} color={colors.textTertiary} />
      </Pressable>

      {open ? (
        <Sheet onClose={() => setOpen(false)} testID="pet-switcher-sheet">
          <>
            {/* The four ways out this app's sheets all keep: the scrim,
                Android's Back, the X, and picking one of the options. */}
            <View className="mb-2 flex-row items-center justify-between">
              <Text
                accessibilityRole="header"
                className="font-bold text-xl text-text-primary"
              >
                Cambiar de mascota
              </Text>
              <Pressable
                testID="pet-switcher-close"
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                // A literal square, not `h-12 w-12`: those are 3rem, which
                // native resolves to 42dp.
                style={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
                className="-mr-3 items-center justify-center rounded-xl active:opacity-70"
              >
                <X size={20} color={colors.textTertiary} />
              </Pressable>
            </View>

            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Mascotas"
              className="mb-2"
            >
              {pets.map((pet) => {
                const selected = pet.id === activeId;

                return (
                  <Pressable
                    key={pet.id}
                    testID={`pet-choice-${pet.id}`}
                    onPress={() => {
                      setOpen(false);
                      onSelect(pet.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={pet.name}
                    accessibilityState={{ selected, checked: selected }}
                    // See Checkbox: the web renders the role and drops the
                    // state.
                    aria-checked={selected}
                    style={{ minHeight: TOUCH_TARGET }}
                    className="flex-row items-center gap-3 py-2 active:opacity-70"
                  >
                    <Avatar uri={pet.photoUri} name={pet.name} size={FACE} />
                    {/* The separator lives in the literal, outside the
                        quotes: `prettier-plugin-tailwindcss` trims what is
                        inside them and would glue the two classes together.
                        `flex-1` pushes the check to the far edge and keeps a
                        long name off it. */}
                    <Text
                      numberOfLines={1}
                      className={`flex-1 text-text-primary ${selected ? "font-bold" : ""}`}
                    >
                      {pet.name}
                    </Text>
                    {selected ? (
                      <Check
                        size={20}
                        strokeWidth={2.5}
                        color={colors.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        </Sheet>
      ) : null}
    </>
  );
}
