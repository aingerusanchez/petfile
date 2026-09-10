import { Plus, X, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { colors, pressed, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

/** The side of the floating action, in dp. Material's own figure. */
const FAB_SIZE = 56;

/**
 * How much room a page must leave under its content for the floating action.
 *
 * The button plus the gap it sits in, plus a little air — without it the last
 * entry of a full day hides under the control that added it.
 */
export const FAB_CLEARANCE = FAB_SIZE + 40;

export type FabAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  testID?: string;
};

type FabProps = {
  /** Where the window's edges are, from `Screen`'s `overlay` render prop. */
  position: { right: number; bottom: number };
  /** What the closed button announces. */
  label: string;
  /** In order of likelihood: the first is drawn nearest the thumb. */
  actions: FabAction[];
  testID?: string;
};

/**
 * The floating action that opens the day's four kinds of entry.
 *
 * **Two taps instead of one, bought deliberately.** The four kinds used to be
 * four buttons across the top of the day view, which is one tap — but at the
 * far end of the screen from the thumb, and it spent the best real estate on
 * the page on controls rather than on the log the screen exists to show. A
 * floating action costs a tap and returns both.
 *
 * **A circle.** It was a 56dp square at the system radius while The One Radius
 * Rule still read as "one shape"; the rule now says one *corner* radius, and
 * that a control whose convention is round may be round. A floating action is
 * the clearest case there is: a circle over a page of rounded rectangles reads
 * as something laid on top, which is exactly what it is.
 *
 * **The nearest action to the thumb is the likeliest one.** Actions render in
 * the order given — walk first — and the column is reversed on screen, so the
 * reading order a screen reader follows and the reaching order a thumb follows
 * are both correct rather than one of them being sacrificed.
 *
 * **Four ways out**, the contract the date picker's sheet already set: the X,
 * the scrim, Android's Back, and choosing something. The scrim covers the
 * content but not the tab bar, which stays live — being one tap from another
 * screen is not something an open menu should take away.
 */
export function Fab({ position, label, actions, testID }: FabProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    // Back closes the menu instead of leaving the screen, which is what a
    // transient layer over the page has to do to not feel like navigation.
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setOpen(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [open]);

  return (
    <>
      {open ? (
        <Pressable
          testID={testID ? `${testID}-scrim` : undefined}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          // `auto`, because the container above passes taps through: see
          // `Screen`'s overlay slot.
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "auto",
          }}
          className="bg-base/80"
        />
      ) : null}

      <View
        // Anchored to the corner with no width of its own, so it wraps the
        // button and the pills and covers nothing else — which is what makes
        // `auto` safe here.
        style={{
          position: "absolute",
          right: position.right,
          bottom: position.bottom,
          pointerEvents: "auto",
        }}
        className="items-end"
      >
        {open ? (
          <View className="mb-4 flex-col-reverse items-end gap-3">
            {actions.map((action) => (
              <Pressable
                key={action.key}
                testID={action.testID}
                onPress={() => {
                  setOpen(false);
                  action.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={(state) => [{ minHeight: TOUCH_TARGET }, pressed(state)]}
                className="flex-row items-center gap-3 rounded-xl border border-border-strong bg-surface pr-4 pl-4"
              >
                <action.icon
                  size={20}
                  strokeWidth={2}
                  color={colors.accentSecondary}
                />
                <Text numberOfLines={1} className="text-text-primary">
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          testID={testID}
          onPress={() => setOpen((was) => !was)}
          accessibilityRole="button"
          accessibilityLabel={open ? "Cerrar" : label}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          style={(state) => [
            { width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2 },
            pressed(state),
          ]}
          className="items-center justify-center bg-accent-primary"
        >
          {open ? (
            <X size={24} strokeWidth={2.5} color={colors.onAccent} />
          ) : (
            <Plus size={24} strokeWidth={2.5} color={colors.onAccent} />
          )}
        </Pressable>
      </View>
    </>
  );
}
