# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Pet tutors managing a dog's day-to-day care and health. Private, non-commercial household use — not a public or commercial product.

## Product Purpose

Log a dog's daily routines (walks, meals, medication) and health events (weight, vaccinations, deworming, incidents) with minimal friction, so no tracking data is lost during his critical early months. Success is real, sustained use — an entry logged after the walk or the vet visit, not an app that looks complete but goes unused.

## Positioning

Built on a relational data model from day one, so that adding a second tutor or a second pet later is additive — a new row, never a schema redesign.

## Operating Context

Logging is mostly retrospective, not real-time during the event itself: a walk or a vet visit occupies the tutor's hands and attention, so the normal pattern is to log it after getting home, not mid-walk or mid-consultation. Concrete examples: logging a walk on returning home (whether the dog pooped and its state, any incident, an optional note) — a future version could even auto-detect "arrived home" via reconnecting to the home wifi; after a vet visit, logging the deworming/vaccine applied, letting the next due date calculate itself, updating weight, and keeping notes from the conversation with the vet (e.g. diet — kibble vs. natural food, pros and cons — or a possible spay/neuter date). Google sign-in requires a native development build; Expo Go cannot complete the OAuth redirect. A web export exists as a secondary target, not the primary one.

## Capabilities and Constraints

- v0 (current): single user, Google OAuth only — no email/password UI, no development-mode auth bypass in any environment. Daily routines and health events both ship from day one (not sequenced). Weight is tracked as a simple line, without the breed-percentile comparison band. Due-date alerts (vaccines, deworming) surface inside the app only — no push notifications yet.
- Data model already supports v1 (sharing via `pet_owners`) and v2 (multiple pets/species) without restructuring; the UI for either doesn't exist yet.
- **Onboarding field hierarchy (resolved 2026-09-07, replacing the earlier "fast-follow?" question).** The pet form has three tiers, and the distinction is about what blocks a save, not about what is worth collecting:
  - _Required_ — name, sex, birth date (with its approximate flag). Validation blocks submission. The birth date is required deliberately: it is not a per-interest field like the ones below but a basic input that many later flows depend on from the start, and it anchors the vaccine and deworming due-date calculations.
  - _Required_ also includes sex, for now. Making it optional was considered on 2026-09-08 — it is arguably the same category as breed, an identification datum the product computes nothing from — but `pets.sex` is `not null` in the initial schema, so relaxing it in the app alone produces a save the database rejects. Left required deliberately; revisit with the migration, not before.
  - _Identity, optional_ — breed (with its mixed-breed flag). Does not block submission, but sits with the required fields rather than below them: name, breed and age (derived from the birth date) are what let a tutor tell one animal from another once more than one exists.
  - _Optional, deferrable_ — sterilisation, activity level. Kept in the data model because they feed weight tracking and future nutritional guidance, not dropped. The onboarding form offers a secondary "fill in more details" disclosure for them, but the intended path is to ask each one when a flow that depends on it starts (sterilisation at a health or nutrition flow, not at signup).
