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
    padding: "12px 0"
  chip-selector-active:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 0"
  checkbox:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    size: "24px"
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
- **Status colors** (functional, not decorative — used for state communication only): Success Green (#22C55E), Warning Amber (#F59E0B), Error Red (#EF4444, the only one in active use today, for inline error text), Info Blue (#3B82F6).

### Named Rules

**The One Accent Rule.** Ice Blue Glacial is the only color that means "act here." It appears on the primary button, the active tab, and a selected chip's border — nowhere else. Diluting it into a general-purpose brand color would cost it its signal.

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

**Open: every number above is web-measured, and the device renders them at 87.5%.** Tailwind's spacing, radius and font-size utilities are `rem`-based, and the native CSS compiler resolves `1rem` to **14** (it follows React Native's default font size) where the browser resolves it to 16. Measured on a 375×817dp device: the group's `px-5` padding lands at 17.5dp instead of 20dp, the 24px checkbox at 21dp, and the chips at ~41dp instead of the 47dp recorded here — further below Android's 48dp touch target than the audit says. `withNativewind`'s `inlineRem` option cannot fix it in this version (the metro wrapper stores compiler options at `config.transformer.reactNativeCSS` while its transformer reads `options.reactNativeCSS`, so they never arrive); expressing the theme's `--spacing`, `--radius-*` and `--text-*` in px would.

A second, sharper case of the same root: **`line-height` from a utility class does not survive at all.** Tailwind emits `calc(var(--spacing) * 6)` for `leading-6`, and the compiler's line-height parser warns and returns nothing for a `calc()`, so every `leading-*` class in the app is inert on device — not scaled, dropped. A literal `leading-[24px]` is dropped too, because the runtime path never receives it. Line height therefore comes from a `style` prop, which is the same rule `tokens.ts` already exists for. **Unresolved — it belongs to the platform-adaptation pass, because closing it moves every dimension on the device at once.**

### Named Rules

**The keyboard is a bottom inset, and `Screen` owns it.** Under edge-to-edge Android stops resizing the window when the keyboard opens, so a `ScrollView` keeps its full height and everything behind the keyboard becomes unreachable: measured on device, the breed field's six suggestions opened entirely below the keyboard, with nothing on screen changing to say a list had appeared. `Screen` listens for the keyboard and pads the scroll content by **the larger of the navigation-bar inset and the keyboard height** — never their sum, since the keyboard is measured from the bottom of the screen and already covers that inset. The non-scrolling variant keeps the resting inset, because padding buys nothing where content cannot move.

**A field that opens an overlay list scrolls itself to the top on focus.** Room below is the point, not visibility: the tutor is already looking at the field. This is the one scroll in the app that is unconditional — `scrollToFirstError` deliberately does the opposite and stays put when the field is already on screen.

## Elevation & Depth

