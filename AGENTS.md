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
- **`pnpm android` depends on the phone reaching the Mac over WiFi.** It launches the app pointed at the dev server's **LAN IP**, so mobile data, another network or a firewalled port 8081 leaves the app sitting on the splash screen with no error at all — nothing in the log says the bundle never arrived. `pnpm android:usb` (`expo start --localhost --dev-client --android`) serves on `127.0.0.1` through the `adb reverse` Expo sets up itself, so it works on the cable alone. `--dev-client` is not optional there: without it the CLI opens `exp://`, which lands in **Expo Go** on a phone that has it installed, and Google sign-in cannot work there.
- **The Android toolchain needs JDK 17.** A newer JDK fails the CMake configuration tasks with "A restricted method in java.lang.System has been called": JEP 472 escalates native access from an unnamed module to an error from JDK 24 on, and AGP trips it. Gradle 9.3.1 itself supports up to JDK 25, so this is AGP against the JDK rather than a Gradle limit. Point `JAVA_HOME` at a JDK 17.
- **`android/` and `ios/` are generated and gitignored.** After changing `scheme`, `android.package` or anything else identity-shaped in `app.json`, regenerate with `npx expo prebuild --clean -p android` — an existing directory keeps the old values.

## Secrets

- `.env` is gitignored and is filled in **by the user only**. No agent may `cat`, `Read`, `grep`, `echo`, or otherwise print its contents, and no key value may ever appear in a commit, a log, a test fixture, or the conversation. Agents needing the values run the process that reads `.env` — they do not read it themselves.
- `.env.example` is committed with placeholders only.
- **`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are not secrets.** Every `EXPO_PUBLIC_*` variable is inlined into the client bundle and is extractable by anyone with the app. The anon/publishable key is a public identifier; data is protected by the RLS policies in `supabase/migrations/`, not by hiding it.
- **Actual secrets, which never enter the repo or any agent's context:** the Supabase `service_role` key (unused in v0 — the app must never reference it) and the Google OAuth **client secret**, which is pasted directly into the Supabase dashboard so that Supabase performs the token exchange server-side.
- The pre-commit hook (`.githooks/pre-commit`) also **formats what is being staged** with Prettier and re-stages it, so class order and code style are decided once rather than churning between editors. One sharp edge: a partially staged file (`git add -p`) gets the rest of its working copy staged too, because Prettier rewrites whole files. The hook blocks committing `.env` (or any `.env*` other than `.env.example`) and content shaped like a secret (`service_role` assignments, Supabase JWTs, `sb_secret_...`, `GOCSPX-...`). `pnpm install` wires it via the `prepare` script (`git config core.hooksPath .githooks`). Never bypass it with `--no-verify`.
- For future EAS builds, secrets go in EAS environment variables (encrypted server-side), never in the repo.

## Commands

```bash
pnpm install            # install deps (wires the pre-commit hook via `prepare`)
pnpm start              # expo start
pnpm web                # expo start --web
pnpm android            # expo run:android — compiles, installs and launches the native dev build
pnpm android:usb        # relaunch the installed dev build over the cable, no rebuild
pnpm ios                # expo run:ios — same for iOS
                        # `pnpm start` then `a` attaches to an already-installed dev build
                        # without recompiling. Google sign-in needs one of these, never Expo Go.
