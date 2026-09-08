# AGENTS.md

This file provides guidance to agentic AI tools when working with code in this repository.

## Constraints

- Package manager: **pnpm** only. pnpm's default symlinked `node_modules` breaks Metro and native builds, so the repo root carries an `.npmrc` / `pnpm-workspace.yaml` forcing `node-linker=hoisted` (a flat, npm-like `node_modules`). Never remove that setting or run `pnpm install` without it in place.
- TypeScript **strict mode** is enabled; no `any` in committed code.
- Dark mode only in v0. Every colour comes from the Nordic Ice tokens — no raw hex values in components.
- Screens must never import `@supabase/supabase-js`. The only import site in app code is `lib/supabase.ts` — `e2e/auth.ts` also uses `createClient` directly, but that is test setup, not app runtime.
- Conventional Commits for every commit (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `build:`).
- **v0 auth is Google OAuth only.** Magic links are out of scope for v0. There is **no development-mode auth bypass** — every environment, including local dev, requires a real Google sign-in. Do not add one, and do not write code or docs that imply one exists.
- **Google OAuth requires a native dev build.** Expo Go cannot handle the custom-scheme redirect this flow needs. `pnpm android` / `pnpm ios` produces the dev build; the web target runs under `pnpm web`.
- **The Android toolchain needs JDK 17.** A newer JDK fails the CMake configuration tasks with "A restricted method in java.lang.System has been called": JEP 472 escalates native access from an unnamed module to an error from JDK 24 on, and AGP trips it. Gradle 9.3.1 itself supports up to JDK 25, so this is AGP against the JDK rather than a Gradle limit. Point `JAVA_HOME` at a JDK 17.
- **`android/` and `ios/` are generated and gitignored.** After changing `scheme`, `android.package` or anything else identity-shaped in `app.json`, regenerate with `npx expo prebuild --clean -p android` — an existing directory keeps the old values.

## Secrets

- `.env` is gitignored and is filled in **by the user only**. No agent may `cat`, `Read`, `grep`, `echo`, or otherwise print its contents, and no key value may ever appear in a commit, a log, a test fixture, or the conversation. Agents needing the values run the process that reads `.env` — they do not read it themselves.
- `.env.example` is committed with placeholders only.
- **`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are not secrets.** Every `EXPO_PUBLIC_*` variable is inlined into the client bundle and is extractable by anyone with the app. The anon/publishable key is a public identifier; data is protected by the RLS policies in `supabase/migrations/`, not by hiding it.
- **Actual secrets, which never enter the repo or any agent's context:** the Supabase `service_role` key (unused in v0 — the app must never reference it) and the Google OAuth **client secret**, which is pasted directly into the Supabase dashboard so that Supabase performs the token exchange server-side.
- The pre-commit hook (`.githooks/pre-commit`) blocks committing `.env` (or any `.env*` other than `.env.example`) and content shaped like a secret (`service_role` assignments, Supabase JWTs, `sb_secret_...`, `GOCSPX-...`). `pnpm install` wires it via the `prepare` script (`git config core.hooksPath .githooks`). Never bypass it with `--no-verify`.
- For future EAS builds, secrets go in EAS environment variables (encrypted server-side), never in the repo.

## Commands

```bash
pnpm install            # install deps (wires the pre-commit hook via `prepare`)
pnpm start              # expo start
pnpm web                # expo start --web
pnpm android            # expo run:android — compiles, installs and launches the native dev build
pnpm ios                # expo run:ios — same for iOS
                        # `pnpm start` then `a` attaches to an already-installed dev build
                        # without recompiling. Google sign-in needs one of these, never Expo Go.
