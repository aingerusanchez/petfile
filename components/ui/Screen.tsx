import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
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
  /** Appended to the container's classes, for per-screen alignment. */
  className?: string;
  testID?: string;
};

const BOTH: readonly Edge[] = ["top", "bottom"];

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
  className = "",
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingLeft: gutter + insets.left,
    paddingRight: gutter + insets.right,
    paddingTop: padY + (edges.includes("top") ? insets.top : 0),
    paddingBottom: padY + (edges.includes("bottom") ? insets.bottom : 0),
  };
  const alignment = center ? " items-center justify-center" : "";

  if (scroll) {
    return (
      <ScrollView
        testID={testID}
        className={`flex-1 bg-base${className ? ` ${className}` : ""}`}
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      testID={testID}
      style={padding}
      className={`flex-1 bg-base${alignment}${className ? ` ${className}` : ""}`}
    >
      {children}
    </View>
  );
}
