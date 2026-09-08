---
target: app/onboarding.tsx
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/mikel/workspace/petlife/app/onboarding.tsx"
target_fingerprint: "sha256:0530893e0496d7a68e77ac22c4dfc63b4e440e17131433f9602fe7db05f4f986"
target_path: /Users/mikel/workspace/petlife/app/onboarding.tsx
timestamp: 2026-09-07T10-45-11Z
slug: app-onboarding-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Busy label and async gates exist, but zero validation feedback before submit, no success confirmation, and `disabled={busy}` (L315) has no visual counterpart. |
| 2 | Match System / Real World | 2 | `AAAA-MM-DD` (L226) is a machine format demanded of a Spanish user who writes DD/MM/AAAA; "Nivel de actividad" is an unexplained vet abstraction. |
| 3 | User Control and Freedom | 1 | No cancel, no back affordance, no undo of an irreversible write, and no edit path for any field anywhere in the app. |
| 4 | Consistency and Standards | 1 | Si/No polarity flips between adjacent identical rows; three different meanings for a lit chip; busy state contradicts both DESIGN.md and login.tsx; 15 of 16 controls miss Android's 48dp standard. |
| 5 | Error Prevention | 1 | Free-text date, no keypad, no mask, no maxLength, no picker; nothing marks required fields; two `false` defaults write unconfirmed answers. |
| 6 | Recognition Rather Than Recall | 3 | Everything visible, all chips text-labelled. But the format hint vanishes on first keystroke and "Bajo/Moderado/Alto" has no anchor. |
| 7 | Flexibility and Efficiency | 1 | One rigid path. No returnKeyType chaining, no keyboardType, no autofill, no way to skip six optional fields. |
| 8 | Aesthetic and Minimalist Design | 2 | Clean and token-disciplined, but eight groups at identical visual weight; the only hierarchy is the headline and the accent button. |
| 9 | Error Recovery | 1 | Only the first error is returned (lib/pets.ts:53), rendered below all eight groups, detached from a field that may be off-screen; raw Postgres English reaches the Spanish UI. |
| 10 | Help and Documentation | 1 | No contextual help. Two placeholders and one format hint are the entire guidance. |
| **Total** | | **15/40** | **Poor** |

## Design Specificity Verdict

**Half-authored: the copy is specific to this product, the design is not.**

Two things could not have come from anywhere else. The headline "Quien vive contigo?" (L141) reframes a database insert as a question about a household, and the "Loki" placeholder (L151) makes it personal rather than exemplary. And the `neuteredTouched` tri-state (L34-38, L277) is real domain thinking: `null` is a legitimate answer, so the code refuses to fabricate a clinical fact it wasn't told.

Everything below the headline is a generic vertical form. Eight label-plus-control groups in source order, each separated by the same `mb-5`. Nothing in the composition knows that seven of eight answers are optional (lib/pets.ts:25-31 requires only name and sex), that this is tired retrospective capture on an Android phone, that the product has two tutors while the screen models one, or that the birthdate is not a profile field but the anchor for the vaccine/deworming engine that is the product's reason to exist.

**Deterministic scan.** `detect.mjs` returned 0 findings on both `app/onboarding.tsx` and `app/` (exit 0). **That is coverage failure, not cleanliness.** Verified in the detector source: `.tsx` is scannable but only `.html`/`.htm` reach the static-HTML engine (cli/main.mjs:108-113), so a TSX file gets the regex engine only — 15 web-oriented anti-patterns looking for CSS declarations, `<img>` tags and Tailwind palette-scale classes. None exist here. It examined nothing relevant to this codebase.

Substituted mechanical checks found the **design-system layer in genuinely good shape**: 13/13 `rounded-` utilities are `rounded-xl`; all 58 colour utilities resolve to Nordic Ice tokens; zero shadow/blur/gradient; zero `text-base` (the DESIGN.md trap). All 11 raw hex literals sit in RN props `className` structurally cannot reach and every value is an exact token — a false positive against AGENTS.md, though the absence of a shared token module means they will drift.

