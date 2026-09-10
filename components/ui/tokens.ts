/**
 * Nordic Ice token values for React Native props that `className` cannot reach.
 *
 * NativeWind styles most things, but a handful of RN props take a colour value
 * directly — `placeholderTextColor`, `ActivityIndicator`'s `color`, navigator
 * `screenOptions`, `tabBarStyle`. Those were previously hand-typed hex literals
 * at 11 sites across `app/`, every one an exact token value, so a change to a
 * token in `global.css` would silently leave them behind.
 *
 * Keep these in sync with the `@theme` block in `global.css`, which stays the
 * source of truth for anything reachable from a `className`.
 */
export const colors = {
  base: "#0B1120",
  surface: "#131C2E",
  elevated: "#1E293B",
  nav: "#0D1525",
  borderDefault: "#1E293B",
  borderStrong: "#334155",
  accentPrimary: "#A5F2F3",
  accentSecondary: "#7DD3E8",
  onAccent: "#0B1120",
  textPrimary: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textTertiary: "#94A3B8",
  textMuted: "#64748B",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
} as const;

/** The named spacing scale from DESIGN.md, in px. */
export const spacing = { xs: 8, sm: 12, md: 20, lg: 32, xl: 40 } as const;

/**
 * The colour for input placeholders.
 *
 * Not `textMuted`: #64748B on the Fjord Slate input fill measures 3.58:1,
 * which fails WCAG AA for normal-size text — and it was the colour of the one
 * place the required date format appeared. `textTertiary` measures 6.73:1 on
 * the same fill and still reads as a hint rather than as an entered value.
 */
export const PLACEHOLDER_COLOR = colors.textTertiary;

/** Horizontal page margin (DESIGN.md Layout: 24px, `px-6`). */
export const PAGE_GUTTER = 24;

/**
 * Android's minimum touch target, in dp.
 *
 * A literal, and applied through `style`, because the class that meant to do
 * this could not: `min-h-12` is 3rem, and the native CSS compiler resolves
 * 1rem to 14, so it delivered 42dp while reading as 48 in the source. Measured
 * on device at font_scale 1.0, every control on the onboarding form came out
 * 42.8dp — inputs, chips and the primary action alike — against Material's
 * 48×48dp floor. A literal is also immune to the font scale, which is the
 * other thing that moves these heights.
 */
export const TOUCH_TARGET = 48;

/**
 * The press feedback for every control in the app: `active:opacity-70`.
 *
 * A **class**, not a `style` function, and that is not a preference. Measured
 * on device: a `Pressable` given both a `className` and a **function** `style`
 * loses the function entirely — the floating action came out 24dp, the size of
 * its own icon, because its width, height and radius all travelled that way.
 * A plain object `style` survives alongside a `className`; only the callback
 * form is dropped. So the press state, which needs the callback, has to live
 * in the class list, and `react-native-css` supports the `active:` variant on
 * native for exactly this.
 *
 * It is opacity rather than a tonal step because the palette cannot afford
 * one here: Fjord Slate against Elevated Frost measures 1.16:1, the same
 * imperceptible difference that forced the chips' selected state to carry a
 * weight change instead of a fill. Dropping the whole control to 70% moves
 * fill, border and label together, which reads on a dark screen in daylight.
 * A transient press is also outside WCAG's contrast minimums, so nothing has
 * to hold 4.5:1 mid-tap.
 */
export const PRESSED_OPACITY = 0.7;
