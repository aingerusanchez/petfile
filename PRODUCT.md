# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

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
- Explicitly undecided: the tutor-invitation mechanism for v1 (6-digit code vs. direct link); whether sterilization/mixed-breed/approximate-birthdate fields join the onboarding form now or as a fast-follow (flagged after the foundation branch's final review, not yet resolved); cosmetic app identity (icon/splash colors, license file) still carries Expo's scaffold defaults.

## Brand Commitments

"Nordic Ice" visual identity — a dark-mode-only palette and the Outfit typeface — is a fixed constraint the user chose to carry into this project and preserve, kept as the one visual constraint while everything else was decided fresh. Token values are implemented in `global.css`.

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