And the **interaction layer in poor shape**, measured not assumed:
- **Touch targets: 15 of 16 controls are 44dp against Android's 48dp minimum.** Measured against the live compiled stylesheet: `border py-3` = 1+12+18+12+1 = 44dp (RN `<Text>` default renders an 18px box, not 24px). The only passing control is the submit button at 50dp — the one thing the user touches once.
- **Contrast:** placeholder `text-muted` #64748B on `surface` #131C2E = **3.58:1, fails AA** (L152, L188, L227 — including the birthdate field whose format hint is the only place the required format appears). Border `#1E293B` vs page `#0B1120` = 1.29:1; selected-vs-unselected chip fill = **1.16:1**, imperceptible.
- **Accessibility: zero props in the entire `app/` tree.** No accessibilityLabel, Role, State or Hint anywhere. Confirmed at runtime: the login button renders with `role` = null.
- **Keyboard: all three TextInputs carry no `keyboardType`, `autoCapitalize`, `autoComplete`, `returnKeyType` or `maxLength`.** The birthdate field enforces `/^\d{4}-\d{2}-\d{2}$/` yet raises the alphabetic keyboard.

**Visual evidence.** The onboarding form itself was never rendered: a clean browser at `/onboarding` resolves to `/login` (app/onboarding.tsx:110). Captures at 412x915 and 360x800 of the reachable `/login` show zero console errors and no horizontal overflow at either width. Vertical rhythm, clipping and keyboard-open behaviour on the target screen remain unverified.

## Overall Impression

The visual system is being obeyed impeccably and used to say nothing. Token discipline is close to perfect — one radius, one family, one accent, no shadows, no stray hex in any className. That discipline is real work and it holds.

But this screen is the irreversible gate to every piece of tracking data the product will ever hold, and it is styled as though nothing is at stake. Eight questions at identical visual weight, no field marked required, a free-text date that anchors the entire due-date engine, one error revealed per submit round-trip, and no edit path afterwards anywhere in the app. The single biggest opportunity is not visual: it is to ask for less. Every field this screen doesn't ask is a field that can't be permanently wrong.

## What's Working

1. **The headline plus the placeholder.** "Quien vive contigo?" (L141) with "Loki" pre-filled (L151) does three jobs in one sentence: sets tone, explains the screen, and implies only one answer is needed. A generic form says "Anadir mascota".
2. **The failure-path discipline in `submit()` (L113-133).** `try/finally` guarantees `busy` resets and the typed draft survives a failed RPC, with a comment recording the exact bug it fixes. For a product promising "never lose tracking data", preserving eight fields through a network failure is the right instinct and rare in first-cut forms.
3. **The `neuteredTouched` guard (L34-38, L277).** Recognising that `null` is a legitimate third answer and therefore cannot double as "untouched" is precise domain reasoning. Its flaw is that the same reasoning wasn't applied to the two boolean rows beside it.

## Priority Issues

### [P0] Every value here is permanent, and the form is styled as if nothing is at stake
**Why it matters:** app/onboarding.tsx:111 redirects away forever once a pet exists, and `app/(tabs)/profile.tsx` is a sign-out stub — there is no edit path for any of these eight fields anywhere in the app. Combined with the free-text date (L220) and the silent `false` defaults (L28, L30), the first thing a user ever does writes unchangeable data including values they never consciously answered. A mistyped birthdate poisons every vaccine and deworming due date, which is the stated reason the date is wanted at all. "Never lose tracking data" fails in a subtler way than loss: the data is wrong and frozen.
**Fix:** Make the pet editable — a "Datos de Loki" section in Perfil reusing this form; `PetDraft` already models everything. Until then, state in the intro that only Nombre and Sexo are needed now, and echo the entered values back before Guardar.
**Suggested command:** `/impeccable harden`

### [P1] Adjacent identical Si/No rows with flipped polarity and three meanings of "selected"
**Why it matters:** `Es mestizo?` renders [No, Si] (L198-199). `Fecha aproximada?` renders [No, Si] (L238-239). `Esterilizado?` renders [Si, No, No se] (L264-266). Separately, `isMixed: false` and `birthDateApproximate: false` make "No" render pre-selected with the accent border on first paint, while `spayedNeutered` shows nothing selected and `activityLevel` shows a default. Four identical-looking rows, three different semantics for a lit chip. A user tapping down the left column answers "no mestizo, fecha exacta, esterilizado si" — and "fecha exacta" is precisely the honesty that field was added to protect. It also breaks The One Accent Rule in spirit: accent currently means both "you chose this" and "we assumed this".
**Fix:** One polarity everywhere. Extend the `neuteredTouched` pattern to `isMixed` and `birthDateApproximate`. Give a defaulted-but-unconfirmed chip `border-border-strong` instead of `border-accent-primary`.
**Suggested command:** `/impeccable clarify`

