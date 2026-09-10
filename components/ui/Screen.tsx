import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Keyboard, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PAGE_GUTTER, spacing } from "./tokens";

type Edge = "top" | "bottom";

type ScreenProps = {
  children: ReactNode;
  /** Render inside a ScrollView. Use for any screen whose content can exceed the viewport. */
  scroll?: boolean;
  /** Centre content on both axes (loading and error states). */
  center?: boolean;
  /**
   * Which window insets to consume. Defaults to both.
   *
   * Screens inside the `(tabs)` navigator pass `["top"]`: the tab bar already
   * sits above the navigation-bar inset, so adding it again double-pads.
   */
  edges?: readonly Edge[];
  /** Horizontal page margin. Defaults to DESIGN.md's 24px; pass 0 for edge-to-edge content. */
  gutter?: number;
  /** Vertical padding added on top of the safe-area insets. Defaults to the 32px section step. */
  padY?: number;
  /**
   * Handle on the ScrollView, so a screen can scroll a field into view.
   * Only meaningful together with `scroll`.
   */
  scrollRef?: RefObject<ScrollView | null>;
  /** Current vertical scroll offset, for deciding whether a field is in view. */
  onScrollOffset?: (offset: number) => void;
  /** The scroll viewport's height, reported once it is laid out. */
  onViewportHeight?: (height: number) => void;
  /**
   * The top window inset this screen is consuming.
   *
   * A scrolled ScrollView passes *under* the status bar — the top padding
   * scrolls away with the content — so a screen that scrolls something into
   * view has to clear that band itself or land its target under the clock.
   * Reported here rather than read per screen, so `useSafeAreaInsets()` stays
   * in this one file.
   */
  onTopInset?: (inset: number) => void;
  /** Appended to the container's classes, for per-screen alignment. */
  className?: string;
  testID?: string;
};

const BOTH: readonly Edge[] = ["top", "bottom"];

/**
 * How much of the screen the software keyboard is covering, in dp.
 *
 * Under edge-to-edge — which this app runs with — Android no longer resizes
 * the window when the keyboard opens, so a ScrollView keeps its full height
 * and everything behind the keyboard becomes unreachable: measured on device,
 * the breed field's suggestion list opened entirely below the keyboard with
 * no scroll room to bring it up. Treating the keyboard as a bottom inset
 * gives the content somewhere to go.
 *
 * The listeners never fire on the web, where the value stays 0 and the
 * browser handles its own layout.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) =>
      setInset(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => setInset(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return inset;
}

/**
 * The page container every screen sits in, and the single place window insets
 * are consumed.
 *
 * Android is the platform this app ships to, so layout answers to Android's
 * insets: the status bar at the top and the system navigation bar (or gesture
 * inset) at the bottom. Before this component existed no screen consumed
 * either — `_layout.tsx` renders a Stack with `headerShown: false`, so a bare
 * `py-12` was all that stood between a screen's primary action and the
 * navigation bar. Measured on a 412x915 viewport, onboarding's submit button
 * ended up inside that bar; at 360x800 it fell 85px below the fold entirely.
 *
 * Requires `SafeAreaProvider` above it in the tree (see `app/_layout.tsx`).
 */
export function Screen({
  children,
  scroll = false,
  center = false,
  edges = BOTH,
  gutter = PAGE_GUTTER,
  padY = spacing.lg,
  scrollRef,
  onScrollOffset,
  onViewportHeight,
  onTopInset,
  className = "",
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const topInset = edges.includes("top") ? insets.top : 0;

  useEffect(() => {
    onTopInset?.(topInset);
  }, [onTopInset, topInset]);

  const bottomInset = edges.includes("bottom") ? insets.bottom : 0;
  const padding = {
    paddingLeft: gutter + insets.left,
    paddingRight: gutter + insets.right,
    paddingTop: padY + topInset,
    // The keyboard's height is measured from the bottom of the screen, so it
    // already covers the navigation-bar inset — the larger of the two, never
    // their sum.
    paddingBottom: padY + Math.max(bottomInset, keyboard),
  };
  const alignment = center ? " items-center justify-center" : "";

  if (scroll) {
    return (
      <ScrollView
        ref={scrollRef}
        testID={testID}
        className={`flex-1 bg-base${className ? ` ${className}` : ""}`}
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={
          onScrollOffset
            ? (e) => onScrollOffset(e.nativeEvent.contentOffset.y)
            : undefined
        }
        onLayout={
          onViewportHeight
            ? (e) => onViewportHeight(e.nativeEvent.layout.height)
            : undefined
        }
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      testID={testID}
      style={{ ...padding, paddingBottom: padY + bottomInset }}
      className={`flex-1 bg-base${alignment}${className ? ` ${className}` : ""}`}
    >
      {children}
    </View>
  );
}
