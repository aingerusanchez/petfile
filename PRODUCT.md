# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary user (v0): Aingeru, tracking his dog Loki (Husky Siberiano, in his puppy months) solo, from his phone. v1 expands to his partner as a second tutor of the same dog, sharing the same data. No broader public audience — this is a private household tool, not a commercial product.

## Product Purpose

Log Loki's daily routines (walks, meals, medication) and health events (weight, vaccinations, deworming, incidents) with minimal friction, so no tracking data is lost during his critical early months. Success is real, sustained use — an entry logged during an actual walk, not an app that looks complete but goes unused.

## Positioning

Deliberately lighter and faster to ship than its parked sibling project, PetFile (Angular + Firebase, a more ambitious multi-device/household model for the same problem). Petlife is built on Postgres/Supabase from day one specifically so that sharing with a second tutor (v1) is an `insert` into a join table, not a schema redesign — it buys the same eventual capability as PetFile without PetFile's setup cost, by choosing to ship a narrower v0 today.

## Operating Context

Used primarily on a phone, frequently outdoors mid-walk — the spec's own interaction design (swipe-to-complete/skip a routine) exists because logging has to survive being done one-handed, on the move, without full attention. Google sign-in requires a native development build; Expo Go cannot complete the OAuth redirect. A web export exists as a secondary target, not the primary one.

## Capabilities and Constraints

- v0 (current): single user, Google OAuth only — no email/password UI, no development-mode auth bypass in any environment. Daily routines and health events both ship from day one (not sequenced). Weight is tracked as a simple line, without the breed-percentile comparison band. Due-date alerts (vaccines, deworming) surface inside the app only — no push notifications yet.
- Data model already supports v1 (sharing via `pet_owners`) and v2 (multiple pets/species) without restructuring; the UI for either doesn't exist yet.
- Explicitly undecided: the tutor-invitation mechanism for v1 (6-digit code vs. direct link); whether sterilization/mixed-breed/approximate-birthdate fields join the onboarding form now or as a fast-follow (flagged after the foundation branch's final review, not yet resolved); cosmetic app identity (icon/splash colors, license file) still carries Expo's scaffold defaults.

## Brand Commitments

"Nordic Ice" visual identity — a dark-mode-only palette and the Outfit typeface — carried over deliberately from the sibling PetFile project at the user's explicit request, kept as the one visual constraint while everything else about the stack changed. Token values are implemented in `global.css`.

## Evidence on Hand

None. No photos, logos, or press exist for this project — it is a private two-person household tool. Future design work must not fabricate testimonials, reviews, press mentions, or sample data beyond what the product itself generates.

## Product Principles

- Ship something usable today over a complete feature set; the MVP evolves with real use, not ahead of it.
- Never lose tracking data — the app's core promise during Loki's critical early months.
- Grow the data model, not rebuild it: sharing and multi-pet support must stay additive.
- Low-friction capture beats completeness — logging must survive being done one-handed, outdoors, mid-walk.
- Be honest about gaps in the product and its docs — no implied capability (a dev bypass, CI/CD, automation) that doesn't exist yet.

## Accessibility & Inclusion

No specific accessibility need identified for either household member (confirmed with the user). General good practice is already built into the design tokens: WCAG AA contrast on the Nordic Ice palette, no state communicated by color alone, and touch targets sized for one-handed mobile use.
