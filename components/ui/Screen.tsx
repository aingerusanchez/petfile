import { useEffect, type ReactNode, type RefObject } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "./keyboard";
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
  /**
   * Content pinned over the page rather than scrolled with it — a floating
   * action, for instance.
   *
   * A render prop rather than a node, because the thing that floats has to
   * know how far the window's edges are, and **window insets are consumed
   * only here**. It is handed the offsets it should use and draws itself
   * inside a full-screen container that passes taps through, so it can also
   * paint a scrim over the content without reaching outside its parent. Its
   * own children have to opt back in with `pointerEvents: "auto"`.
   */
  overlay?: (position: { right: number; bottom: number }) => ReactNode;
  /**
   * Content pinned to the foot of the screen, below everything else.
   *
   * For what should be findable and not looked at — the build's version. It
   * sits at the bottom of the *viewport* when the content is short and after
   * the content when it is long, which is what "out of the way" means on a
   * screen that can scroll.
   */
  footer?: ReactNode;
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
  scrollRef,
  onScrollOffset,
  onViewportHeight,
  onTopInset,
  overlay,
  footer,
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
  const alignment = center ? "items-center justify-center" : "";

  const floating = overlay ? (
    // `box-none` — the value that means "not me, but my children" — and it has
    // to come from a **registered** style to work on both targets. The three
    // wrong ways, all tried:
    //
    //   * the `pointerEvents` prop: deprecated in this React Native version,
    //     and it logs a warning per render;
    //   * `box-none` in an inline style: react-native-web writes it straight
    //     into the style attribute, where `pointer-events: box-none` is not
    //     CSS and the browser drops the declaration — measured, this
    //     full-screen container then swallowed every tap on the page;
    //   * `none` in an inline style: valid CSS, and a child can opt back in
    //     with `auto` on the web — but in React Native `none` excludes the
    //     whole subtree, so on the device the floating action could not be
    //     pressed at all. That is the bug this replaces.
    //
    // Registered, react-native-web's StyleSheet compiler expands `box-none`
    // into `pointer-events: none` on the element plus `auto` on its children,
    // which is exactly the native meaning.
    <View style={styles.floating}>
      {overlay({
        right: gutter + insets.right,
        // A floating action sits at the section step from the window's edge,
        // not at the page's own vertical padding, which is twice that.
        bottom: spacing.md + bottomInset,
      })}
    </View>
  ) : null;

  if (scroll) {
    const scroller = (
      <ScrollView
        ref={scrollRef}
        testID={testID}
        className={`flex-1 bg-base ${className}`}
        // `flexGrow` only with a footer: it makes the content container fill
        // the viewport so `mt-auto` has somewhere to push to, and it is a
        // no-op once the content is taller than the screen.
        contentContainerStyle={footer ? { ...padding, flexGrow: 1 } : padding}
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
        {footer ? <View className="mt-auto">{footer}</View> : null}
      </ScrollView>
    );

    if (!floating) return scroller;
    return (
      <View className="flex-1 bg-base">
        {scroller}
        {floating}
      </View>
    );
  }

  if (!footer) {
    return (
      <View
        testID={testID}
        style={{ ...padding, paddingBottom: padY + bottomInset }}
        className={`flex-1 bg-base ${alignment} ${className}`}
      >
        {children}
        {floating}
      </View>
    );
  }

  // With a footer the alignment moves to an inner box, so the footer can sit
  // below whatever the screen centred rather than being centred with it.
  return (
    <View
      testID={testID}
      style={{ ...padding, paddingBottom: padY + bottomInset }}
      className="flex-1 bg-base"
    >
      <View className={`flex-1 ${alignment} ${className}`}>{children}</View>
      {footer}
      {floating}
    </View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "box-none",
  },
});