### [P1] The screen has never met an Android window inset, on the only platform it ships to
**Why it matters:** `react-native-safe-area-context` is a dependency and is never imported. `app/_layout.tsx` renders a Stack with `headerShown: false`, so nothing consumes the status-bar or navigation-bar inset. L138 is a bare `px-6 py-12`: 48px of bottom padding is all that stands between the primary Guardar button and the system navigation bar, which is 48dp on a 3-button device. There is no KeyboardAvoidingView and no IME inset, so with the keyboard open the button can sit under it. Compounding this, 15 of 16 controls measure 44dp against Android's 48dp minimum. DESIGN.md's central platform claim — Android is the primary adaptation target — is unimplemented in the one place it is asserted.
**Fix:** Consume `useSafeAreaInsets()`; paddingTop `insets.top + 24`, paddingBottom `insets.bottom + 32`; add the IME inset or KeyboardAvoidingView with `keyboardShouldPersistTaps="handled"`. Raise chip/input padding from `py-3` to `py-3.5` to clear 48dp. Verify on a 3-button-nav device at font_scale 1.3, not in the desktop browser.
**Suggested command:** `/impeccable adapt`

### [P1] One error at a time, at the bottom, detached from its field, in Postgres's own words
**Why it matters:** lib/pets.ts:53 returns `Object.values(errors)[0]` — only the first error even when three fields are invalid. It renders at L307, below all eight groups, so the field it names may be scrolled off-screen. No scroll-to-error, no field-level state, no `accessibilityLiveRegion`, so TalkBack announces nothing. On server failure, lib/pets.ts:73 passes raw Supabase English into the Spanish UI. An empty name plus no sex plus a mistyped date costs three submit round-trips. DESIGN.md's "one error block below the group" was written for a two-field login; at eight groups the convention has broken, and DESIGN.md says so itself.
**Fix:** Return the full `errors` map; render per-field messages beneath the offending input with a `border-error` 1px hairline; reserve the block for RPC/network failures; scroll the first invalid field into view; add `accessibilityLiveRegion="polite"`; map RPC failures to Spanish.
**Suggested command:** `/impeccable harden`

### [P2] Selection rests on a 1px hairline; the tonal step is measurably invisible
**Why it matters:** a selected chip is Elevated Frost #1E293B on a Fjord Slate #131C2E resting fill — **1.16:1 measured**, imperceptible on a phone in daylight. So "which chip is selected" rests entirely on the 1px accent border. Twelve chips on this screen, no checkmark, no weight change. DESIGN.md's own "Don't communicate selected state by color alone" is violated by the system's chip spec, and PRODUCT.md claims that property as already built. On a form that is 12 chips wide, the user cannot scan back and verify their answers before an irreversible Guardar. Separately, L172's Mars/Venus glyphs are almost certainly outside Outfit's charset and will silently fall back to Roboto on Android — a One Family Rule breach mid-screen.
**Fix:** Keep the accent border, add a non-colour cue inside the system: selected label at weight 700, or a genuinely visible fifth tonal step for the selected fill. Drop the glyphs or use words.
**Suggested command:** `/impeccable colorize`

## Persona Red Flags

**Jordan (Confused First-Timer)**
- Cannot tell which of eight fields are required; the only way to find out is to press Guardar and read one error at a time.
- "Nivel de actividad" arrives pre-set to "Moderado" with no explanation of what the app does with it. Is Moderado right for an 8-week-old puppy?
- `AAAA-MM-DD` must be decoded, and the hint vanishes on the first keystroke — on a field whose placeholder also fails AA contrast at 3.58:1.
- `Es mestizo?` (L192) arrives after Jordan has already typed a breed, forcing reinterpretation of the answer above.
- No confirmation that Guardar succeeded. The end state is a stub reading "Hoy".

**Casey (Distracted Mobile User)**
- **Zero state persistence.** `draft` is component state (L24-33) with no draft storage, though `@react-native-async-storage/async-storage` is already a dependency. A call or Android reclaiming the process loses all eight answers silently.
- Android Back exits and discards everything with no "Descartar?" prompt.
- No `keyboardType` on the date, no `returnKeyType="next"` chaining, so Casey re-taps between fields and gets an alphabetic keyboard for a numeric task.
- The primary action is at the bottom of a scroll and is not pinned.
- **Correction from measurement:** the chips do NOT clear Material's 48dp target. They measure 44dp. Every chip, input and the retry button is 4dp short.