Flat by construction — no shadow appears anywhere in the implementation. Depth is conveyed entirely through four fixed tonal steps, from the deepest background to the most raised surface: **Polar Night** (page) → **Deep Ice** (tab bar, its own distinct plane) → **Fjord Slate** (content surfaces: inputs, resting chips) → **Elevated Frost** (a chip's selected state). Nothing sits above Elevated Frost yet.

### Named Rules

**The Flat-By-Default Rule.** No drop shadows, no glassmorphism, no blur. If a future component needs to signal "raised," it moves up one tonal step — it does not reach for a shadow.

**This is a consequence of the palette, not a preference.** It was tested: a black shadow at 25% effective alpha composited over Polar Night yields **1.03:1** — weaker than the _weakest_ tonal step the palette already has (page → surface, 1.11:1). The same shadow on a light ground gives 1.83:1. On a near-black page a shadow has nothing to contrast against, so it costs render work and buys almost nothing. Two shadowed variants of the onboarding form were built and rejected on this evidence; what looked like depth in them was the tonal step doing the work.

**Grouping is the fifth depth role, and it is an outline.** A form section is bounded by a 1px Hairline Frost border (1.29:1 against the page) with 20px padding and the system radius — the `Group` component. It is deliberately _not_ a filled card: the four tones are already spoken for (page, content surface, selected state, tab bar), so a filled grouping card would have to take one of those roles and push every other component's tone down a step. A filled variant was built and it did exactly that, costing the field and chip tones. An outline groups without spending a tone, so nothing else has to move.

## Shapes

One radius, everywhere: 12px (`rounded-xl`) on every button, input, and chip in the implemented screens — no smaller or larger radius appears anywhere. Borders are always 1px hairlines; there is no thicker border weight. No fully-rounded (pill) or sharp-cornered shapes exist yet.

### Named Rules

**The One Radius Rule.** 12px is the only corner radius in the system. A new component defaults to it rather than picking a fresh value.

**The one recorded exception is the checkbox**, and it is forced rather than chosen: 12px on a 24px box is a full circle, which reads as a radio button and therefore means the wrong thing. It uses **6px — exactly half the system radius**, proportional to the control instead of a fresh arbitrary value. Any future control small enough to be swallowed by a 12px radius follows the same halving rule; nothing else invents a radius.

## Components

### Buttons

- **Shape:** 12px radius (`rounded-xl`), full-width, centered content.
- **Primary:** Ice Blue Glacial fill, `on-accent` text, 600 weight, 16px vertical padding.
- **The button owns the async feedback cycle**, and this is a foundational commitment rather than a per-screen choice: press → the label is replaced by a centered spinner → a check or an alert icon → back to rest after 1.4s. **The press lock covers the result phase, not just the request**, so the second tap already on its way cannot produce a duplicate write. A handler returns `true` or `false` (or throws, which counts as failure) and the button does the rest, which is what makes duplicate submissions structurally impossible instead of something each caller has to remember.
- **Error state:** the fill becomes Error Red with an alert icon in `on-accent`. Counter-intuitively the dark navy is the readable colour there — #0B1120 on #EF4444 measures 5.00:1 and passes AA, while `text-primary` measures 3.44:1 and fails. The Text-On-Accent Rule extends to status fills.
- **An icon is not a reason**, and that applies to the button itself. The success and error states keep a label beside the glyph (`successLabel` / `errorLabel`), because a red button with a warning icon says something is wrong without saying what. The caller names it, since only the caller knows which failure it was — onboarding distinguishes "Faltan datos por rellenar" from "No se ha podido guardar". Never let a throw escape a handler and leave a red flash as the only explanation either.
- **Motion honours the system "remove animations" setting** via `useReducedMotion()`: the status icon still appears, it just does not zoom in.
- **Secondary / Ghost:** transparent fill, Steel Frost 1px border, `text-secondary` label, 12px vertical / 24px horizontal padding. Used for a real alternative action (retry, sign out) — never the primary action on a screen.
- **Link (tertiary):** no border, no fill, no full-width block. Aqua Glaciar label at 600 weight, optional 16px leading icon, left-aligned and sized to its text, with a 48dp minimum hit area. For an action that must sit _below_ the primary in the reading order rather than compete with it — revealing an optional section, for instance.
  Two full-width buttons stacked read as a pair of peer actions however different their fills are, which is exactly what a skippable disclosure must not look like next to an irreversible commit. Shrinking it to a link is what separates them; distance alone did not.
  **It uses Aqua Glaciar, not Ice Blue Glacial, on purpose.** The primary accent means "this is the one thing to do here" (The One Accent Rule), and a disclosure the tutor may ignore is not that.
- **Hover / Focus:** not yet defined. This is a native app (no `:hover`); a pressed/focus treatment (e.g. a brief opacity or scale change) has not been implemented on any button yet and should be resolved deliberately, not left implicit, the first time it matters for a real interaction.

### Chips (selector chips)

Used as an exclusive single-select control within a small fixed set (e.g. sex: 2 options; activity level: 3 options) — closer to a segmented control than a tag.

- **Unselected:** Fjord Slate fill, Hairline Frost 1px border, `text-primary` label at body weight.
- **Selected:** Elevated Frost fill, Ice Blue Glacial 1px border, `text-primary` label at **700 weight**. The weight change is load-bearing, not decoration: the selected-vs-unselected _fill_ difference measures 1.16:1 and cannot be relied on (see Don'ts).
- **Layout:** equal-width (`flex-1`) siblings in a row, 12px gap, 12px radius, centered label. A row is wrapped in `ChipGroup`, which exposes the set as one radio group so the chosen option is announced in context.
- **Optional 16px leading icon**, drawn in `text-primary` when selected and `text-tertiary` at rest, so the icon carries the same selected/unselected signal as the weight change. The sex chips use `Mars` and `Venus` — the icons the old `♂`/`♀` glyphs were reaching for before they fell outside Outfit's charset and silently changed typeface (see The No-Glyph Rule).
- **Size:** 12px vertical padding over a body line box, measured at **47dp** on the web target — 1dp under Android's 48dp minimum touch target, and not yet corrected.

### Group

A hairline-outlined section of a form: 1px Hairline Frost border, 12px radius, 20px padding, `pb-1` at the bottom because form fields carry their own 20px bottom margin and a symmetric padding would visibly deepen the gap at the end of every group. An optional `title` renders in `text-secondary` uppercase — one step brighter than a field label's `text-tertiary`, so a section heading never reads as just another field label.

**Use it for sections that differ in kind, not in priority.** In onboarding every field shown at start sits in a _single_ group, including the skippable breed: they are one set of facts about the animal and should read as equally worth giving. Priority is expressed by what blocks a save and by the `opcional` marker, never by splitting a form into an important box and an unimportant one. The deferrable health and activity fields get their own group because they are a different kind of fact and arrive at a different moment.

### Checkbox

A voluntary boolean flag, **unchecked by default**. Used for a qualifier that only ever gets asserted deliberately — "solo sé el mes y el año", "es mestizo" — where an unchecked box is the honest resting state.

- **Box:** 24px square, 6px radius (the recorded exception in Shapes), 1px border. Unchecked: Steel Frost border on Fjord Slate. Checked: Ice Blue Glacial fill and border, with an `on-accent` tick.
- **Label:** `text-primary`, stepping to 600 weight when checked — a non-chromatic cue, same principle as the chips.
- **Label alignment:** the box's side and the label's line height are **the same literal number, from one constant in the component**. The row is `items-start` (so the box stays level with the first line when the label wraps or a hint follows), and two boxes of equal height then share a centre. Neither side can be a class here: `h-6` is rem-based, which native resolves to 21 instead of 24, and `leading-6` reaches native as a `calc()`, which the CSS compiler warns on and **discards outright** — measured on device, every `leading-*` class was inert and the label rode 6.5px (2dp) above the box. With both as literals the residual is 2.5px (0.8dp), the font's own ascent/descent asymmetry, which is below perceptibility and not worth a magic offset.
- **Hint:** optional second line, `text-tertiary` at 12px, stating what ticking the box does.
- **Why not a chip pair:** three adjacent Sí/No chip rows looked identical but behaved differently, two of them rendering "No" pre-selected so an assumption was indistinguishable from an answer, with the polarity flipped between them. A checkbox says what a chip pair cannot: this is off unless you turn it on.
- **When a chip row is still right:** `¿Esterilizado?` keeps three chips because "no lo sé" is a real answer for an adopted dog, and a checkbox cannot carry a third state.

### Date Field & Picker

A value display that opens a picker. **No text input** — the field previously demanded `AAAA-MM-DD` from a reader who writes DD/MM/AAAA, with no `keyboardType`, so Android raised the alphabetic keyboard for a digits-only task.

- **Display:** Fjord Slate fill, hairline border, 12px radius, calendar icon suffix in `text-tertiary`. Empty shows `DD/MM/AAAA`, or "Mes y año" in approximate mode.
- **Sheet:** bottom sheet on an 80%-opacity Polar Night scrim, with a title, an X, and a Cancelar / Confirmar pair in the footer. **Four ways out without saving** — the X, Cancelar, a scrim tap, and Android's system Back. Nothing commits until Confirmar.
- **Exact mode is `react-native-ui-datepicker`**, themed entirely through its `classNames` prop with Nordic Ice utilities. Chosen because it is pure JS (identical on web and Android, unlike `@expo/ui`'s DateTimePicker, which returns `null` on web and would silently render nothing during development), it carries its own accessibility (every day cell is a `button` with the day number as its accessible name), and `locale="es"` gives Spanish month and weekday names. `maxDate` disables future days in the UI, not just in validation. Its defaults reference `text-foreground` and `bg-accent`, classes this project does not define, so **every visible key is set rather than merged over `useDefaultClassNames()`** — a partial override renders invisible text.
- **Approximate mode is a month-and-year selector, not a calendar**: a horizontally scrolling year strip and a 12-cell month grid, both built from the system's own `Chip`. The library cannot express this mode — its `onSelectMonth` ends in `setCalendarView('day')`, and overriding `components.Month` does not help because the library wraps the override in its own Pressable calling that same handler, so a tap still falls through to the day grid. Defeating that with a remount would be a hack one upgrade away from breaking; a month/year selector is simply a different control from a date picker, and no library ships one.
- **Display honesty:** an approximate date renders as "Septiembre de 2025", never "01/09/2025" — a placeholder day is not shown as fact. The sheet previews the same string before the tutor commits.
- **Capitalisation:** month names are capitalised at the source in `lib/dates.ts`; the library's own header caption comes from dayjs in lowercase and is corrected with a `capitalize` class on `month_selector_label`.

### Breed Combobox

Suggests from a curated list, accepts anything typed.

- **Input:** the standard field style, `autoCapitalize="words"`, autocorrect off (a breed is a proper noun and autocorrect mangles them).
- **Suggestions:** up to 6, in an Elevated Frost panel below the field, hairline-divided, prefix matches before substring matches, accent- and case-insensitive so "pastor aleman" finds "Pastor Alemán".
- **Suggestions appear from the third letter**, and so does the mixed-breed offer below — it sits _above_ the breed list rather than replacing it, because a prefix can be on its way to both. Waiting for a whole word before showing anything is what made the field read as having no autocomplete at all.
- **"Mestizo" is an answer to the breed question, not a breed.** It is deliberately absent from the list, because an adopted dog often has no known ancestry and "mestizo" is the honest answer rather than a gap — one that already has a home in the record, the `is_mixed` flag. Left alone, free text let the same fact take two encodings, one of them wrong: `breed_primary = "Mestizo"` with `is_mixed` false, which reads perfectly ("Hulk — Mestizo") and is unusable for anything breed-based. So typing it **offers to record it as what it is** — a single row, "Mestizo, sin raza concreta", that ticks the flag and clears the field — and the app→database boundary normalises it the same way for a tutor who types past the offer. The display the tutor wanted is legitimate and survives: a mixed dog with no breeds named reads back as "Mestizo", one with a single breed as "Mestizo de Husky Siberiano". **Nothing stores the word.**
- **Free text is still valid.** Regional names and breeds outside the list are real answers; the list makes the canonical spelling easy, it does not constrain.
- **The second breed is labelled "Mezcla con", not "Segunda raza".** A cross has two halves; numbering them ranks one parent above the other, and the field is there to name the other half, not a runner-up. A recognised value gets a quiet "Esa la conocemos" confirmation, never a warning for being off-list.

### Inputs / Fields

- **Style:** Fjord Slate fill, Hairline Frost 1px border, 12px radius, 16px horizontal / 12px vertical padding, `text-primary` value text, **`text-tertiary` placeholder**.
- **Horizontal padding is physical (`pl-4 pr-4`), not logical (`px-4`).** On a `TextInput`, Tailwind's `px-*` compiles to `padding-inline`, which React Native honours on a `View` but drops on Android's text input: measured, the placeholder sat 4.9dp from the border instead of 16dp, so text on device was flush against the edge while the browser looked right. `py-*` (`padding-block`) is unaffected. Not `text-muted`: that measured 3.58:1 on the input fill and failed WCAG AA, on the one element that carried the required date format. `text-tertiary` measures 6.64:1 and still reads as a hint.
- **Focus:** not yet defined — no distinct focus treatment exists apart from the resting style.
- **Validate on submit, forgive on input.** An error appears only when the tutor submits, and clears the moment its own field becomes valid — no blur required. It is never raised mid-typing for a field they have not finished, and clearing walks the errors already on screen rather than re-validating everything, so it can run on every keystroke without conjuring new ones.
- **Error / Disabled:** `TextField` accepts a per-field `error`, which swaps the resting hairline for `border-error` and renders the message below the input as a polite live region. Onboarding uses it: every failing field is marked at once, its label's asterisk turns `error` red, and the screen scrolls to the first one only when that field is off screen. No disabled input style exists yet — nothing in the app disables a field.

### Celebration

A one-shot confetti fall over the whole app: 44 pieces, half round and half tumbling squares, staggered over 700ms and falling for 2.2s with a horizontal drift and a rotation. `pointerEvents="none"` throughout, so it never intercepts a tap on the screen it falls over. Hosted above the navigator, like the toast and for the same reason: the screen that earns a celebration is the screen that navigates away.

- **It degrades to nothing.** Under the system "remove animations" setting the component renders `null`. Confetti carries no information, so there is nothing to preserve when motion is off — unlike a button's status icon, which still appears and merely stops zooming. That is the line: motion may enhance a state change, never be the only thing communicating it.
- **Palette:** Ice Blue Glacial, Aqua Glaciar, Success Green and Snow White. Error Red is left out; a celebration does not throw warnings. **This is the one place a Nordic Ice colour appears as decoration**, and it is a narrow, deliberate exception to The One Accent Rule rather than an oversight — every colour here is role-scoped to something interactive, so any confetti would break some rule. It is scoped to a moment that happens once in an account's life.
- **Reserved for exactly that moment.** Registering the pet runs once per account in v0, which is what stops the effect becoming the repeated noise that usually ruins one. Do not reach for it on an ordinary save.

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

Bottom tab bar, 3 destinations (Hoy / Salud / Perfil), text-only (no icons implemented yet). Deep Ice background, Hairline Frost top border, active label in Ice Blue Glacial, inactive label in Slate Mist.

## Iconography

Icons arrived with the checkbox and the date field; before that the app had none, tab bar included.

**Library: `lucide-react-native`** (over `react-native-svg`). Chosen for four reasons in order: per-icon tree-shaking so only imported glyphs ship, `color` / `size` / `strokeWidth` props that take Nordic Ice tokens directly, a geometric 24px-grid line style that matches Outfit and the cold-and-precise north star, and — because it renders real SVG rather than an icon font — paths that Reanimated can animate (`strokeDashoffset` to draw a tick rather than pop it in). An icon font can only animate colour and opacity.

**Sizes in use:** 16px inside the 24px checkbox (at `strokeWidth` 3, so it holds up at that size), 18px as a field suffix, 20px for the sheet dismiss (`X`).

### Named Rules

**The No-Glyph Rule.** An icon is never a Unicode character. Outfit's charset does not cover the symbol ranges, so a glyph silently falls back to another typeface and breaks The One Family Rule — which is exactly what the old `♂`/`♀` sex chips did, in the middle of the form. Those are now the words "Macho" and "Hembra".

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
- **Don't** put the voice in a label. Field labels, chips, month names and dismiss controls stay literal: a label's whole job is to be read instantly, and personality there costs legibility for nothing. The voice belongs in headlines, primary actions, confirmations and empty states.
- **Don't** name an internal plan in user-facing copy. An empty state says what will appear here in the tutor's terms, not what the roadmap calls it.
- **Don't** write a sentence where an intuitive control would do. The average reader skips body copy, so explanatory text is not documentation — it is clutter that pushes the real controls down. Detail a genuinely interested user might want should be _reachable_, not placed in everyone's way.
- **Don't** explain a collapsed or inactive block from the outside. Describing what sits behind "Rellenar más datos" charges cognitive load to every reader, including the majority who will never open it. The explanation belongs inside, once the block is open.
- **Don't** state what the context already carries. A screen inside a pet app, asking for a pet's details, does not need a sentence announcing that it is asking for a pet's details.
- **Don't** reach for platform-native components (Material 3 FABs, Material filled text fields, Android date-picker dialogs — or their iOS equivalents) to satisfy per-OS conformance. Being an Android app does not make Material 3 the house style: Nordic Ice is deliberately one uniform world. Adapt it to Android's physical constraints; don't replace it with Android's native kit.