pnpm test               # Jest — pure domain logic (pet validation, RPC mapping)
pnpm test:e2e           # Playwright end-to-end
pnpm test:e2e:ui        # Playwright end-to-end, UI mode / trace viewer
pnpm lint               # expo lint — currently broken, no ESLint config in the repo; do not attempt to fix as a side effect of another task
```

## Definition of done

- `pnpm test` passes.
- `pnpm test:e2e` passes.
- No new raw hex colours; only Nordic Ice tokens.
- No screen imports `@supabase/supabase-js` directly.
- No secret material (service_role key, Google client secret, `.env` contents) appears in a diff, commit, log, or test fixture.
- Commit messages follow Conventional Commits.

## Commits

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `build:`, …), imperative mood, lowercase description, no trailing period. One commit = one purpose — don't mix a feature with an unrelated refactor.

## Architecture

Expo Router file-based routing over a Supabase backend.

```
app/                     → Expo Router routes (routes only — no shared UI)
  (auth)/                → login
  (tabs)/                → authenticated shell (home, health, profile)
components/ui/            → the design-system primitives every screen composes
  Screen.tsx              → page container; the only place window insets are consumed
  Chip.tsx                → selector chip + ChipGroup (exclusive single-select row)
  Group.tsx               → hairline-outlined form section
  Toast.tsx               → transient message; ToastProvider hosts it above the navigator
  Celebration.tsx         → one-shot confetti; CelebrationProvider hosts it above the navigator
  Checkbox.tsx            → voluntary boolean flag, unchecked by default
  DateField.tsx           → date display + in-house picker (month+year when approximate)
  BreedField.tsx          → breed combobox: suggests from a list, accepts free text
  TextField.tsx           → labelled input, label linked for screen readers
  FieldLabel.tsx          → the uppercase field label
  Button.tsx              → secondary / ghost button
  LoadingScreen.tsx       → full-screen busy state
  tokens.ts               → Nordic Ice values for RN props className can't reach
lib/                      → domain logic and data access
  supabase.ts             → the only import site for @supabase/supabase-js in app code
  auth.tsx                → session context / Google OAuth
  pets.ts                 → pet validation + the create-pet RPC call
supabase/migrations/      → Postgres schema, RLS policies, RPC functions
e2e/                       → Playwright specs + sign-in helpers
```

All database access goes through `lib/supabase.ts`; screens never import `@supabase/supabase-js` directly. The one legitimate exception lives outside app code: `e2e/auth.ts` builds its own client to seed the Playwright session and reset test data. Pet creation is atomic via a `security definer` Postgres function (`create_pet_with_owner`) that writes both the `pets` row and its `pet_owners` membership in one transaction, so a pet can never exist without an owner.

There is no `households` concept in the data model. `pets` relates to users through the `pet_owners` join table (RLS-protected), which is what makes multi-user sharing in a future version an `insert` into `pet_owners`, not a schema redesign.

Pure validation logic lives in `lib/` and is unit-tested with Jest; user-facing flows are tested with Playwright against the Expo web build.

Dates cross the app/database boundary in exactly one format: **ISO `YYYY-MM-DD`**, because `pets.birth_date` is a Postgres `date` and the RPC casts with `::date`, where Postgres's DateStyle makes a `DD/MM/AAAA` string ambiguous. The UI shows and collects the Spanish locale's `DD/MM/AAAA`; `lib/dates.ts` converts at the edge and is the only place that builds or parses a date string. An approximate birth date stores the 1st of the month with `birth_date_approximate = true` — **anything computing a due date must read that flag**, because the day is a placeholder, not data.

Shared UI lives in `components/ui/`, never in `app/` — `app/` holds routes. Two invariants come with it: **window insets are consumed only in `Screen`** (no screen reaches for `useSafeAreaInsets()` on its own, which is what keeps the primary action clear of the Android navigation bar in one place), and **a colour needed by a React Native prop comes from `components/ui/tokens.ts`**, never a retyped hex literal. `global.css`'s `@theme` block stays the source of truth for anything a `className` can reach.

## Documentation maintenance

Update README.md whenever you touch one of these:

| If you change…                         | Update…                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json` scripts                 | README (Scripts)                                                                 |
| `package.json` dependencies (versions) | README (Stack tecnológico)                                                       |
| `supabase/migrations/`                 | README (Arquitectura), `docs/supabase-setup.md` if the setup flow itself changes |
| `.env.example`                         | README (Secretos)                                                                |
| Adding `eas.json` / a real CI workflow | README (Compilación de producción / CI/CD)                                       |