pnpm test               # Jest — pure domain logic (pet validation, RPC mapping)
pnpm test:e2e           # Playwright end-to-end
pnpm test:e2e:ui        # Playwright end-to-end, UI mode / trace viewer
pnpm android:apk        # a standalone release APK, arm64 only — no Metro, no cable after install
pnpm android:install    # adb install -r of that APK
pnpm format             # prettier --write . (the pre-commit hook does this for staged files)
pnpm format:check       # prettier --check .
pnpm lint               # eslint . — flat config on eslint-config-expo, plus this project's invariants
pnpm lint:fix           # eslint . --fix
```

## Linting

`eslint.config.js` extends `eslint-config-expo/flat` and adds the rules that matter here. Three of them enforce invariants this file used to state and nobody could check:

- **`Text` is never imported from `react-native`** outside `components/ui/Text.tsx` — the wrapper is the only thing applying the typeface on native.
- **`@supabase/supabase-js` is never imported** from `app/` or `components/`.
- **No `any`** in committed code.

Two more are errors rather than Expo's default warnings, because they catch defects that look like data bugs: `react-hooks/exhaustive-deps` and the React Compiler rules (`react-hooks/refs`, `react-hooks/set-state-in-effect`). The last one is worth knowing about before writing an effect: **an effect that keeps one piece of state in step with another is almost always derived state**, and it will be reported. Both forms' "forgive on input" and both has-pet checks were rewritten that way.

**ESLint is pinned to 9.** `eslint-plugin-react` (via `eslint-config-expo`) is not compatible with 10 — it fails with `contextOrFilename.getFilename is not a function` before linting a single file.

## Definition of done

- `pnpm lint` passes.
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
  Fab.tsx                 → the floating action, and the menu it opens
  Slider.tsx              → one value along a range, in-house rather than native
  Chip.tsx                → selector chip + ChipGroup (exclusive single-select row)
  Group.tsx               → hairline-outlined form section
  Toast.tsx               → transient message; ToastProvider hosts it above the navigator
  Celebration.tsx         → one-shot confetti; CelebrationProvider hosts it above the navigator
  Checkbox.tsx            → voluntary boolean flag, unchecked by default
  DateField.tsx           → date display + in-house picker (month+year when approximate)
  BreedField.tsx          → breed combobox: suggests from a list, accepts free text
  TextField.tsx           → labelled input; label linked for readers, unit inside the field
  FieldLabel.tsx          → the uppercase field label
  Text.tsx                → text in the app's typeface; the only Text app code imports
  Avatar.tsx              → the pet's photo, or its initial when there is none
  AvatarEditor.tsx        → framing that photo against the circle it appears in
  Button.tsx              → primary / outlined / secondary / link, with a danger tone
  LoadingScreen.tsx       → full-screen busy state
  tokens.ts               → Nordic Ice values for RN props className can't reach
lib/                      → domain logic and data access
  supabase.ts             → the only import site for @supabase/supabase-js in app code
  auth.tsx                → session context / Google OAuth
  pets.ts                 → pet validation, create, edit and delete
  photos.ts               → the pet's photo: pick, upload, and sign a read URL
  failures.ts             → the timeout on every request, and its message in the app's voice
  dates.ts                → the ISO/DD-MM-AAAA conversion at the edge
  age.ts                  → the age from a birth date, and the life stage it lands in
  framing.ts              → the crop maths behind the avatar editor
  duration.ts             → minutes in and out of "1h 30m"
  breeds.ts               → the breed list and what counts as "mestizo"
supabase/migrations/      → Postgres schema, RLS policies, RPC functions
e2e/                       → Playwright specs + sign-in helpers
```

All database access goes through `lib/supabase.ts`; screens never import `@supabase/supabase-js` directly. The one legitimate exception lives outside app code: `e2e/auth.ts` builds its own client to seed the Playwright session and reset test data. Pet creation is atomic via a `security definer` Postgres function (`create_pet_with_owner`) that writes both the `pets` row and its `pet_owners` membership in one transaction, so a pet can never exist without an owner.

There is no `households` concept in the data model. `pets` relates to users through the `pet_owners` join table (RLS-protected), which is what makes multi-user sharing in a future version an `insert` into `pet_owners`, not a schema redesign.

Pure validation logic lives in `lib/` and is unit-tested with Jest; user-facing flows are tested with Playwright against the Expo web build.

**The pet's photo lives in Storage, and `pets.photo_url` holds an object path rather than a URL.** The `pet-photos` bucket is private (`0005_pet_photos_bucket.sql`), because a public bucket would be the one place where holding a link beats the RLS policies; `lib/photos.ts` signs a one-hour URL at render time. The path is `<pet_id>/avatar.<ext>` and writes upsert, so a pet has exactly one photo and a replacement leaves no orphan. Storage policies resolve ownership through `pet_owners`, the same join table the `pets` policies use.

**The pet's photo is framed by the app, not by the OS.** `expo-image-picker` runs with `allowsEditing: false` so the whole image arrives, `components/ui/AvatarEditor.tsx` frames it against the circle it will appear in, and `lib/framing.ts` turns the stage geometry into a crop rectangle that `expo-image-manipulator` applies. The maths is in `lib/` and unit-tested for one reason: a wrong crop rectangle does not throw, it cuts the dog's ear off or asks for a pixel past the image's edge, which the native manipulator rejects outright. **`expo-image-manipulator` is a native module** — after pulling this change, a dev build has to be recompiled (`pnpm android`), not just reloaded.

