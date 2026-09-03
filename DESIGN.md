---
name: Petlife
description: Seguimiento diario y de salud de un perro, con calma funcional y precisión nórdica.
colors:
  base: "#0b1120"
  surface: "#131c2e"
  elevated: "#1e293b"
  nav: "#0d1525"
  border-default: "#1e293b"
  border-strong: "#334155"
  accent-primary: "#a5f2f3"
  accent-secondary: "#7dd3e8"
  on-accent: "#0b1120"
  text-primary: "#f1f5f9"
  text-secondary: "#cbd5e1"
  text-tertiary: "#94a3b8"
  text-muted: "#64748b"
  success: "#22c55e"
  warning: "#f59e0b"
  error: "#ef4444"
  info: "#3b82f6"
typography:
  display:
    fontFamily: "Outfit_700Bold, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Outfit_700Bold, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Outfit_500Medium, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Outfit_500Medium, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Outfit_600SemiBold, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  md: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-selector:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 0"
  chip-selector-active:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 0"
---

# Design System: Petlife

## Overview

**Creative North Star: "Nordic Ice"**

Petlife runs dark-mode-only, deep navy fading toward black, cut through by a single ice-blue accent used sparingly. The personality is cold, precise, and minimal: no shadows, no gradients, no decoration that isn't load-bearing. Every screen so far is a plain vertical stack — a title, a short set of fields, one primary action — because the product's own principle is low-friction retrospective logging, not a showcase interface. Depth comes entirely from tone (four fixed surface steps, darkest to lightest), never from a shadow.

Within that cold restraint, interactive elements are tactile and confident rather than timid: a filled ice-blue button, a visibly elevated selected state on chips, a full-width primary action that's unmissable. The coldness is in the palette and the absence of ornament; the confidence is in how directly each control commits to its state.

**Key Characteristics:**
- Dark-mode-only, one accent hue (ice blue), used almost exclusively on primary actions and active states.
- Flat by construction — tonal layering substitutes for shadows everywhere.
- One typeface (Outfit) carries every role; hierarchy is built from weight and size, never a second font.
- One corner radius (12px) on every interactive control, no exceptions yet.
- **Resolved:** Nordic Ice governs every platform as one uniform system — it is adapted to each platform's physical constraints (safe areas, gesture zones), never replaced by native-per-OS components (SF Symbols, Material 3 widgets) to satisfy strict HIG/Material conformance. Web is the primary adaptation target. Android is the priority platform for native testing/QA only — a testing-order fact, not a visual-system decision.

## Colors

Almost monochrome by design — a deep navy neutral scale carries nearly the whole interface, with one accent hue reserved for commitment (primary actions, the active tab, a selected choice).

