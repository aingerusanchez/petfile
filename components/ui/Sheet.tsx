import type { ReactNode } from "react";
import { Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "./keyboard";
import { spacing } from "./tokens";

type SheetProps = {
  children: ReactNode;
  /** Called by the scrim, and by Android's system Back. */
  onClose: () => void;
  /** Border colour override, for a sheet that carries a consequence. */
  className?: string;
  testID?: string;
  /** testID for the scrim, where a spec wants to dismiss by tapping away. */
  scrimTestID?: string;
};

/**
 * The bottom sheet every modal surface in the app is made of.
 *
 * **It exists because of the keyboard.** Under Android edge-to-edge the window
 * is not resized when the keyboard opens, and a `Modal` sits outside the tree
 * `Screen` pads — so a bottom-anchored panel stayed exactly where it was and
 * the keyboard covered it. Measured on device: with the keyboard up, the walk
 * sheet showed its title and the two field labels, and **the fields, the
 * steppers, the note and Guardar were all behind the keyboard**, unreachable.
 * Every sheet in the app had it, including the one that asks the tutor to type
 * their dog's name before deleting his file.
 *
 * So the panel takes the keyboard as a bottom inset, exactly as `Screen` does
 * with the page. This is the second place window insets are consumed, and the
 * reason is the same one that put them in `Screen`: it should be one decision,
 * not four.
 *
 * **Four ways out**, the contract the date picker set: the scrim, Android's
 * Back, whatever the caller puts in the footer, and — where there is one — the
 * X. Nothing here commits anything.
 */
export function Sheet({
  children,
  onClose,
  className = "border-border-default",
  testID,
  scrimTestID,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID={scrimTestID}
        onPress={onClose}
        className="flex-1 justify-end bg-base/80"
      >
        <Pressable
          testID={testID}
          onPress={(event) => event.stopPropagation()}
          // The keyboard's height is measured from the bottom of the screen,
          // so it already covers the navigation-bar inset — the larger of the
          // two, never their sum.
          style={{
            paddingBottom: spacing.md + Math.max(insets.bottom, keyboard),
          }}
          className={`rounded-xl border bg-surface px-5 pt-5 ${className}`}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
