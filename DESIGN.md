---
name: Petfile
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
  sm: "6px"
  md: "12px"
  full: "9999px"
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
  button-primary-disabled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.accent-secondary}"
    padding: "12px 0"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-selector:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-selector-active:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  checkbox:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    size: "24px"
  button-primary-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  button-outlined-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  fab:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    size: "56px"
  avatar:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    size: "96px"
  slider-thumb:
    backgroundColor: "{colors.accent-primary}"
    rounded: "{rounded.full}"
    size: "20px"
  slider-track:
    backgroundColor: "{colors.border-strong}"
    rounded: "{rounded.md}"
    height: "4px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "20px"
  checkbox-checked:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    size: "24px"
---

# Design System: Petfile

## Overview

**Creative North Star: "Nordic Ice"**

Petfile runs dark-mode-only, deep navy fading toward black, cut through by a single ice-blue accent used sparingly. The personality is cold, precise, and minimal: no shadows, no gradients, no decoration that isn't load-bearing. Every screen so far is a plain vertical stack — a title, a short set of fields, one primary action — because the product's own principle is low-friction retrospective logging, not a showcase interface. Depth comes entirely from tone (four fixed surface steps, darkest to lightest), never from a shadow.

Within that cold restraint, interactive elements are tactile and confident rather than timid: a filled ice-blue button, a visibly elevated selected state on chips, a full-width primary action that's unmissable. The coldness is in the palette and the absence of ornament; the confidence is in how directly each control commits to its state.

**Key Characteristics:**

- Dark-mode-only, one accent hue (ice blue), used almost exclusively on primary actions and active states.
- Flat by construction — tonal layering substitutes for shadows everywhere.
- One typeface (Outfit) carries every role; hierarchy is built from weight and size, never a second font.
- One corner radius (12px) on every interactive control, no exceptions yet.
- Nordic Ice governs every platform as one uniform system — it is adapted to each platform's physical constraints (safe areas, gesture zones), never replaced by native-per-OS components (SF Symbols, Material 3 widgets) to satisfy strict HIG/Material conformance. **Android is the primary adaptation target:** the app ships to and is used on Android, so the insets that shape layout are Android's (status bar, system navigation bar or gesture inset, back-gesture edges, and the Android density range). The browser is the development and review harness and a secondary export — a screen that looks right at a desktop width is not yet verified; Android is where it has to hold.

## Colors

Almost monochrome by design — a deep navy neutral scale carries nearly the whole interface, with one accent hue reserved for commitment (primary actions, the active tab, a selected choice).

### Primary