- **An approximate birth date means month + year only** (resolved 2026-09-07). Stored as `YYYY-MM-01` with `birth_date_approximate = true`, which the initial schema already supports — no migration needed. Any consumer that computes a due date must read that flag: the day is a placeholder, not data, and treating it as real reintroduces exactly the invented-date problem the flag exists to prevent.
- **Dates are entered and displayed in the Spanish locale format `DD/MM/AAAA`** (resolved 2026-09-07); a per-user format setting is a future version, not v0. The wire format stays ISO `YYYY-MM-DD` because the `birth_date` column is a Postgres `date` and the RPC casts with `::date`, where a non-ISO string is ambiguous. Conversion is two pure functions at the edge in `lib/`, not a translation layer between the app and Supabase.
- **Duplicate-pet-name warning is a v2 requirement, not a v0 one** (resolved 2026-09-07). It should be a non-blocking warning that helps a tutor spot an accidental duplicate, but v0 is single-pet — onboarding redirects away once a pet exists and `getMyPet` returns one row per account — so there is no code path that could trigger it yet. It belongs with the multi-pet form, alongside the undecided invitation mechanism.
- **Resolved additions to the visual system** (2026-09-07): checkbox, breed combobox with autocomplete, and an in-app date picker join the component set, and the app gains its first iconography. These are recorded in DESIGN.md as they are built, not before — DESIGN.md describes what ships. Two constraints came out of the decision: a checkbox or check glyph must not be a Unicode character (the Outfit typeface's charset does not cover them, so they silently fall back to another family, which the existing sex-chip glyphs already do), and the date picker is built in-house rather than delegated to the platform, because `@expo/ui`'s DateTimePicker renders nothing at all on the web target used for development and has no month-and-year mode.
- Explicitly undecided: the tutor-invitation mechanism for v1 (6-digit code vs. direct link); cosmetic app identity (icon/splash colors, license file) still carries Expo's scaffold defaults.
- Android is the platform the app actually ships to and is used on — both household members install and run it there. The browser is the development and QA harness (most visual work is judged there first), and a web export exists as a secondary target, but the delivered product is an Android app. iOS is buildable from the same React Native codebase but is not a target for anyone in the household. The visual system stays uniform regardless (see Brand Commitments).

## Brand Commitments

**Celebration.** Registering the pet is worth marking with a confetti effect — approved 2026-09-08. It earns the exception because v0 is single-pet: onboarding runs _once in an account's life_, so the effect can never become the repeated noise that usually ruins it. Two conditions: it must be disableable exactly like every other animation in the app (the system "remove animations" setting, via `useReducedMotion()`), and it must be hosted above the navigator like the toast, or the success navigation will unmount it before it lands.

**Voice.** The app speaks like a household, not like enterprise software. Prefer warm, specific wording over neutral system verbs — a primary action reads "¡Vamos Loki!" or "Añadir mascota", never "Guardar" or "Enviar" — and use the animal's own name wherever it is known, which is also the only reliable way a tutor sees their input read back. Playful phrasing drawn from the product's world (pets, walks, vet visits, training) is welcome where it does not obscure what a control does; the moment a joke makes an action ambiguous, the action wins. Copy stays in Spanish.

"Nordic Ice" visual identity — a dark-mode-only palette and the Outfit typeface — is a fixed constraint the user chose to carry into this project and preserve, kept as the one visual constraint while everything else was decided fresh. Token values are implemented in `global.css`. It governs every platform as one uniform system: adapt it to each platform's physical constraints (safe areas, native gesture zones) rather than swapping in platform-native components (SF Symbols, Material 3 widgets) to satisfy per-OS conformance. Android is the primary adaptation target — the physical constraints that govern layout decisions are Android's (status and system navigation bars, gesture insets, back-gesture edges, the range of Android screen densities). Web is the development surface and a secondary export, not the platform the design is tuned for.

## Evidence on Hand

None. No photos, logos, or press exist for this project — it is a private household tool. Future design work must not fabricate testimonials, reviews, press mentions, or sample data beyond what the product itself generates.

## Product Principles

- Ship something usable today over a complete feature set; the MVP evolves with real use, not ahead of it.
- Never lose tracking data — the app's core promise during Loki's critical early months.
- Grow the data model, not rebuild it: sharing and multi-pet support must stay additive.
- Low-friction capture beats completeness — logging happens after the fact (back home, after the vet), so it should be quick to fill in retrospectively, not built to survive real-time, one-handed use.
- Be honest about gaps in the product and its docs — no implied capability (a dev bypass, CI/CD, automation) that doesn't exist yet.

## Accessibility & Inclusion

No specific accessibility need identified for either household member (confirmed with the user). General good practice is already built into the design tokens: WCAG AA contrast on the Nordic Ice palette, no state communicated by color alone, and standard mobile touch-target sizing.
