import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "./keyboard";
import { spacing } from "./tokens";

type SheetProps = {
  children: ReactNode;
  /** Called by the scrim, and by Android's system Back. */
  onClose: () => void;
  /**
   * Which edge the panel is attached to. Bottom by default.
   *
   * **`"top"` is for a panel that comes from the header rather than the
   * thumb** — the diary's calendar drops from the date it replaces and goes
   * back up into it. It takes the status-bar inset instead of the keyboard's,
   * because nothing anchored to the top is ever covered by a keyboard.
   */
  anchor?: "bottom" | "top";
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
 *
 * **And it scrolls, because a panel that grows has nowhere to grow to.** The
 * treatment form gained one row of chips and the whole sheet slid off the top
 * of the phone: the title ended up under the system clock and the scrim was
 * gone, so the thing no longer read as a sheet at all — and there was no way
 * back to the content above. Measured on device. The panel is now capped at
 * the window minus the status bar and a strip of scrim, and its content
 * scrolls inside that; a sheet shorter than the cap is unchanged, because a
 * `ScrollView` takes the height of what is in it until there is more.
 */
export function Sheet({
  children,
  onClose,
  anchor = "bottom",
  className = "border-border-default",
  testID,
  scrimTestID,
}: SheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const fromTop = anchor === "top";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* **The scrim is a sibling of the panel, not its parent.** It used to
          wrap it, which was tidy until the scrim gained the accessible name it
          needed: a `Pressable` with a button role renders as a real `<button>`
          on the web, and every control in the panel became a button inside a
          button — "cannot be a descendant of", once per sheet, in the console.
          Laid side by side the nesting cannot happen, the panel needs no
          `stopPropagation` to survive a tap, and the scrim keeps the name that
          made it one of the four documented ways out. */}
      <View className={`flex-1 ${fromTop ? "justify-start" : "justify-end"}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          testID={scrimTestID}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          className="bg-base/80"
        />
        <ScrollView
          testID={testID}
          // The cap: everything but the status bar and a strip of scrim, so a
          // full sheet still reads as a panel over a page rather than as a
          // screen that arrived without warning. `bounces={false}` because a
          // rubber band on a panel anchored to an edge looks like the panel
          // coming loose.
          style={{
            maxHeight:
              height - insets.top - spacing.lg - (fromTop ? 0 : insets.bottom),
          }}
          bounces={false}
          overScrollMode="never"
          // A tap on a field while another field's keyboard is up should land
          // on the field, not be eaten dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            fromTop
              ? {
                  paddingTop: spacing.md + insets.top,
                  paddingBottom: spacing.md,
                }
              : {
                  paddingTop: spacing.md,
                  paddingBottom: spacing.md + Math.max(insets.bottom, keyboard),
                }
          }
          // The insets live on the content rather than on the box now: a
          // `ScrollView`'s own padding would scroll away with the content,
          // which is exactly what the keyboard inset must not do.
          //
          // `rounded-xl` on all four corners for both anchors: the pair
          // against the screen edge is off-screen either way, and it keeps
          // this off the untested `rounded-t-*` path.
          className={`rounded-xl border bg-surface px-5 ${className}`}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