- **Ice Blue Glacial** (#A5F2F3): the app's only strong color. Fills the primary button, marks the active tab, and outlines a selected chip. Reserved for "this is the one thing to do here" — it never appears as decoration.

### Secondary

- **Aqua Glaciar** (#7DD3E8): one step cooler/deeper than the primary accent, and the second interactive accent this token was reserved for from the start. It carries the link (tertiary) button and nothing else yet — 11.08:1 on Polar Night. Its whole job is to read as interactive _without_ claiming the primary action's meaning; keep it out of anything that competes with Ice Blue Glacial.

### Neutral

- **Polar Night** (#0B1120): the base page background — the deepest layer everything else sits on.
- **Deep Ice** (#0D1525): the tab bar background, a distinct near-black plane separate from the page.
- **Fjord Slate** (#131C2E): surfaces that hold content — text inputs, unselected chips.
- **Elevated Frost** (#1E293B): one step up from surface — the selected/active state of a chip.
- **Hairline Frost** (#1E293B): the default 1px border on inputs and unselected chips (same value as Elevated Frost, distinct role — resting border, not a fill).
- **Steel Frost** (#334155): a stronger 1px border, used for secondary/ghost buttons where a plain hairline would be too quiet.
- **Snow White** (#F1F5F9) / **Frost Grey** (#CBD5E1) / **Mist Grey** (#94A3B8) / **Slate Mist** (#64748B): the text scale, in descending emphasis — primary reading text, secondary/body text, tertiary labels and hints, and muted/placeholder text.
- **Status colors** (functional, not decorative — used for state communication only): Success Green (#22C55E), Warning Amber (#F59E0B), Error Red (#EF4444), Info Blue (#3B82F6). **Success Green marks a moment, never a state.** It is the confirmation toast and the confetti — things that happen and go. It held the day view's goal bar for one build and was taken back off it: a bar that stays green all evening, and a calendar showing eighteen green days a month, make the friendly colour the app's background texture instead of its punctuation.

### Named Rules

**The One Accent Rule.** Ice Blue Glacial is the only color that means "act here." It appears on the primary button, the active tab, and a selected chip's border — nowhere else. Diluting it into a general-purpose brand color would cost it its signal.

**The Red-Means-Consequence Rule.** Error Red carries three things and nothing else: something went wrong in the app, something went wrong with the **animal**, or something is about to be destroyed. It is never an invitation — a destructive control wears it precisely so it reads as a warning rather than as the next step — and the accent never dresses a destructive action, because "act here" and "this cannot be undone" are opposite messages. The animal clause is the calendar's incident mark, and it is the honest extension rather than a loophole: a tutor scanning a month for trouble should find red, and the alternative was a fourth alarm colour nobody could learn.

**The Shared Mark Rule.** A mark that stands for a record wears the colour of that record wherever it appears, and the state it names is called the same thing on every surface. An incident is Error Red in the calendar's corner dot and on the log's row icon; a goal met is Aqua Glaciar in the day's bar and in the calendar's miniature of it, and both say "Objetivo conseguido". The rule exists because the two surfaces are two taps apart: a mark whose colour changes on the way is not a summary of the record, it is a second thing to learn. **A new surface adopts the vocabulary; it does not invent one.**

**The Frequency-Before-Hue Rule.** Before choosing a mark's colour, count how many days a month wear it. A hue on a rare event is punctuation; the same hue on a common one is the surface's background, and the palette has been widened for nothing. The two rare marks are alarms and get Error Red and Warning Amber; the common one is the goal, which is why it gets the quiet half of the accent family and never Success Green — eighteen green days a month is a green calendar.

**The Text-On-Accent Rule.** Any text placed on an Ice Blue Glacial surface uses `on-accent` (#0B1120), never `text-base` — `text-base` is Tailwind's font-size utility, not a color, and silently fails to apply one.

## Typography

**Display / Body / Label Font:** Outfit (with `system-ui` fallback)

**Character:** One geometric sans family carries the entire app. There is no second typeface anywhere — hierarchy is built entirely from weight (500 / 600 / 700) and size, which keeps the cold, precise tone from Overview consistent down to the smallest label.

### Hierarchy

- **Display** (700, 2.25rem/36px, line-height 1.15): the single largest text in the app — the "Petfile" wordmark on the login screen.
- **Headline** (700, 1.875rem/30px, line-height 1.2): a screen's primary question or title (e.g. the onboarding prompt).
- **Title** (500, 1.5rem/24px, line-height 1.3): tab-screen headers ("Hoy", "Salud", "Perfil") — deliberately Medium weight, not Bold; a title is a location marker, not an announcement.
- **Body** (500, 1rem/16px, line-height 1.5): standard reading text, subtitles, secondary/ghost button labels.
- **Label** (600, 0.75rem/12px, uppercase, +0.05em tracking): field labels above form inputs.

### Named Rules

**The One Family Rule.** Outfit is the only typeface. If a future screen ever needs a visually distinct moment (a stat, a number), reach for a heavier Outfit weight or a larger size before considering a second family.

**The family is applied, never inherited.** A rule that depends on every call site restating it is not a rule, and this one broke exactly that way: on the web, `global.css` makes Outfit the default with a `[dir="auto"]` rule, which works because react-native-web stamps that attribute on every rendered `<Text>`. Native has no such hook — the CSS compiler supports class selectors and drops universal and type selectors — so on Android a bare `<Text>` inherited nothing and rendered in **Roboto**, while headings, which name `font-bold` explicitly, stayed in Outfit. Measured on device: the whole form was the platform's face, the title was ours. The family is therefore applied once, in `components/ui/Text.tsx`, and **app code imports `Text` from the design system, never from `react-native`**. Components that render text through a third party (the date picker's own labels) pass `font-sans` in the classNames they hand it.

## Layout

Single-column, mobile-first. Screens are a plain vertical stack (`View`/`ScrollView`) — no grid system exists yet because nothing built so far needs one. Page margins run 24px (`px-6`) on the sides; interactive elements carry generous internal padding (12–16px vertical).

Vertical rhythm is stepped by margin-bottom: 8px between a label and its field, 20px between fields, 32–40px between major sections (e.g. the login title block, or the gap before a screen's primary action). Grouped choices (the sex selector, the activity-level selector) sit in a `flex-row` with a fixed 12px gap, each option taking equal width (`flex-1`).

### Named Rules

**Every touch target is at least 48dp, and the 48 is a literal.** Android's floor, and the app was missing it everywhere: measured on device at `font_scale 1.0`, every control on the onboarding form came out **42.8dp** — inputs, chips, the date display — with the checkbox rows at 44.9 and the primary action at 45.8. The cause is not carelessness but the `rem` note below: the code already said `min-h-12`, which is 3rem, and native resolves 1rem to 14, so the class that meant 48 delivered 42. The floor therefore comes from `TOUCH_TARGET` in `tokens.ts` through a **plain object** `style` prop, which no rem and no font scale can move.

**Plain object, and that word is the whole finding.** The floor was written as a `style` **callback** — `(state) => [{ minHeight: TOUCH_TARGET }, pressed(state)]` — so that one prop could carry both the height and the press feedback. Measured on device: a component given both a `className` and a callback `style` **loses the callback entirely**. The floating action came out 24×24dp, the size of its own icon, because its width, height and radius all travelled that way; `Cerrar sesión` sat at 36.3dp and the sheet's `Cancelar` at 39.1dp, both asking for 48 in code; and the app-wide press feedback did not exist on the device at all. Eighteen sites, and every one of them was right in the browser, which honours the callback — so the e2e suite's own 48dp test passed throughout. After the fix, measured on the same device: the floating action 56×56, every chip, button, input and pill 48.0. The checkbox derives its padding from it instead — `(48 − 24) / 2` — so its row is exactly one target tall and the box is centred by construction rather than by a minHeight leaving slack.

Two things the floor cannot cover, both recorded rather than hidden. A `TextInput` needs `textAlignVertical: "center"` alongside it, or Android draws the value from the top of the taller box. And the date picker's **day cells are 44.6dp wide** (48 tall): seven columns of 48 do not fit a 375dp screen, and Material's own date picker uses 40dp day cells, so the grid is the one place the floor yields to the calendar.

**The screen holds at `font_scale 1.3`**, which is the bar. Verified on device: every control lands at 49dp or above (text drives the height past the floor), the headline wraps to two lines with the emoji still attached, and the whole form remains reachable by scrolling. What broke at that scale was the chip row — see Chips.

**Portrait only, and deliberately.** `app.json` pins `"orientation": "portrait"`. The scene is one hand, standing, just back from a walk or out of the vet's; there is no tablet in a two-tutor household with a phone each. If a tablet or a foldable ever enters, this is the decision to revisit and the work is a restructure, not a stretch: the form in two columns, and the picker sheet sized to the available height.

**The platform-adaptation pass, on hardware (2026-09-10).** The shipped release APK on a 375×817dp phone at 520dpi, at **`font_scale 1.3`** and again squeezed to **361dp** — both axes at once for the tightest case. The diary, the file, Ajustes and all four sheets hold: nothing clipped, nothing overflowed, every control still on the 48dp floor, and "Guardar cambios" still on one line beside "Cancelar" in a bottom sheet at 361dp and 1.3. The harvest was thin because the structural findings had already been fixed — the callback `style` that voided the touch floor, the keyboard over a `Modal`, and the literals that replaced the rem-based classes.

The one thing it did find: **a fixed pixel width was wrong in both directions.** The log's time column was 80dp, chosen for "12:05 p.m."; at `font_scale 1.3` five characters already take 53dp, so 80 left 27dp of slack in 24-hour mode and would have clipped the 12-hour one. It sizes to its content now, which keeps every row in one format aligned, grows with the font scale for free, and costs a character of rag between "9:15 a.m." and "12:05 p.m." — cheaper than a clipped time. **The lesson generalises: a pixel width around text is a guess about a font scale.**

**Open: every number above is web-measured, and the device renders them at 87.5%.** Tailwind's spacing, radius and font-size utilities are `rem`-based, and the native CSS compiler resolves `1rem` to **14** (it follows React Native's default font size) where the browser resolves it to 16. Measured on a 375×817dp device: the group's `px-5` padding lands at 17.5dp instead of 20dp, the 24px checkbox at 21dp, and the chips at ~41dp instead of the 47dp recorded here — further below Android's 48dp touch target than the audit says. `withNativewind`'s `inlineRem` option cannot fix it in this version (the metro wrapper stores compiler options at `config.transformer.reactNativeCSS` while its transformer reads `options.reactNativeCSS`, so they never arrive); expressing the theme's `--spacing`, `--radius-*` and `--text-*` in px would. Touch targets no longer depend on the answer — they are literals now — so what is left open is spacing and radii reading 12.5% tighter on device than this document claims.

An arbitrary value in a class **does** reach native (`min-h-[48px]` compiles to a plain `min-height: 48px` and lands), which is how the date picker's own pressables get the floor through the `classNames` it accepts. That is not a licence to sprinkle arbitrary values: it is the escape hatch for a third party's internals, where a `style` prop cannot reach.

One more thing about the numbers: the device they were taken on runs at **`font_scale` 0.9**, so every text measurement recorded before 2026-09-09 is 10% smaller than a default phone renders it.

A second, sharper case of the same root: **`line-height` from a utility class does not survive at all.** Tailwind emits `calc(var(--spacing) * 6)` for `leading-6`, and the compiler's line-height parser warns and returns nothing for a `calc()`, so every `leading-*` class in the app is inert on device — not scaled, dropped. A literal `leading-[24px]` is dropped too, because the runtime path never receives it. Line height therefore comes from a `style` prop, which is the same rule `tokens.ts` already exists for. **Unresolved — it belongs to the platform-adaptation pass, because closing it moves every dimension on the device at once.**

**The keyboard is a bottom inset, and `Screen` owns it.** Under edge-to-edge Android stops resizing the window when the keyboard opens, so a `ScrollView` keeps its full height and everything behind the keyboard becomes unreachable: measured on device, the breed field's six suggestions opened entirely below the keyboard, with nothing on screen changing to say a list had appeared. `Screen` listens for the keyboard and pads the scroll content by **the larger of the navigation-bar inset and the keyboard height** — never their sum, since the keyboard is measured from the bottom of the screen and already covers that inset. The non-scrolling variant keeps the resting inset, because padding buys nothing where content cannot move.

**A field that opens an overlay list scrolls itself to the top on focus.** Room below is the point, not visibility: the tutor is already looking at the field. This is the one scroll in the app that is unconditional — `scrollToFirstError` deliberately does the opposite and stays put when the field is already on screen.

## Elevation & Depth

Flat by construction — no shadow appears anywhere in the implementation. Depth is conveyed entirely through four fixed tonal steps, from the deepest background to the most raised surface: **Polar Night** (page) → **Deep Ice** (tab bar, its own distinct plane) → **Fjord Slate** (content surfaces: inputs, resting chips) → **Elevated Frost** (a chip's selected state). Nothing sits above Elevated Frost yet.

### Named Rules

**The Flat-By-Default Rule.** No drop shadows, no glassmorphism, no blur. If a future component needs to signal "raised," it moves up one tonal step — it does not reach for a shadow.

**This is a consequence of the palette, not a preference.** It was tested: a black shadow at 25% effective alpha composited over Polar Night yields **1.03:1** — weaker than the _weakest_ tonal step the palette already has (page → surface, 1.11:1). The same shadow on a light ground gives 1.83:1. On a near-black page a shadow has nothing to contrast against, so it costs render work and buys almost nothing. Two shadowed variants of the onboarding form were built and rejected on this evidence; what looked like depth in them was the tonal step doing the work.

**Grouping is the fifth depth role, and it is an outline.** A form section is bounded by a 1px Hairline Frost border (1.29:1 against the page) with 20px padding and the system radius — the `Group` component. It is deliberately _not_ a filled card: the four tones are already spoken for (page, content surface, selected state, tab bar), so a filled grouping card would have to take one of those roles and push every other component's tone down a step. A filled variant was built and it did exactly that, costing the field and chip tones. An outline groups without spending a tone, so nothing else has to move.

## Shapes

One corner radius, everywhere: 12px (`rounded-xl`) on every button, input, chip and panel — no other rounded-rectangle radius appears anywhere. Borders are always 1px hairlines; there is no thicker border weight. No pill or sharp-cornered rectangles exist.

**A circle is a shape, not a radius.** The rule governs the corners of rectangles; a control with no corners has none to govern, and three of them are round — the portrait, the floating action, the slider's thumb.

### Named Rules

**The One Radius Rule.** 12px is the only corner radius in the system. A new **rounded rectangle** defaults to it rather than picking a fresh value.

It read as "one shape" for a while, which is how the avatar and then the floating action each arrived as a squared version of something conventionally round. That was the rule doing bookkeeping instead of design: what it exists to prevent is a system with 8px here and 14px there, and a circle is not a competing radius — it is a different thing. So the rule now says corners, and **a control whose subject or convention is round may be round**: a portrait (the subject is a face), a floating action (a circle over rounded rectangles reads as laid on top, which is what it is), a slider's thumb (it is a thumb). Everything with corners still takes 12px, and nothing invents a third number.

**The one exception is the checkbox**, and it is forced rather than chosen: 12px on a 24px box is a full circle, which reads as a radio button and therefore means the wrong thing. It uses **6px — exactly half the system radius**, proportional to the control instead of a fresh arbitrary value. Any future control small enough to be swallowed by a 12px radius follows the same halving rule, and nothing else invents a number.

## Components

### Buttons

- **Shape:** 12px radius (`rounded-xl`), full-width, centered content.
- **Primary:** Ice Blue Glacial fill, `on-accent` text, 600 weight, 16px vertical padding.
- **The button owns the async feedback cycle**, and this is a foundational commitment rather than a per-screen choice: press → the label is replaced by a centered spinner → a check or an alert icon → back to rest after 1.4s. **The press lock covers the result phase, not just the request**, so the second tap already on its way cannot produce a duplicate write. A handler returns `true` or `false` (or throws, which counts as failure) and the button does the rest, which is what makes duplicate submissions structurally impossible instead of something each caller has to remember.
- **Error state:** the fill becomes Error Red with an alert icon in `on-accent`. Counter-intuitively the dark navy is the readable colour there — #0B1120 on #EF4444 measures 5.00:1 and passes AA, while `text-primary` measures 3.44:1 and fails. The Text-On-Accent Rule extends to status fills.
- **An icon is not a reason**, and that applies to the button itself. The success and error states keep a label beside the glyph (`successLabel` / `errorLabel`), because a red button with a warning icon says something is wrong without saying what. The caller names it, since only the caller knows which failure it was — onboarding distinguishes "Faltan datos por rellenar" from "No se ha podido guardar". Never let a throw escape a handler and leave a red flash as the only explanation either.
- **Motion honours the system "remove animations" setting** via `useReducedMotion()`: the status icon still appears, it just does not zoom in.
- **The label never grows the button.** `numberOfLines={1}`, and the warm call gives way rather than being truncated inside it: a name over 20 characters gets "Añadir mascota" instead of "¡Vamos, Condesa Eufrasia de los Montes Nevados!", which filled the button edge to edge at font_scale 1.0 and would be cut at 1.3. A cut-off name in a recall reads worse than no recall. Emoji in a name are fine — they make the line box taller without wrapping it.
- **Danger is a tone, not a variant.** `tone="danger"` swaps the accent for Error Red on any shape — the link that opens a delete confirmation, the outlined full-width button that carries it, and the filled button inside the dialog are the same decision at three weights. It exists because that confirmation's own button was Ice Blue Glacial, the colour that means "this is the one thing to do here", on the one action in the app that destroys something.
- **Disabled (primary):** the accent fill **goes**, replaced by a Fjord Slate surface **with a Hairline Frost border** and a `text-tertiary` label. It used to be `opacity-50` over the accent, which put the button's own label at **2.21:1** — unreadable — and a half-transparent accent still reads as "the one thing to do here". Losing the fill says the action is not available; the label measures 6.64:1 on that surface. The border is not decoration: inside the delete dialog the panel is Fjord Slate too, so the fill alone was not a shape and the confirm control read as a line of grey text rather than as a button waiting for the name. Two screens disable a button — the profile's save, until the form differs from the stored row, and that confirm, until the name is typed.
- **Secondary / Ghost:** transparent fill, Steel Frost 1px border, `text-secondary` label, 12px vertical / 24px horizontal padding. Used for a real alternative action (retry, sign out) — never the primary action on a screen.
- **Link (tertiary):** no border, no fill, no full-width block. Aqua Glaciar label at 600 weight, optional 16px leading icon, left-aligned and sized to its text, with a 48dp minimum hit area. For an action that must sit _below_ the primary in the reading order rather than compete with it — revealing an optional section, for instance.
  Two full-width buttons stacked read as a pair of peer actions however different their fills are, which is exactly what a skippable disclosure must not look like next to an irreversible commit. Shrinking it to a link is what separates them; distance alone did not.
  **It uses Aqua Glaciar, not Ice Blue Glacial, on purpose.** The primary accent means "this is the one thing to do here" (The One Accent Rule), and a disclosure the tutor may ignore is not that.
- **Pressed:** the whole control drops to **70% opacity** while held, from **`active:opacity-70` in the class list** — one rule for every `Pressable` in the app rather than a per-component decision. It was a `style` callback (`pressed()` in `tokens.ts`) until the device said otherwise: a component given both a `className` and a callback `style` loses the callback on native, so **the press feedback did not exist on the device at all**, and neither did the 48dp floor that travelled beside it. See the Layout notes and AGENTS.md. It is opacity and not a tonal step because the palette cannot afford one here: Fjord Slate against Elevated Frost measures 1.16:1, the same imperceptible difference that forced the chips' selected state to carry a weight change. Dropping fill, border and label together reads on a dark screen in daylight, and a transient press sits outside WCAG's contrast minimums, so nothing has to hold 4.5:1 mid-tap.
- **Focus:** still undefined, and deliberately so — there is no hardware keyboard in the use scene and no `:hover` on a phone. The first surface that can be reached by keyboard (the web export, or a tablet with a case) resolves it.

### Chips (selector chips)

Used as an exclusive single-select control within a small fixed set (e.g. sex: 2 options; activity level: 3 options) — closer to a segmented control than a tag.

- **Unselected:** Fjord Slate fill, Hairline Frost 1px border, `text-primary` label at body weight.
- **Selected:** Elevated Frost fill, Ice Blue Glacial 1px border, `text-primary` label at **700 weight**. The weight change is load-bearing, not decoration: the selected-vs-unselected _fill_ difference measures 1.16:1 and cannot be relied on (see Don'ts).
- **`ChipGroup` renders the field label**, so a call site names the group once instead of passing the same string to a `FieldLabel` beside it and to the group's accessible name — two places to forget, and two chances for them to disagree.
- **Layout:** siblings that **size to their content and share the slack** (`grow shrink-0`) in a **wrapping** row, 12px gap, 12px radius, centered label, 48dp floor. A row is wrapped in `ChipGroup`, which exposes the set as one radio group so the chosen option is announced in context.
- **Why not equal width, which is what this used to say.** Equal `flex-1` chips squeeze the longest label instead of yielding, and at `font_scale 1.3` that broke a word: the three-up activity row rendered "Moderado" as "Moderad / o" inside its own chip. Content-sized chips give that label the width it needs by taking slack from "Bajo" and "Alto" — verified on device, all three back on one line at 1.3 — and if a row ever cannot fit at all it flows onto a second line. The label also carries `numberOfLines={1}`, so a chip can never fragment a word again. Equal widths were the nicer default and are what this trades away; slightly uneven chips read fine, a broken word does not.
- **Optional 16px leading icon**, drawn in `text-primary` when selected and `text-tertiary` at rest, so the icon carries the same selected/unselected signal as the weight change. The sex chips use `Mars` and `Venus` — the icons the old `♂`/`♀` glyphs were reaching for before they fell outside Outfit's charset and silently changed typeface (see The No-Glyph Rule).
- **Size:** 12px vertical padding over a body line box, under a hard 48dp floor from `TOUCH_TARGET`. The 47dp once recorded here was a web measurement; the device rendered 42.8dp until the floor became a literal.

### Group

A hairline-outlined section of a form: 1px Hairline Frost border, 12px radius, 20px padding, `pb-1` at the bottom because form fields carry their own 20px bottom margin and a symmetric padding would visibly deepen the gap at the end of every group. An optional `title` renders in `text-secondary` uppercase — one step brighter than a field label's `text-tertiary`, so a section heading never reads as just another field label.

**Use it for sections that differ in kind, not in priority.** In onboarding every field shown at start sits in a _single_ group, including the skippable breed: they are one set of facts about the animal and should read as equally worth giving. Priority is expressed by what blocks a save and by the `opcional` marker, never by splitting a form into an important box and an unimportant one. The deferrable health and activity fields get their own group because they are a different kind of fact and arrive at a different moment.

### Checkbox

A voluntary boolean flag, **unchecked by default**. Used for a qualifier that only ever gets asserted deliberately — "solo sé el mes y el año", "es mestizo" — where an unchecked box is the honest resting state.

- **Box:** 24px square, 6px radius (the recorded exception in Shapes), 1px border. The row's vertical padding is **derived from the box and the touch target** — `(48 − 24) / 2` — so the row is exactly one target tall and the box is centred without a minHeight leaving slack underneath. Unchecked: Steel Frost border on Fjord Slate. Checked: Ice Blue Glacial fill and border, with an `on-accent` tick.
- **Label:** `text-primary`, stepping to 600 weight when checked — a non-chromatic cue, same principle as the chips.
- **Label alignment:** the box's side and the label's line height are **the same literal number, from one constant in the component**. The row is `items-start` (so the box stays level with the first line when the label wraps or a hint follows), and two boxes of equal height then share a centre. Neither side can be a class here: `h-6` is rem-based, which native resolves to 21 instead of 24, and `leading-6` reaches native as a `calc()`, which the CSS compiler warns on and **discards outright** — measured on device, every `leading-*` class was inert and the label rode 6.5px (2dp) above the box. With both as literals the residual is 2.5px (0.8dp), the font's own ascent/descent asymmetry, which is below perceptibility and not worth a magic offset.
- **Hint:** optional second line, `text-tertiary` at 12px, stating what ticking the box does.
- **Why not a chip pair:** three adjacent Sí/No chip rows looked identical but behaved differently, two of them rendering "No" pre-selected so an assumption was indistinguishable from an answer, with the polarity flipped between them. A checkbox says what a chip pair cannot: this is off unless you turn it on.
- **When a chip row is still right:** `¿Esterilizado?` keeps three chips because "no lo sé" is a real answer for an adopted dog, and a checkbox cannot carry a third state.

### Avatar

The animal's picture, or its initial. **A circle.**

It shipped square first, at the system radius, on two arguments: that a circle would make a second exception to The One Radius Rule, and that the product's thesis is the animal's _file_, where a squared photo reads as a record photo and a circle reads as a social account. Then a real photo of a real dog went into it and the square lost. A dog's head is round, the crop that flatters it is round, and the square framed the animal like an ID document. **The reasoning was sound and the result was wrong** — which is what testing a decision with real content is for, and worth recording as the reason the decision moved rather than quietly restyling it.

- **Frame:** 96dp by default, `elevated` fill, hairline border, fully round, the image cropped to fill.
- **The portrait is how the photo changes, and a camera badge says so.** With an `onPress` it becomes a button and pins a camera to the circle's lower right — a third of the frame, on the diagonal where a notification badge sits, with its own Elevated Frost ground so it survives any photograph. It replaced a word across the foot of the circle: the band read clearly but ate a slice of the one thing the header exists to show, and the obvious way to soften it — revealing it on hover — **does not exist on a phone**, so an affordance that waits for a hover is one that never appears. The badge is a marker, not the control: the whole portrait is the target, and it carries the accessible name.
- **No photo is a finished state, not a gap.** With nothing stored it draws the name's initial in `text-primary` at two-fifths of the frame. Most tutors will never add a photo, and a broken frame, a camera glyph or a nudge charges rent for a decision they already made. The initial is deliberately **not** in the accent: the accent means "act here" (The One Accent Rule), and a portrait is not an action.
- **A photo that will not load falls back to the initial.** The URL is signed for an hour, so a profile left open longer has a dead source — and an `<Image>` whose source 403s renders nothing at all, which reads as a bug rather than as a dog without a photo. The component remembers _which_ URL failed rather than setting a flag, so a replacement photo is not tarred with the old one's failure.
- **The initial is the first grapheme, not the first UTF-16 unit.** `charAt(0)` on "🐶 Loki" is half a surrogate pair and the frame drew a broken glyph. Whatever the tutor put first is the honest initial, emoji included.
- **The image is `accessible={false}`.** The screen already names the animal next to it; announcing "foto de Loki" beside the heading "Loki" says it twice.

### Durations

Anything the app _shows_ as a length of time is written the way a person says it: **"45 min" under an hour, "1h 30m" over it, "5h" when the minutes are zero.** "90 min" is a number the reader has to divide; "1h 30m" is a length they can feel, and the goal bar, the log's entries, the profile's row and both duration fields all speak it. `lib/duration.ts` owns the formatter and the parser, and is unit-tested.

- **Bare digits are still minutes.** "90" has to keep working or the change costs a tutor the habit they already have; hours only appear when the text says so. The parser also takes `1h`, `1h30`, `1h 30m`, `30m`, `45min` and `1:30`, in any casing.
- **A field can give back a form it does not demand.** The walk's duration displays "1h 30m" but keeps the **number pad**: bare minutes always parse, so nothing there needs a letter, and raising the alphabetic keyboard for a digits-first task is the defect AGENTS.md names. The profile's goal is the opposite call — a target set once, where "5h" is the shape a tutor reaches for — so it keeps the default keyboard.
- **A field that reformats its own value normalises on blur, never on keystroke.** A controlled field that reformats as you type fights the typist: "5h" becomes "5 min" halfway through. Both duration fields hold a text buffer while they are being typed into and tidy it when focus leaves.
- **Decimal hours are out.** The comma and the dot disagree across locales, and the field has -15 / +15 for the cases where a tutor is approximating anyway.

### Floating Action

The day view's four kinds of entry, at the corner nearest the thumb.

- **Two taps instead of one, bought deliberately.** They were four buttons across the top of the screen, which is one tap — at the far end of the page from the thumb, and spending the best real estate on the screen on controls rather than on the log it exists to show. A floating action costs a tap and returns both.
- **A 56dp circle.** It was a square at the system radius while the radius rule still read as "one shape"; the rule now governs corners, and a floating action is the clearest case for a round one — a circle over a page of rounded rectangles reads as something laid on top, which is exactly what it is.
- **The nearest action to the thumb is the likeliest one.** Actions are given in order of likelihood — walk first — and the column is reversed on screen, so the reading order a screen reader follows and the reaching order a thumb follows are both right rather than one of them being sacrificed to the other.
- **Four ways out**, the contract the date picker's sheet set: the X, the scrim, Android's Back, and choosing something. The scrim covers the content but **not the tab bar**, which stays live: being one tap from another screen is not something an open menu should take away.
- **The page leaves room for it.** `FAB_CLEARANCE` at the foot of the content, or the last entry of a full day hides under the button that added it.

### Slider

One value along a range, built in-house rather than pulled in: `@react-native-community/slider` is a native module, and it would cost a rebuild and a platform's own look for one control — the system has one radius, one border weight and one accent, and a platform slider honours none of them.

- **The thumb is round**, because a thumb is. The radius rule governs corners.
- **The track is the touch target, not the thumb.** The thumb is 20dp, well under the 48dp floor; the row it sits in is 48dp tall and its whole width responds, so a tap anywhere jumps the value there and no drag is required.
- **The unfilled track is Steel Frost.** The goal bar's trick — the content surface on the page ground — does not transfer: this control sits on a Fjord Slate sheet, where a Fjord Slate track disappeared into the panel. Measured at 1.67:1, above the 1.29:1 the grouping hairline already holds.
- **It is adjustable to a screen reader**, which is why it can sit beside buttons rather than replace them: `role="adjustable"` with increment and decrement actions means TalkBack's volume-style gesture moves it. The web renders the role and **drops `accessibilityValue`**, the same gap that made Checkbox and Button spell out `aria-checked` and `aria-disabled` by hand, so `aria-valuemin`/`max`/`now`/`text` are passed explicitly.

### Avatar Editor

A bottom sheet for framing the animal's photo, opened by the portrait itself.

- **The preview is the mask.** The stage is a circle, not a square with a circle drawn over it: what the tutor drags is what the profile will show, so there is nothing to imagine and nothing to be surprised by. The file written is the circle's bounding square — the crop and the mask are one decision seen twice, which is also why the stage's diameter and the crop's side are the same number.
- **The system cropper is off.** `expo-image-picker` ran with `allowsEditing` and `aspect: [1,1]`, so Android cropped a square before the app saw the image. Cropping twice throws away the pixels framing needs, and the OS's square preview cannot show a round result.
- **Zoom has three controls, and none of them is redundant.** A pinch is the natural gesture but is unreachable with a screen reader and unavailable with a mouse. The slider is the one that _shows_ the range — how far in you can go and where you are in it — and is the fast way across it. The buttons are the precise way, a fixed step each, and the only one a keyboard can reach. All three go through the same `rezoom`, always about the middle of the circle: one rule a tutor can predict rather than three that nearly agree. The factor reads as "1.5×" in a polite live region under the slider, so every control says what it did.
- **The heading is centred**, over the portrait rather than off to its left: the sheet is about one round thing in the middle of it.
- **Repositioning is drag-only**, and that is a known gap rather than an oversight: there are no nudge controls. What makes it acceptable is that the default frame is a centred cover crop, which is a finished result on its own — the gesture improves the framing, it is not the only way to get one.
- **Only a freshly picked photo can be reframed.** What is stored is already the crop at 512px, so reframing it would mean enlarging 512 pixels into a frame that wants more. The sheet says so and offers the picker instead, which is the honest version of the same action.
- **The maths lives in `lib/framing.ts`, not in the component**, and is unit-tested. A wrong crop rectangle does not throw — it quietly cuts the dog's ear off, or asks the native manipulator for a pixel the image does not have, which it rejects outright. Both are arithmetic, and arithmetic can be checked without a screen.

### Record Header & Rows

The profile presents the animal before it offers to change him: a header — photo, name with the sex icon beside it, breed, then age with its life stage — followed by one read-only row per remaining field and an **Editar…** button per block that swaps that block, and only that block, for its fields.

**A block with nothing to present is a button, not a section.** The identity block carries no read-only rows: the header already shows the name, the sex, the breed and the age, so the section under it held one date and a button — a box around a door. It gets its `Group` frame only while it is open.

- **The Present-Before-Edit Rule.** A screen that shows a record shows it; the form goes behind a door. A permanently editable form makes every visit read as data entry, puts a save button on a screen nobody came to save, and gives the most destructive action in the app a permanent seat. The profile carried all three until this pattern replaced it.
- **One block open at a time.** Two open forms mean two dirty states and two save buttons disagreeing about what is unsaved, for no gain — an edit here is one deliberate correction. Opening a block re-reads the stored row, so cancelling and reopening shows the file as it is rather than as it was left.
- **The header is where missing data shows, and it shows as an invitation.** Everything the header presents except the name and the birth date is optional, so a thin file is a real outcome: the initial stands in for the photo (see Avatar) and a single link — "Completa su ficha" — opens the block that fixes the rest. **A missing line is dropped, not captioned:** the breed line said "Aún no sabemos su raza" for a while, which is a hole with a label on it — the age below carries the header on its own, and the link already says what to do. The photo is not counted in that link, because the portrait has a better affordance of its own and the link would open a form without it.
- **An absent value is `text-tertiary`, a present one `text-primary`.** "Sin objetivo" and "No lo sabemos" are answers, but they are not data, and the tone says which is which without spending a word on it.
- **Rows are announced as pairs.** Each label/value row is one `accessible` node reading "Esterilizado: Sí". Left as two nodes, a screen reader walks a list of labels and then a list of answers.
- **The life stage rides along with the age** — `2 años · Adulto`, from `lib/age.ts`. It is the first piece of advice the app can give away from data it already holds. The thresholds are the common veterinary split (6 months, 18 months, 7 years) and deliberately not breed-aware: body size moves the last one hard, and `breed_primary` is free text with no weight band behind it.
- **Delete lives at the bottom of the identity block**, outlined in Error Red across the full width — available, not invited. See The Red-Means-Consequence Rule, and the wording note in PRODUCT.md: what gets deleted is the file, and the copy says so.

### Settings

A stack route, not a fourth tab: the tab bar names the three things the app is _for_, and settings are none of them — they are where you go once and come back from. It opens from the profile, the screen already about the person's own setup.

- **Every option shows its own answer.** A pair labelled "24h / 12h" asks the tutor to imagine the result; the same pair reading **"15:30"** and **"3:30 p.m."** _is_ the result. It is what makes the duration option legible at all — "hours" and "minutes" name nothing on their own. The chips carry an accessible name (`Formato 24 horas`) because a screen reader hearing "15:30" would be told a time, not a choice.
- **The reading side follows the preference; the typing side never does.** Android's number pad cannot express a meridiem, so the two time fields always take 24-hour digits — and the screen says so in one line under the option rather than leaving it to be discovered.
- **A named "Más adelante" block.** Saying which settings are coming is cheaper than a tutor wondering whether the screen is finished, and it is the honest shape of a surface built to grow.
- **The version sits at its foot**, and at the login screen's. See Version.

### Version

The build's version, in `text-muted` — **3.19:1, deliberately below AA**, because it is not content, it is a serial number. It should be findable without competing with anything, and it carries a real accessible name so a reader announces "versión 1.1.0" rather than spelling out a `v`.

It exists because a stale APK and a fresh one looked identical, and an afternoon went into chasing a bug that had already been fixed. Two surfaces: the login screen, the only one a tutor sees before signing in, and the foot of Ajustes, where anyone would go looking.

### Sheet

Every modal surface in the app is one component: a Polar-Night-at-80% scrim, a panel pinned to the bottom at the system radius, and **the keyboard as a bottom inset**.

- **It exists because of the keyboard.** A `Modal` sits outside the tree `Screen` pads, and under Android edge-to-edge the window is not resized when the keyboard opens — so a bottom-anchored panel stayed exactly where it was and the keyboard covered it. Measured on device: with the keyboard up, the walk sheet showed its title and its two field labels, and **the fields, the steppers, the note and Guardar were all behind the keyboard**. All four sheets had it, including the one that asks a tutor to type their dog's name before deleting his file.
- **This is the second place window insets are consumed**, and the reason is the one that put them in `Screen`: it should be one decision, not four. The panel takes the larger of the navigation-bar inset and the keyboard, never their sum, because the keyboard is measured from the bottom of the screen and already covers the bar.
- **Four ways out**, the contract the date picker set: the scrim, Android's Back, the footer's own cancel, and the X where there is one. Nothing in a sheet commits anything by itself.
- **A sheet that carries a consequence changes only its border** — Error Red on the delete confirmation — because the panel's shape and behaviour are not what is different about it.

### Day Navigation & Month Calendar

**Once a year the headline is the animal's, not the day's.** "🎂 Cumpleaños de Loki 🎉" replaces "Hoy" or the weekday, and the line underneath still carries the date — so nothing navigational is lost and the log's own title still says whether this is today. On the day the animal was actually born there is no birthday yet, and it says that instead.

- **The ornament is inside the string, not beside it.** A separate `Cake` icon plus its gap pushed the phrase past the width between the two arrows and broke the exact line it decorated. Two characters inside the text cost almost nothing, and `text-balance` then gets to split the whole phrase evenly instead of leaving one word alone on the second line. `text-balance` is dropped by the native compiler, so the even split is a web nicety and the device takes whatever the line breaker gives — see Avatar Editor for the same trade.
- **Shown, never spoken.** The accessible name is the phrase without the emoji, the split the onboarding headline and the activity hint already make: a reader announcing "tarta de cumpleaños, cara de fiesta" describes the decoration instead of the day.
- **Two lines is the ceiling, and it is measured in pixels.** "Cumpleaños de Silver Odinsonn" is a real name and a real two-liner; a longer one truncates at the end of the second line rather than reaching a third. A character cap was the other option and it is worse — it would cut the same name on a phone where it fitted.

The diary's header stopped being a title. Navigating between days was the one thing the screen could not do, and the date is where a person reaches for it: **‹ · the day, tappable · ›**, keeping the two lines so the rhythm holds. The headline names the day as somebody would say it — "Hoy", "Ayer", then the weekday, because nobody says "anteayer" out loud any more — and the line below carries the date.

- **No future.** The forward step is disabled on today rather than hidden: a control that disappears takes its own explanation with it, and "there is no tomorrow yet" is worth leaving visible.
- **The calendar comes from the top**, not from the thumb. It is the one modal surface in the app that is opened by the header, so it is the one that is not a bottom sheet — it drops out of the date it replaces and goes back up into it. That is what `Sheet`'s `anchor="top"` exists for.
- **The entry sheet says which day it writes to** when that is not today. No validation changed for retroactive logging: every time check compares an instant against the real now, so any hour of a past day is already past and today's future is still refused. What changed is that the form no longer looks identical whichever day it lands on.
- **A past day's empty state cannot say "todavía".** That word assumes the day is still going.
- **On a birthday the empty state says the birthday.** "Loki cumple 2 años", and then "¿Un paseo largo para celebrarlo?" — the emptiest moment of the day is the one worth putting something warm in, and it is free: the copy was already conditional.

**The marks: an alert hue is reserved for what is rare.** Measured against the household's own pattern — about one incident and one medication a month against eleven days short of the goal and eighteen that met it — red and amber are the two rare ones, and the two commonest states differ in **weight alone**. Green is not an alert: it is the everyday reading of a month that went well, and it is the colour the day view already gives that exact state.

| state          | mark                       | colour         | on Fjord Slate |
| -------------- | -------------------------- | -------------- | -------------- |
| Met the goal   | a bar under the number     | Aqua Glaciar   | 10.02:1        |
| Fell short     | the number, no bar         | `text-primary` | 15.54:1        |
| Nothing logged | the number, dimmed         | `text-muted`   | 3.58:1         |
| Medication     | a ring in the corner       | Warning Amber  | 7.93:1         |
| Incident       | a filled dot in the corner | Error Red      | 4.53:1         |
| Birthday       | a cake behind the number   | Steel Frost    | 1.65:1         |

- **Snow White was the first proposal for "fell short" and was measured out of it.** At 15.54:1 it is three and a half times the red alert's 4.53:1 — on the most common state of the month, which would have made failure the loudest mark on the calendar and the alarm the quietest.
- **The bar is the day view's own goal bar, in miniature**, and the pair went round twice. First the calendar drew a day in Aqua Glaciar that the day view then drew in Success Green under the words "Objetivo conseguido" — the only mark already claiming to quote another screen, quoting the wrong half. Matching it in green fixed the quote and broke the calendar: about eighteen days of a month met the goal, so the green stopped being an exception and became the month's ground. **The day view's bar moved instead** — a light neutral while it fills, Aqua Glaciar when it is met — and the mark quotes that. Same element, same colour, same words, and the frequent state is the one that stays quiet.
- **Every mark is its own element, and none of them collapse.** The goal bar and the corner marks are independent, which lets a day say "met the goal _and_ had an incident" — and the two corner marks are independent of each other too, each with its own corner: **medication top-left, an incident top-right.** They used to collapse into the more severe one, on the reasoning that a day has one headline; that quietly threw the medication away on the day it mattered most, the day something also went wrong. Side by side they do not fit — two 6px marks and a gap reach across 15dp of a 44dp cell and land on the round chip's top edge, where an amber ring on Ice Blue Glacial is illegible — and opposite corners cost nothing and add position as a third channel on top of hue and fill.
- **Shape carries the meaning as well as colour**, and the day's accessible name says it in words — "9, objetivo sin cumplir, con incidencia". This would otherwise be the app's first surface communicating by colour alone.
- **Selection is drawn by the cell, not inherited.** A custom `Day` replaces the library's cell content, so its `selected` styling never reaches the number and the chosen day was indistinguishable from any other. Same vocabulary as the chips: the accent fills what is chosen, a hairline marks today when it is not.
- **The two rare kinds wear the calendar's colours in the log.** Nothing tied a red dot on the 9th to the row that put it there: the calendar spoke in dots and rings, the log in glyphs and words, and the goal bar was the only mark the two surfaces shared. A 6px mark cannot carry a glyph, so **colour is the channel that fits** — amber is medication and red is an incident on both surfaces, and the legend's words are the row's own label. A walk and a meal keep the column's tone: they are as common in the log as they are on the calendar, where they get no hue either, and four coloured rows would leave the two that matter competing. The row icon is decorative in the accessibility tree, so no meaning rests on the colour alone.
- **The birthday is the day's ground, not a mark on it.** It shipped as a 10dp cake sharing the strip with the goal bar, and for the one day a year it marks it was the quietest thing on the calendar. **Behind the number it takes nothing**: Steel Frost reads 1.65:1 against the panel, which is a texture rather than a mark, and the number sits 9.45:1 above it. It is the ground for a second reason too — both corners hold things somebody _logged_, and a birthday is not an event, it is what the date is.
- **22dp, so it fits inside today's ring rather than across it.** At 30 the cake and the ring were the same size and concentric, and the hairline circle cut straight through the cake's plate: on the one day a year both apply, the cell was a scribble. The ring's inner diameter is 26, so 22 clears it on every side and the day reads as both — a cake in a circle, which is what a badge looks like anyway. Dropping the ring on that day was the other option and it was worse: it is the only thing that says which cell is today.
- **A birthday's number is drawn bright whether or not anything was logged.** Dimmed over the watermark, Mist Grey and Steel Frost sit 2.18:1 apart and the number is the thing that loses. One day a year borrows the emphasis, and the watermark underneath says why.
- **The selected day covers its own cake**, because the accent fill is opaque and the watermark is drawn under it. That is the one day the header is already saying "Cumpleaños de Loki" in words a centimetre above, so nothing is actually lost — and the alternative, a watermark on top of Ice Blue Glacial, is two light tones fighting.
- **No new hue for it.** The palette has none left that is neither an alarm nor an instruction, and by The Frequency-Before-Hue Rule the birthday could afford the loudest mark on the calendar — once a year against the goal's eighteen days a month. It does not need one: a cake is a shape nothing else here resembles, so the colour has nothing to carry.
- **A birthday still in the future is drawn, and that is the feature.** The month renders days the calendar will not let you select, so the cake appears on the 14th when today is the 11th. It was asked for as a reminder, and a reminder that only arrives on the day is a poor one.
- **The cake is the one mark left out of the legend.** It explains itself, and the header names it in words the moment you land on the day — where the other three marks have nothing but their shape.
- **The legend names the mark, not the rule.** It carried the threshold — "Cumplió 1h" — on the argument that the bar is measured against the _current_ goal and an invisible rule cannot be trusted. But the goal is already on the screen underneath, spelled out over the day's own bar, so a legend restating it was answering a question nobody asks of a legend. Three marks, three names: "Objetivo conseguido", "Medicación", "Incidencia".
- **Every mark is sized in arbitrary pixels**, never rem: `h-7` is 24.5dp on the device against 28 in the browser, and `rounded-full` compiles to a `calc()` the native compiler discards, which would leave the selected day a square.
- **The selected day's chip grows with the number, and the number is capped.** Fixed at 28dp square it held "10" flush against the circle at font_scale 1.5 — measured on the device — and would have clipped above it. So 28 is a floor with padding around the digits. The cap (1.5) is there because the library lays the month out on a fixed row height: past a point the numbers stop fitting the grid however this component draws them, and capping is more honest than clipping. The marks themselves do **not** scale — they are indicators, not text, and the row they sit in cannot grow.

- **"Hoy" sits in the corner the legend does not reach.** The arrows are bad at exactly one thing — walking home from three weeks back — and the calendar is where somebody ends up after going looking. It is a hairline pill in the chip's own vocabulary rather than a bare word, because a word beside three labels reads as a fourth label; it lives in its own column so the legend can wrap under a large font without ever running into it; and on today it stays visible and inert rather than vanishing, which is the call the forward arrow already makes in the header.

### Day Log & Entry Sheet

The diary: the day's heading, the exercise goal, the four kinds each one tap away, and the entries.

- **The log reads forwards**, earliest first. Newest-first is the right order for a feed a reader dips into; this is a diary, bounded by one day, short, and read whole.
- **The goal bar fills in a light neutral and turns Aqua Glaciar when the goal is met.** Three versions got here. Steel Frost was first, on the argument that progress is state rather than an action and the accent means "act here" — but a 4px hairline in a border colour measures 1.64:1 against its own track and did not read as a measure of anything. Then Aqua Glaciar filling and Success Green on completion, which read well on this screen and put green on most days of the calendar's miniature of it. **The two states are now the same weight and differ only in hue** — Mist Light 11.48:1 and Aqua Glaciar 10.03:1 on the bar's Fjord Slate track — which is the whole message: the measure is neutral while it is being read, the secondary accent is the conclusion. **Ice Blue Glacial still means "this is the one thing to do here"**: the primary accent stays on the actions, and nothing on this screen competes with them.
- **A walk is asked for as a range; every other kind as a moment.** DESDE and HASTA, side by side, and DURACIÓN below them. A tutor knows when they left and when they got back, not how many minutes that was — the arithmetic was the app's job all along and it was being handed to them.
- **The prefilled time is HASTA, because that is the one the tutor is standing in.** Logging is retrospective: the entry happens after getting home, so "now" is when the walk _ended_. The first version prefilled DESDE and was quietly asking the tutor to correct the only field it had filled in.
- **DESDE and HASTA are the facts; DURACIÓN is derived.** Editing either time recomputes the duration. The duration stays editable, because "we were out about forty minutes" is a real way to remember a walk — and **it counts backwards from HASTA**, moving DESDE. That is the mirror of the rule it replaced and follows from the same premise: the field the tutor is sure of must never shift under them, and that is the end.
- **A walk can be an end plus a length.** Nothing but HASTA is proposed — a prefilled thirty minutes would be a fabricated walk one careless tap away — and with DESDE empty `occurred_at` takes the end. What is new is that the **duration survives an empty DESDE**: "we got home at nine and were out about forty-five minutes" is a complete fact, `pet_events.duration_minutes` is a real column rather than a reading of the two times, and the sheet used to throw that number away the moment the start went missing.
- **A DESDE that does not parse keeps the duration.** Same rule the duration field already applies to itself — not a time _yet_ is mid-typing, not an error — and it is the only rule that survives a real keyboard: deleting "10:48" on Android fires one change per key, so the field passes through "10:" and "1", and clearing on each of those wiped a duration the final empty string was then careful to preserve. The web hid it completely, because `fill("")` is a single event.
- **That is also what fixed the walk that reaches back past midnight.** DESDE holds a time of day with no date, so a start computed on the previous day came back — re-parsed against the day on screen — as that clock time _after_ the end. Stepping a walk that ended at 00:20 up to 45 minutes showed "23:35" in DESDE, then emptied its own duration on blur and blamed DESDE on save. Now the computed start is simply not written when it leaves the day (`startWithinDay` in `lib/events.ts`, unit-tested at the boundary), the duration stands on its own, and the entry lands on the day on screen. **A start the tutor _typed_ after its end is still refused** — that is the next bullet, and a different decision: a mistyped digit is likelier than a walk across midnight, and guessing would file the entry under a day nobody chose.
- **A time is typed without its colon, and gains one on blur.** Android's number pad offers digits and nothing else, so `900` and `0900` are first-class input and the last two digits are always the minutes. A live mask that inserted the colon as the digits arrived was built and removed: a focused `TextInput` on Android ignores a value JS rewrites, so `9000` stayed `9000` on the device while the browser showed `90:00`. Blur is the correction the platform honours — and dismissing the keyboard with Back is not a blur, so it lands when another field takes focus.
- **A duration longer than a day is refused at the field, not on save.** Counting back from HASTA would put DESDE on a previous day and draw it as an ordinary time, so the entry would look unremarkable and be nonsense; the data layer would then reject it into a toast, which is the wrong place for a message about one field. Nothing moves, the field says "Como mucho 24 horas", and blurring discards the refused value because the two times are the truth. `+15` stops at the ceiling for the same reason.
- **A start after its end is refused, not interpreted.** A walk past midnight is possible and a mistyped digit is likelier, and guessing would file the entry under a day the tutor did not choose.
- **The duration also has -15 / +15, hard right.** The fastest walk to log is the one with nothing to say about it: tap Paseo, tap +15 three times, save. They count back from HASTA exactly as typing a duration does, so the rule above holds whichever control moves. `-15` is disabled at or below fifteen minutes rather than clamping to zero, because a zero-minute walk is not a shorter walk. The steppers sit at the sheet's right edge, nearest the thumb, and the field takes only the width its value needs — they used to sit beside it, close enough that the unit landed underneath them.
- **Every entry carries its kind as an icon**, under the time, in the same tone as the time and the same glyph the action that created it used. Four kinds in one column read as one undifferentiated list when only a word separates them, and this screen is built for a glance. The icon is decoration in the accessibility tree — the label already names the kind — so it is not carrying meaning alone.
- **The row is the way back in, and delete lives inside the sheet it opens.** Tapping an entry reopens the form it was created from, prefilled, headed "Editar comida"; the button still says "Guardar cambios", because a control labelled "Editar" describes the sheet rather than the press. A delete affordance in the list is a mis-tap waiting for a scroll, so it sits at the foot of the sheet and asks once **in place** — a modal on top of a modal is worse on Android than the question it would ask.

### Date Field & Picker

A value display that opens a picker. **No text input** — the field previously demanded `AAAA-MM-DD` from a reader who writes DD/MM/AAAA, with no `keyboardType`, so Android raised the alphabetic keyboard for a digits-only task.

- **Display:** Fjord Slate fill, hairline border, 12px radius, calendar icon suffix in `text-tertiary`. Empty shows `DD/MM/AAAA`, or "Mes y año" in approximate mode.
- **Sheet:** bottom sheet on an 80%-opacity Polar Night scrim, with a title, an X, and a Cancelar / Confirmar pair in the footer. **Four ways out without saving** — the X, Cancelar, a scrim tap, and Android's system Back. Nothing commits until Confirmar.
- **Exact mode is `react-native-ui-datepicker`**, themed entirely through its `classNames` prop with Nordic Ice utilities. Chosen because it is pure JS (identical on web and Android, unlike `@expo/ui`'s DateTimePicker, which returns `null` on web and would silently render nothing during development), it carries its own accessibility (every day cell is a `button` with the day number as its accessible name), and `locale="es"` gives Spanish month and weekday names. `maxDate` disables future days in the UI, not just in validation. Its defaults reference `text-foreground` and `bg-accent`, classes this project does not define, so **every visible key is set rather than merged over `useDefaultClassNames()`** — a partial override renders invisible text.
- **Approximate mode is a month-and-year selector, not a calendar**: a horizontally scrolling year strip and a 12-cell month grid, both built from the system's own `Chip`. The library cannot express this mode — its `onSelectMonth` ends in `setCalendarView('day')`, and overriding `components.Month` does not help because the library wraps the override in its own Pressable calling that same handler, so a tap still falls through to the day grid. Defeating that with a remount would be a hack one upgrade away from breaking; a month/year selector is simply a different control from a date picker, and no library ships one.
- **Display honesty:** an approximate date renders as "Septiembre de 2025", never "01/09/2025" — a placeholder day is not shown as fact. The sheet previews the same string before the tutor commits.
- **The library's own pressables get the floor through its `classNames`.** Measured on device, the month arrows were **27×24dp** — barely half the minimum, and they are how you change month — and the month/year selectors 26.8dp tall. `button_prev`, `button_next`, `month_selector` and `year_selector` now carry `min-h-[48px]` (an arbitrary value, because a `style` prop cannot reach inside a third party), and `day` carries it too, which takes the day cells to 48dp tall. Their width stays 44.6dp: see the day-cell exception under Layout.
- **Capitalisation:** month names are capitalised at the source in `lib/dates.ts`; the library's own header caption comes from dayjs in lowercase and is corrected with a `capitalize` class on `month_selector_label`.

### Breed Combobox

Suggests from a curated list, accepts anything typed.

- **Input:** the standard field style, `autoCapitalize="words"`, autocorrect off (a breed is a proper noun and autocorrect mangles them).
- **Suggestions:** up to 6, in an Elevated Frost panel below the field, hairline-divided, prefix matches before substring matches, accent- and case-insensitive so "pastor aleman" finds "Pastor Alemán".
- **Suggestions appear from the third letter.** Waiting for a whole word before showing anything is what made the field read as having no autocomplete at all.
- **"Mestizo" is an answer to the breed question, not a breed** — and the checkbox and the field are two faces of one fact. Ticking "Es mestizo" writes the word into the breed field; typing it ticks the box; unticking takes it away. Whichever control the tutor reaches for, the screen ends in one state they can see.

  This replaced three paths for the same fact — a checkbox, free text, and a suggestion row that offered to translate between them — which is one path too many even when each behaves correctly. The word is still never stored: the boundary in `lib/pets.ts` recognises it, sets `is_mixed` and stores no breed, so "Mestizo" is a thing the screen says and never a thing the record claims. It reads back the same way, so nothing is lost.

  **Open, deliberately.** Naming the halves of a cross is real data and a worse thing to ask for at registration, so the second breed left the form and `breed_secondary` stays in the schema, unwritten, until the profile's edit surface exists. The shape parked for that surface is one question with three answers — _Sé su raza_ / _Es una mezcla_ / _No lo sé_ — which collapses the two controls into one instead of keeping them in sync.

- **Free text is still valid.** Regional names and breeds outside the list are real answers; the list makes the canonical spelling easy, it does not constrain.
- **When the second breed comes back, it is labelled "Mezcla con", not "Segunda raza".** A cross has two halves; numbering them ranks one parent above the other, and the field is there to name the other half, not a runner-up. A recognised value gets a quiet "Esa la conocemos" confirmation, never a warning for being off-list.

### Inputs / Fields

- **Style:** Fjord Slate fill, Hairline Frost 1px border, 12px radius, 16px horizontal / 12px vertical padding, `text-primary` value text, **`text-tertiary` placeholder**.
- **48dp floor, plus the vertical centring it needs.** `minHeight` from `TOUCH_TARGET` with `textAlignVertical: "center"`: Android draws a `TextInput`'s text from the top of its box, so the floor alone leaves the value riding above the field's middle.
- **Horizontal padding is physical (`pl-4 pr-4`), not logical (`px-4`).** On a `TextInput`, Tailwind's `px-*` compiles to `padding-inline`, which React Native honours on a `View` but drops on Android's text input: measured, the placeholder sat 4.9dp from the border instead of 16dp, so text on device was flush against the edge while the browser looked right. `py-*` (`padding-block`) is unaffected. Not `text-muted`: that measured 3.58:1 on the input fill and failed WCAG AA, on the one element that carried the required date format. `text-tertiary` measures 6.64:1 and still reads as a hint.
- **A unit belongs inside the field, at its right edge**, in the placeholder tone — "min." on the exercise goal, and whatever comes next on a weight or an amount. The same place a price field puts its currency, and for the same reason: the unit belongs to the value being typed, so it sits next to the value rather than in the label or in a line of help underneath. It also survives typing, which a placeholder does not — that is what the exercise goal had, and it vanished on the first keystroke, taking the only statement of the unit with it. Two consequences worth knowing: the field's border moves to a row wrapper so the unit can sit inside it, which leaves the few pixels under the unit outside the input's own hit area; and the unit is `accessible={false}` with the spoken form folded into the input's name ("Objetivo diario de paseo, en minutos al día"), because a glyph to the right of an input tells a screen reader nothing.
- **A narrowed field needs `minWidth: 0` on the input.** On the web a `TextInput` is an `<input>`, whose intrinsic width is about twenty characters, and `flex-1` cannot shrink below that on its own. Measured: the duration field asked for 128dp and its input rendered 174, so the row overflowed and pushed the unit out over the two stepper buttons beside it. Anything sized narrower than its content wants needs the floor removed explicitly.
- **A field for a proper noun asks the keyboard for word capitalisation and turns autocorrect off** (`autoCapitalize="words"`, `autoCorrect={false}`, `spellCheck={false}`) — the pet's name and both breed fields. A name is not a sentence, and autocorrect actively mangles them. Note what this is: a _hint_. Android's IME can override it with its own auto-capitalisation setting, and desktop browsers ignore `autocapitalize` entirely because there is no virtual keyboard to hint at — so it will never capitalise while testing on the web. The app deliberately does not capitalise the value itself: "Conde de Chorrapelá" is a real name, and a normaliser would fight the tutor who typed it on purpose. The keyboard proposes; the tutor decides.
- **Focus:** not yet defined — no distinct focus treatment exists apart from the resting style.
- **Every request is bounded, and every failure answers in the app's voice.** `supabase-js` sets no `fetch` timeout, so a phone that has dropped off the network leaves a request pending for as long as the OS keeps the socket — measured on device, the launch screen span for minutes with `AuthRetryableFetchError` in the log and nothing on screen, which a tutor cannot tell from a hang because it is one. `lib/failures.ts` caps the wait at 12 seconds (generous on purpose: a slow answer in a vet's waiting room is still an answer) and turns whatever comes back into one of two sentences — "Parece que no hay conexión…" when the connection is what failed, and "Algo ha ido mal por nuestro lado…" otherwise. The transport's own text ("fetch failed: java.net.ConnectException: …/172.64.149.246:443") goes to the console, where a diagnostic belongs.
- **Validate on submit, forgive on input.** An error appears only when the tutor submits, and clears the moment its own field becomes valid — no blur required. It is never raised mid-typing for a field they have not finished, and clearing walks the errors already on screen rather than re-validating everything, so it can run on every keystroke without conjuring new ones.
- **Error / Disabled:** `TextField` accepts a per-field `error`, which swaps the resting hairline for `border-error` and renders the message below the input as a polite live region. Onboarding uses it: every failing field is marked at once, its label's asterisk turns `error` red, and the screen scrolls to the first one only when that field is off screen. No disabled input style exists yet — nothing in the app disables a field.

### Birthday

Once a year, three surfaces notice and none of them nags.

- **The headline is the animal's, not the day's** — see Day Navigation above.
- **The file's age line says it too**, in the secondary accent: "🎂 Hoy cumple 4 años · Adulto". **Not a badge on the portrait**, because the portrait's lower-right corner is already the camera — the whole point of `Avatar`'s badge is that the picture is how the picture is changed — and a second badge on a 96dp circle is two markers arguing. The age is the fact a birthday actually changes, and it was already on the screen.
- **That cake is an emoji, and it is a control**: pressing it throws the confetti again. Which is the answer to The No-Glyph Rule rather than a breach of it — the rule bans a character standing in for an _icon_, and this is neither an icon nor load-bearing. It is the one ornament a birthday earns, and on the one day a year it appears, celebrating again on purpose is the whole point. It sits on the 48dp floor like every other control even though the glyph is 20, with negative margins so it does not push the line it belongs to.
- **The fortnight before is a countdown, under the file's three lines**: "Quedan 15 días para su cumpleaños", and "Mañana es su cumpleaños" on the last one — the same instinct as "Hoy" and "Ayer" in the day headline. It is quiet text at `text-xs` in Mist Grey, one step under the age line it sits below, and it carries **no cake**: the glyph and the accent are what the day itself brings, so the arrival is a change of voice rather than one more line. **The two never share the screen** — at zero days the age line takes over.
- **Fifteen days, and the number is the argument.** Long enough to buy something, short enough that the line is never just decoration on a screen a tutor opens to look at their dog. A permanent "faltan 213 días" would be trivia, and trivia on a record is what makes people stop reading records.
- **The confetti fires once, on the day itself.** Which follows the rule the celebration already had: a threshold crossed, and a year is a threshold. Navigating back to a past birthday is bookkeeping and gets nothing; the year it fired for is remembered **on the device** rather than in the row, so two tutors with a phone each both get it, and a reinstall can repeat one — a celebration repeated is a shrug, a celebration missed is the thing the feature exists to prevent.
- **The confetti is the placeholder and the cake is not.** The intended celebration is the animal himself appearing from an edge of the screen; generic confetti holds the moment until then. A once-a-year event is where a bespoke animation earns its keep, which the daily goal is not.

### Celebration

A one-shot confetti fall over the whole app: 44 pieces, half round and half tumbling squares, staggered over 700ms and falling for 2.2s with a horizontal drift and a rotation. `pointerEvents="none"` throughout, so it never intercepts a tap on the screen it falls over. Hosted above the navigator, like the toast and for the same reason: the screen that earns a celebration is the screen that navigates away.

- **It degrades to nothing.** Under the system "remove animations" setting the component renders `null`. Confetti carries no information, so there is nothing to preserve when motion is off — unlike a button's status icon, which still appears and merely stops zooming. That is the line: motion may enhance a state change, never be the only thing communicating it.
- **Palette:** Ice Blue Glacial, Aqua Glaciar, Success Green and Snow White. Error Red is left out; a celebration does not throw warnings. **This is the one place a Nordic Ice colour appears as decoration**, and it is a narrow, deliberate exception to The One Accent Rule rather than an oversight — every colour here is role-scoped to something interactive, so any confetti would break some rule. What licenses the exception is that it **passes**: it is decoration in a moment, never decoration sitting on a screen. That is the same line Success Green was moved to when it came off the goal bar.
- **Two moments, and both are thresholds.** Registering the animal, which happens once per account, and the entry that reaches the day's exercise goal, which happens at most once a day and only on the day you are in. The second one exists because the goal bar stopped flashing green: a bar quietly changing hue is not a moment, and the moment was the thing worth keeping. **Everything else is an ordinary save and gets the button's own tick.** The test for reaching for this is whether something was _crossed_ — not whether a write succeeded.

### Toast

A transient message that floats above the whole app, in four variants: **success**, **warning**, **error**, **info**.

- **Surface:** Elevated Frost fill, one tonal step above content, with a 1px border in the status colour and a 12px radius. **No shadow** — the toast earns its separation the way every raised surface here does, by moving up a tonal step (The Flat-By-Default Rule). This is the first component that genuinely needed to float, and it did not need a shadow to do it.
- **Anatomy:** a 20px status icon, the message in `text-primary` (13.35:1 on the fill, so legibility never depends on the status hue), and either an action or a dismiss control.
- **Every variant has its own icon** — `CircleCheck`, `TriangleAlert`, `CircleAlert`, `Info` — which is what satisfies the rule against communicating state by colour alone. Status colours measure 6.42:1, 6.81:1, 3.89:1 and 3.98:1 against the fill, all clear of the 3:1 needed for a non-text indicator.
- **Two lifetimes.** An auto-hiding toast takes a `duration` in milliseconds (default 4000) and draws a 2px bar that drains over exactly that time, so "this is about to leave" is visible rather than a surprise. A **persistent** toast stays until the user acts and has **no bar at all**: a countdown that never finishes is a lie. Persistent is for anything the tutor has to deal with — a failed write, a decision.
- **Placement:** bottom, inside the page gutter, above the bottom safe-area inset, **plus the tab bar's height on any route inside `(tabs)`**. The host sits above the navigator so it cannot ask React Navigation how tall the bar is; without that clearance the toast covers the navigation labels, which a screenshot caught it doing. The host is `pointerEvents="box-none"`, so it never blocks what it covers.
- **Announcement:** `accessibilityRole="alert"`, assertive for a persistent toast (the user must deal with it) and polite for an auto-hiding one (it must not interrupt what is being read). Motion honours the system "remove animations" setting: it fades instead of sliding.
- **The host lives above the navigator**, in the root layout outside the `Stack`. A toast rendered by a screen dies with that screen, which is exactly wrong for the most important case — a create that succeeds and then navigates away would unmount its own confirmation before it could be read.

### Navigation

Bottom tab bar, 3 destinations — **Diario / Salud / Perfil** — each a 24px Lucide icon (`Footprints`, `HeartPulse`, `PawPrint`) over its label. Deep Ice background, Hairline Frost top border, active in Ice Blue Glacial (14.42:1), **inactive in Mist Grey** (7.12:1).

The inactive label was Slate Mist, which measures **3.83:1** on Deep Ice and fails AA at the size a tab label is drawn. It was the last text in the app that should be hard to read: the tab bar is the only permanent navigation, and it is read at a glance rather than studied. Mist Grey still sits far enough below the active label for the distinction to carry without the failure.

**Icons are not optional here, because the alternative is not "no icons".** With no `tabBarIcon` the navigator draws its own placeholder, which on the web target came out as a "⏷" glyph — inside the accessible name too ("⏷ ⏷ Hoy"). A Unicode glyph standing in for an icon is exactly what The No-Glyph Rule bans, and Material's navigation bar expects icons anyway.

**The label's typeface is set explicitly** (`tabBarLabelStyle: { fontFamily: "Outfit_500Medium" }`). The navigator draws its labels outside the `Text` wrapper that applies the family everywhere else, so without it the only permanent text in the app rendered in the platform's own face while everything above it was in Outfit.

**"Diario", not "Hoy": the tab names the section, the screen names the day it is showing.** Its icon is the same `Footprints` the walk action carries — and the repetition is the point rather than a clash: walks are most of what the diary holds, and a tutor who has learnt the glyph on the entry sheet reads it here for free. A notebook was rejected as the literal answer to "diary" that says nothing about what is in it; a park (`Trees`, tried and dropped) named the place instead of the going. It survives beside the paw print two tabs along because the two are different drawings — a trail of prints going somewhere against one pad seen head-on.

## Iconography

Icons arrived with the checkbox and the date field; before that the app had none, tab bar included.

**Library: `lucide-react-native`** (over `react-native-svg`). Chosen for four reasons in order: per-icon tree-shaking so only imported glyphs ship, `color` / `size` / `strokeWidth` props that take Nordic Ice tokens directly, a geometric 24px-grid line style that matches Outfit and the cold-and-precise north star, and — because it renders real SVG rather than an icon font — paths that Reanimated can animate (`strokeDashoffset` to draw a tick rather than pop it in). An icon font can only animate colour and opacity.

**Sizes in use:** 16px inside the 24px checkbox (at `strokeWidth` 3, so it holds up at that size), 16px as a button's leading icon, 18px as a field suffix and beside the name in the record header, 20px for the sheet dismiss (`X`) and for a button's status glyph, 24px in the tab bar.

### Named Rules

**The No-Glyph Rule.** An icon is never a Unicode character. Outfit's charset does not cover the symbol ranges, so a glyph silently falls back to another typeface and breaks The One Family Rule — which is exactly what the old `♂`/`♀` sex chips did, in the middle of the form. Those are now the words "Macho" and "Hembra".

The rule bans a character standing in for an **icon**, not every character. Two things sit outside it on purpose. Emoji appear as **ornament** — the birthday headline's 🎂 and 🎉, the activity hint's 💪 — where nothing depends on them, they are kept out of every accessible name, and falling back to the system emoji face is what emoji are _for_. And the file's birthday cake is an emoji that is also a **control**: pressing it throws the confetti again.

The rule bans the character, not the symbol: the sex does appear as a mark in the record header, drawn as Lucide's `Mars` / `Venus` at 18px. Being real SVG it takes a token colour, scales with the icon grid and cannot fall back to another family. It also carries an accessible name — it is the only place the sex is shown, so it is data rather than decoration, and an unlabelled icon would drop it from the screen a reader hears.

## Do's and Don'ts

### Do:

- **Do** use the single 12px radius (`rounded-xl`) on every new interactive control — inputs, buttons, chips alike.
- **Do** express state (selected, active) through a tonal step (Elevated Frost) and the accent border, never a shadow.
- **Do** keep Outfit as the only typeface; differentiate by weight and size.
- **Do** mark an optional field as optional. Nothing marked required works better here than asterisks everywhere: the required fields lead the form, and only the skippable ones carry the word. It is also the honest thing to do — a tutor is entitled to know which data they can decline to give.
- **Do** make every animation optional. Android's "remove animations" setting is honoured through `useReducedMotion()`, and the rule is that motion may only ever _enhance_ a state change, never be the only thing that communicates it: the button's status icon still appears when motion is off, it simply does not zoom. This binds anything decorative added later — a celebration effect included: it must degrade to nothing, not to a broken half-animation.
- **Do** scroll the _first_ error into view on submit, in visual order rather than the order the validator reported them, and only when the field is not already on screen — moving the view for a field the tutor can already see costs them their place. Defer it a frame: scrolling in the same tick as the error state scrolls the pre-error layout, and the browser's scroll anchoring then cancels it.
- **Do** confirm a write. Every CRUD action owes the user a visible result: the button's own check or alert for the press, and a toast for what actually happened to their data. A screen that navigates on success without a word leaves the tutor guessing whether the thing they came to do worked.
- **Do** pair a confirmation with the action that triggered it. "¡Vamos, Loki!" is answered by "¡Loki ya está contigo!" — a recall, the call on a walk and the dog arriving. The pair makes the feedback read as an _answer_ rather than a log line, and it draws on the product's own world instead of borrowed charm. Write the two together or they drift apart.
- **Do** let a control explain itself. Ticking "Aproximado" turns the picker into month and year; that demonstration replaces the sentence that would have described it.
- **Do** use `text-on-accent` for any text on an Ice Blue Glacial surface — never `text-base`, which is Tailwind's font-size utility, not a color, and silently produces no text color at all.
- **Do** resolve every color through a Nordic Ice token; a raw hex value in a component `className` is a defect, not a shortcut (enforced in `AGENTS.md`).

### Don't:

- **Don't** add drop shadows, glassmorphism, or blur — depth here is tonal, never shadow-based.
- **Don't** introduce a second accent hue outside Ice Blue Glacial / Aqua Glaciar; the accent family is deliberately narrow so it keeps its meaning.
- **Don't** communicate success/error/selected state by color alone — pair it with a non-chromatic cue. This is not theoretical: a selected chip's Elevated Frost fill against an unselected chip's Fjord Slate fill measures **1.16:1**, so the tonal step is imperceptible and, on its own, selection rested entirely on the 1px accent border. `Chip` therefore sets its selected label to 700 weight, which reads in daylight and for a color-blind viewer while staying inside The One Family Rule. Every new stateful component owes the same: a weight, a glyph, or a genuinely visible tonal step — never the accent alone.
- **Don't** let wit cost an error its clarity. The voice may reach a failure — "Parece que Loki no contesta a su nombre… ¡vuelve a intentarlo!" keeps the recall metaphor the button opened — but only while the way out stays explicit and the message persists until the user acts on it. The test is not tone, it is whether the tutor knows what to do next. Two shapes that pass it: a question where a rule would do ("¿Cómo se llama?" for an empty field, "¿Aún no ha nacido?" for a future date, which treats a slip as the slip it almost always is), and taking responsibility when the fault is ours ("Algo ha ido mal por nuestro lado").
- **Don't** let the voice be the accessible name. The visible label speaks like a household; **the accessible name states the action** — "¡Vamos, Loki!" reads as a control only next to the form it submits, so the button announces "Registrar mascota". Three corollaries. No emoji in an accessible name: a screen reader turns 🐶 into "cara de perro", so the headline and the activity hints keep their emoji on screen and out of the spoken string. A label whose visible text changes with a phase carries its name with it — a button reading "¡Ya estáis dentro!" that still announces "Registrar mascota" describes a control that is no longer there. And a warm line that reports a state has to report it: "Por aquí no hay nada" announces "Página no encontrada". Decoration that says nothing is hidden outright — the confetti is out of the accessibility tree on both platforms.
- **Don't** trust one accessibility API to cover both targets. `accessibilityState` is what Android reads, and react-native-web renders the _role_ from it while dropping `aria-checked` — so on the web the checkbox and the chips announced a role with no state, which is worse than no role at all. Selection controls pass both, and a control whose state is the whole point is worth two props.
- **Don't** put the voice in a label. Field labels, chips, month names and dismiss controls stay literal: a label's whole job is to be read instantly, and personality there costs legibility for nothing. The voice belongs in headlines, primary actions, confirmations and empty states.
- **Don't** name an internal plan in user-facing copy. An empty state says what will appear here in the tutor's terms, not what the roadmap calls it.
- **Don't** write a sentence where an intuitive control would do. The average reader skips body copy, so explanatory text is not documentation — it is clutter that pushes the real controls down. Detail a genuinely interested user might want should be _reachable_, not placed in everyone's way.
- **Don't** explain a collapsed or inactive block from the outside. Describing what sits behind "Rellenar más datos" charges cognitive load to every reader, including the majority who will never open it. The explanation belongs inside, once the block is open.
- **Don't** state what the context already carries. A screen inside a pet app, asking for a pet's details, does not need a sentence announcing that it is asking for a pet's details.
- **Don't** reach for platform-native components (Material 3 FABs, Material filled text fields, Android date-picker dialogs — or their iOS equivalents) to satisfy per-OS conformance. Being an Android app does not make Material 3 the house style: Nordic Ice is deliberately one uniform world. Adapt it to Android's physical constraints; don't replace it with Android's native kit.
