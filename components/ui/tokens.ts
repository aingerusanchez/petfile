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