**`prettier-plugin-tailwindcss` will break a class string that carries its own separator.** It sorts the classes inside a quoted string and trims it, so `` `text-primary${on ? " font-bold" : ""}` `` becomes `` `text-primary${on ? "font-bold" : ""}` `` — which compiles to `text-primaryfont-bold` the moment the condition is true. It happened to the chip and the checkbox on the commit that added the plugin, silently. **Keep the separator in the template literal, never inside the quotes** (`` `...primary ${on ? "font-bold" : ""}` ``); a trailing space in a class list costs nothing. `components/__tests__/class-strings.test.ts` fails on any ``className={`…x${`` with no space before the interpolation, so this cannot come back unnoticed.

**Installing on a phone without the Mac.** `pnpm android:apk` builds a standalone release APK (arm64 only, ~44 MB) with the JS bundle embedded, at `android/app/build/outputs/apk/release/app-release.apk`. `pnpm android:install` pushes it over `adb`, or copy the file to the phone and open it. It needs no Metro and no cable once installed, which is what makes the app usable during the day. Two things to know: the release build is signed with the **debug keystore** (Expo's template default), so `npx expo prebuild --clean` regenerates that key and Android will then refuse to install over the existing app — uninstall first; and `EXPO_PUBLIC_*` values are inlined at build time, so the APK carries whatever `.env` held when it was built.

**One validator, two forms.** `validatePetDraft` takes `PetDraft | PetEdit` and both the registration and profile screens call it; the mixed-breed coupling (`isMixedShown`, `withMixed`) lives in `lib/pets.ts` for the same reason. The two screens duplicate their _layout_ deliberately — extracting a shared form is a pending job — but anything that would be a bug if it drifted is in `lib/` and unit-tested.

Dates cross the app/database boundary in exactly one format: **ISO `YYYY-MM-DD`**, because `pets.birth_date` is a Postgres `date` and the RPC casts with `::date`, where Postgres's DateStyle makes a `DD/MM/AAAA` string ambiguous. The UI shows and collects the Spanish locale's `DD/MM/AAAA`; `lib/dates.ts` converts at the edge and is the only place that builds or parses a date string. An approximate birth date stores the 1st of the month with `birth_date_approximate = true` — **anything computing a due date must read that flag**, because the day is a placeholder, not data.

Shared UI lives in `components/ui/`, never in `app/` — `app/` holds routes. Three invariants come with it: **window insets are consumed only in `Screen`** (no screen reaches for `useSafeAreaInsets()` on its own, which is what keeps the primary action clear of the Android navigation bar in one place), **a colour needed by a React Native prop comes from `components/ui/tokens.ts`**, never a retyped hex literal, and **`Text` is imported from `components/ui`, never from `react-native`** — that wrapper is the only thing applying the typeface on native, where a bare `<Text>` falls back to Roboto (`grep -rnE '\bText\b' app components | grep 'from "react-native"'` should return nothing outside `components/ui/Text.tsx` — the word boundaries keep `TextInput` out). `global.css`'s `@theme` block stays the source of truth for anything a `className` can reach.

Three platform gotchas the browser hides, all measured on device and recorded in DESIGN.md:

- A `TextInput` needs **`pl-4 pr-4` rather than `px-4`** — Android drops `padding-inline` on text inputs.
- The native CSS compiler resolves **`1rem` to 14, not 16**, so every rem-based utility renders at 87.5% of what the browser shows.
- **`leading-*` does nothing on native.** It arrives as a `calc()`, which that compiler discards, so line height comes from a `style` prop. Anything that has to line up with a class-sized box needs both sides as literals from one constant — see `components/ui/Checkbox.tsx`.
- **`pointerEvents` needs `box-none` from a _registered_ style, and nothing else works on both targets.** All three wrong ways were tried, and each looked right on one platform:
  - the **prop** is deprecated in this React Native version and logs a warning per render;
  - `box-none` in an **inline** style: react-native-web writes it straight into the style attribute, where `pointer-events: box-none` is not CSS and the browser drops the declaration — a full-screen container then swallows every tap on the page (measured: the day view's entries became unclickable);
  - `none` in an inline style: valid CSS, and a child _can_ opt back in with `auto` on the web — but in React Native `none` excludes the whole subtree, so the floating action could not be pressed at all on the device.
    Registered via `StyleSheet.create`, react-native-web's compiler expands `box-none` into `pointer-events: none` on the element plus `auto` on its children, which is exactly the native meaning. See `components/ui/Screen.tsx`.
- **A shape's radius travels through `className`, not through a `style` function.** The floating action set `width`/`height`/`borderRadius` in a Pressable's `style` callback and rendered a **square on the device** while the browser drew a circle. Arbitrary pixel values in the class list (`h-[56px] w-[56px] rounded-[28px]`) are the path every other shape here takes; `rounded-full` is not an option, because Tailwind 4 emits it as a `calc()` and the native compiler discards those, and `h-14` is 3.5rem, which resolves to 49 rather than 56. The mechanism behind the original failure is not established — treat this as the working path rather than as an explanation.
- **A `TextInput` narrower than its content wants needs `minWidth: 0`.** On the web it is an `<input>`, whose intrinsic width is about twenty characters, and `flex-1` alone cannot shrink past it. Measured: a 128dp field rendered a 174dp input, so the row overflowed and the unit landed on the buttons beside it.
- **Touch targets come from `TOUCH_TARGET` in `tokens.ts`, never from `min-h-12`.** That class is 3rem, so it silently held every control at 42dp while reading as 48 in the source. An arbitrary value (`min-h-[48px]`) does land on native and is the escape hatch for a third party's own pressables, where a `style` prop cannot reach.

The web target hides all three, so **a change that has to hold on the device is verified on the device**, with a screenshot (`adb exec-out screencap -p`) rather than by eye in the browser.

## Documentation maintenance

Update README.md whenever you touch one of these:

| If you change…                         | Update…                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json` scripts                 | README (Scripts)                                                                 |
| `package.json` dependencies (versions) | README (Stack tecnológico)                                                       |
| `supabase/migrations/`                 | README (Arquitectura), `docs/supabase-setup.md` if the setup flow itself changes |
| `.env.example`                         | README (Secretos)                                                                |
| Adding `eas.json` / a real CI workflow | README (Compilación de producción / CI/CD)                                       |