**Sam (Accessibility-Dependent)**
- **Zero accessibility props in the entire `app/` tree** — confirmed by grep and at runtime.
- The three TextInputs carry labels as sibling `<Text>` nodes with no `nativeID` link; TalkBack announces three unnamed edit boxes.
- The 12 chips have no `accessibilityRole="radio"` and no `accessibilityState={{ selected }}`, so selection is unavailable to TalkBack and near-invisible visually. Both channels fail at once.
- The error has no live region: pressing Guardar produces silence.
- No focus treatment on any input or button, breaking switch-access and Bluetooth-keyboard use.
- Honest weighting: PRODUCT.md records no specific accessibility need for either household member, so these are P2-class for this audience. But PRODUCT.md also asserts "no state communicated by color alone" as already built, and on this screen that claim is false.

**Ainara (project-specific: household tutor)**
*40s, non-technical, Spanish-speaking, mid-range Android with system font size bumped up, filling this in on the sofa after bringing an 8-week-old puppy home. Does not know Loki's exact birthdate — the breeder said "principios de septiembre".*
- The one thing she knows is his name. The screen asks eight things and marks none optional, so she believes she must answer all of them tonight, and will guess permanently.
- **The accommodation is announced and then withheld.** `Fecha aproximada? -> Si` exists, but L220 still demands a full day to get there. She will invent a day, and that invented day silently anchors every vaccine and deworming due date.
- `Esterilizado?` on an 8-week-old: the true answer is "no, y lo estamos hablando con el veterinario" — which PRODUCT.md names as a note the tutors specifically want to keep. "No" is truthful but reads as a settled clinical fact.
- At Android font scale 1.3 her chips grow to ~55dp and "Moderado" nears wrapping inside a 96dp chip. Nothing in this layout has been verified at that scale.
- **The screen has no concept of the second tutor.** If her partner signs in with his own Google account he reaches this same form; `getMyPet` is per-account and `pet_owners` sharing has no UI. The household ends up with two Lokis and no way to merge or remove either.

## Minor Observations

- `mb-5` (20px) separates all eight groups; DESIGN.md's 32-40px section rhythm appears exactly once, at `mb-8` (L290). The system offers a grouping tool the screen never picks up.
- Busy state diverges from both DESIGN.md and its sibling screen: DESIGN.md specifies the label is replaced by a centred spinner, and login.tsx does exactly that; L320 swaps in the text "Guardando...". Same component, two behaviours, one app.
- All eight labels drop the Label role's specified +0.05em tracking.
- The retry block (L87-100) is byte-identical to app/index.tsx:52-62. Duplicated markup that will drift.
- `breed_secondary: null` is hardcoded (lib/pets.ts:64) while `isMixed` is now a real user answer — answering "mestizo: Si" produces a record that says mixed and can name only one breed.
- Two spacing values sit off the named 8/12/20/32/40 scale: `mb-4` (L90) and `py-12` (L138). Separately, the `px-4`/`py-4`/`px-6` values match DESIGN.md's component recipes but not its named scale — a gap in the design record, not in this file.
- e2e/onboarding.spec.ts pins only the happy path and "an error is visible" — it asserts nothing about which error, so the one-error-per-submit behaviour and the pre-selected chips are free to fix without touching tests.
- The 11 raw hex literals are all legitimate RN props with exact token values, but there is no shared token module, so they are hand-copied and will drift.

## Questions to Consider

1. **Why is this a form at all?** The household has one dog and knows his name. What if Guardar were reachable after one field, and every other question surfaced later, in context, at the moment it first matters — breed when you first log a weight, esterilizacion at the first vet visit, actividad possibly never?
2. **What does the app actually do with "Nivel de actividad"?** If nothing in v0 reads it, it is a question asked to fill a column. Delete it and reclaim an eighth of the screen.
3. **Should the birthdate be a date?** The real case is a puppy whose birth week is hearsay. What if it were month + year with an optional exact day — the approximation built into the input rather than confessed by a chip beside it?
4. **Who is the second tutor in this screen's model of the world?** Today both household members each create their own Loki.
5. **If nothing here can be edited yet, is the honest v0 move to ask for less rather than to add a review step?**
6. **What would this screen look like if it had been designed with a 360dp Android phone at font scale 1.3 and a 3-button nav bar in front of the designer, instead of a desktop browser?**