### Primary
- **Ice Blue Glacial** (#A5F2F3): the app's only strong color. Fills the primary button, marks the active tab, and outlines a selected chip. Reserved for "this is the one thing to do here" — it never appears as decoration.

### Secondary
- **Aqua Glaciar** (#7DD3E8): one step cooler/deeper than the primary accent. Defined as the token for a secondary emphasis level; not yet used in the implemented screens — reserve it for a second interactive accent (e.g. a link or a lower-emphasis highlighted state) rather than introducing a new hue.

### Neutral
- **Polar Night** (#0B1120): the base page background — the deepest layer everything else sits on.
- **Deep Ice** (#0D1525): the tab bar background, a distinct near-black plane separate from the page.
- **Fjord Slate** (#131C2E): surfaces that hold content — text inputs, unselected chips.
- **Elevated Frost** (#1E293B): one step up from surface — the selected/active state of a chip.
- **Hairline Frost** (#1E293B): the default 1px border on inputs and unselected chips (same value as Elevated Frost, distinct role — resting border, not a fill).
- **Steel Frost** (#334155): a stronger 1px border, used for secondary/ghost buttons where a plain hairline would be too quiet.
- **Snow White** (#F1F5F9) / **Frost Grey** (#CBD5E1) / **Mist Grey** (#94A3B8) / **Slate Mist** (#64748B): the text scale, in descending emphasis — primary reading text, secondary/body text, tertiary labels and hints, and muted/placeholder text.
- **Status colors** (functional, not decorative — used for state communication only): Success Green (#22C55E), Warning Amber (#F59E0B), Error Red (#EF4444, the only one in active use today, for inline error text), Info Blue (#3B82F6).

### Named Rules
**The One Accent Rule.** Ice Blue Glacial is the only color that means "act here." It appears on the primary button, the active tab, and a selected chip's border — nowhere else. Diluting it into a general-purpose brand color would cost it its signal.

**The Text-On-Accent Rule.** Any text placed on an Ice Blue Glacial surface uses `on-accent` (#0B1120), never `text-base` — `text-base` is Tailwind's font-size utility, not a color, and silently fails to apply one.

## Typography

**Display / Body / Label Font:** Outfit (with `system-ui` fallback)

**Character:** One geometric sans family carries the entire app. There is no second typeface anywhere — hierarchy is built entirely from weight (500 / 600 / 700) and size, which keeps the cold, precise tone from Overview consistent down to the smallest label.

### Hierarchy
- **Display** (700, 2.25rem/36px, line-height 1.15): the single largest text in the app — the "Petlife" wordmark on the login screen.
- **Headline** (700, 1.875rem/30px, line-height 1.2): a screen's primary question or title (e.g. the onboarding prompt).
- **Title** (500, 1.5rem/24px, line-height 1.3): tab-screen headers ("Hoy", "Salud", "Perfil") — deliberately Medium weight, not Bold; a title is a location marker, not an announcement.
- **Body** (500, 1rem/16px, line-height 1.5): standard reading text, subtitles, secondary/ghost button labels.
- **Label** (600, 0.75rem/12px, uppercase, +0.05em tracking): field labels above form inputs.

### Named Rules
**The One Family Rule.** Outfit is the only typeface. If a future screen ever needs a visually distinct moment (a stat, a number), reach for a heavier Outfit weight or a larger size before considering a second family.

## Layout

Single-column, mobile-first. Screens are a plain vertical stack (`View`/`ScrollView`) — no grid system exists yet because nothing built so far needs one. Page margins run 24px (`px-6`) on the sides; interactive elements carry generous internal padding (12–16px vertical).

Vertical rhythm is stepped by margin-bottom: 8px between a label and its field, 20px between fields, 32–40px between major sections (e.g. the login title block, or the gap before a screen's primary action). Grouped choices (the sex selector, the activity-level selector) sit in a `flex-row` with a fixed 12px gap, each option taking equal width (`flex-1`).

## Elevation & Depth

Flat by construction — no shadow appears anywhere in the implementation. Depth is conveyed entirely through four fixed tonal steps, from the deepest background to the most raised surface: **Polar Night** (page) → **Deep Ice** (tab bar, its own distinct plane) → **Fjord Slate** (content surfaces: inputs, resting chips) → **Elevated Frost** (a chip's selected state). Nothing sits above Elevated Frost yet.

### Named Rules
**The Flat-By-Default Rule.** No drop shadows, no glassmorphism, no blur. If a future component needs to signal "raised," it moves up one tonal step — it does not reach for a shadow.

## Shapes

One radius, everywhere: 12px (`rounded-xl`) on every button, input, and chip in the implemented screens — no smaller or larger radius appears anywhere. Borders are always 1px hairlines; there is no thicker border weight. No fully-rounded (pill) or sharp-cornered shapes exist yet.

### Named Rules
**The One Radius Rule.** 12px is the only corner radius in the system. A new component should default to it rather than picking a fresh value.

## Components

### Buttons
- **Shape:** 12px radius (`rounded-xl`), full-width, centered content.
- **Primary:** Ice Blue Glacial fill, `on-accent` text, 600 weight, 16px vertical padding. While busy, the label is replaced entirely by a centered `on-accent`-colored spinner — not a spinner-plus-label combination.
- **Secondary / Ghost:** transparent fill, Steel Frost 1px border, `text-secondary` label, 12px vertical / 24px horizontal padding. Used for lower-emphasis actions (retry, sign out) — never the primary action on a screen.
- **Hover / Focus:** not yet defined. This is a native app (no `:hover`); a pressed/focus treatment (e.g. a brief opacity or scale change) has not been implemented on any button yet and should be resolved deliberately, not left implicit, the first time it matters for a real interaction.

### Chips (selector chips)
Used as an exclusive single-select control within a small fixed set (e.g. sex: 2 options; activity level: 3 options) — closer to a segmented control than a tag.
- **Unselected:** Fjord Slate fill, Hairline Frost 1px border, `text-primary` label.
- **Selected:** Elevated Frost fill, Ice Blue Glacial 1px border, `text-primary` label.
- **Layout:** equal-width (`flex-1`) siblings in a row, 12px gap, 12px radius, centered label.

### Inputs / Fields
- **Style:** Fjord Slate fill, Hairline Frost 1px border, 12px radius, 16px horizontal / 12px vertical padding, `text-primary` value text, `text-muted` placeholder.
- **Focus:** not yet defined — no distinct focus treatment exists apart from the resting style.
- **Error / Disabled:** not yet field-level. Errors currently surface as a separate error-red text block below the group of fields, not as an inline per-field state — a future form with several fields at once will need to decide whether that stays true or whether inputs get their own error border/text.

### Navigation
Bottom tab bar, 3 destinations (Hoy / Salud / Perfil), text-only (no icons implemented yet). Deep Ice background, Hairline Frost top border, active label in Ice Blue Glacial, inactive label in Slate Mist.

## Do's and Don'ts

### Do:
- **Do** use the single 12px radius (`rounded-xl`) on every new interactive control — inputs, buttons, chips alike.
- **Do** express state (selected, active) through a tonal step (Elevated Frost) and the accent border, never a shadow.
- **Do** keep Outfit as the only typeface; differentiate by weight and size.
- **Do** use `text-on-accent` for any text on an Ice Blue Glacial surface — never `text-base`, which is Tailwind's font-size utility, not a color, and silently produces no text color at all.
- **Do** resolve every color through a Nordic Ice token; a raw hex value in a component `className` is a defect, not a shortcut (enforced in `AGENTS.md`).

### Don't:
- **Don't** add drop shadows, glassmorphism, or blur — depth here is tonal, never shadow-based.
- **Don't** introduce a second accent hue outside Ice Blue Glacial / Aqua Glaciar; the accent family is deliberately narrow so it keeps its meaning.
- **Don't** communicate success/error/selected state by color alone — pair it with a label or icon (no case of this exists yet, but the system has no color-blind-safe fallback built in and shouldn't ship one that relies on hue alone).
- **Don't** reach for platform-native components (SF Symbols pickers, Material FABs, iOS grouped lists) to satisfy per-OS conformance — Nordic Ice is deliberately one uniform world across iOS, Android, and web. Adapt it to a platform's physical constraints; don't replace it with that platform's native kit.
