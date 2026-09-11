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
- **Pre-MVP the version is `0.x`,** so that reaching 1.0.0 means something. `versionCode` is derived as `major * 10000 + minor * 100 + patch`, which stays monotonic all the way from 0.2.0 (200) to 1.0.0 (10000) — **except across a deliberate version _decrease_,** where Android refuses the install with a downgrade error. Measured: `adb install -r -d` does **not** rescue it either — Android 15 honours `-d` only for a debuggable APK, and a release build is refused with `INSTALL_FAILED_VERSION_DOWNGRADE`. The only route is `adb uninstall com.petfile.app` first, which clears the Supabase session (one Google sign-in to restore) and the local settings; the pet, the photo and the log are all server-side and survive. **So decide the version scheme before handing out a build, not after.**
- **The version lives in `package.json`, and `app.config.js` is what makes that true.** `app.json` stays the readable base and the config function overrides `version` and derives `android.versionCode` from it, so there is one number to bump. **The commit hash is the half that needs no discipline.** `app.config.js` reads `git rev-parse --short HEAD` into `extra.commit` and the footer shows `v1.2.0 · 6bae961`, with a trailing `+` when the tree was dirty at build time. The version only separates two builds if somebody remembered to bump it, and twice it was not: a phone three commits behind showed a number that agreed with the repo, and two rounds of "is this stale?" followed. Where git is unavailable — EAS, a tarball, CI — the hash is simply absent.

**Metro caches the resolved app config**, so a version or commit change does not reach a running dev server or a warm bundle cache. `expo start --clear` (or deleting `$TMPDIR/metro-*`) is what makes the new identity appear — which is a sharp irony for the one feature whose whole job is saying which build you are looking at.

It names the **native build**, not the JS bundle: `expo-constants` reads the `app.config` embedded in the APK, so a dev build reports the version it was compiled at while Metro serves newer JavaScript. That is correct for catching a stale install and no help at all for catching stale JS. **Bump it before building a release APK**: a stale install and a fresh one both claiming `1.0.0` cost an afternoon of chasing a bug that was already fixed, which is why the version now shows at the foot of the login screen and of Ajustes.

- **`android/` and `ios/` are generated and gitignored.** After changing `scheme`, `android.package` or anything else identity-shaped in `app.json`, regenerate with `npx expo prebuild --clean -p android` — an existing directory keeps the old values. **The version is one of those things:** bumping `package.json` moves what Expo resolves and what the JS reads, but `android/app/build.gradle` keeps the `versionName` written at the last prebuild, so the APK lied about being 1.1.0 until `npx expo prebuild -p android` had run. Without `--clean` the debug keystore survives, which is what lets the new APK install over the old one.
- **`prebuild` deletes `android/local.properties`,** and Gradle then cannot find the SDK (`SDK location not found`). That file is generated, gitignored, and re-armed as a trap on every prebuild, so `android:apk` and `android` set `ANDROID_HOME` themselves — defaulting to `$HOME/Library/Android/sdk` and deferring to the environment when it is already set.

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
  Screen.tsx              → page container; one of the two places window insets are consumed
  Sheet.tsx               → bottom sheet: scrim, panel, and the keyboard inset a Modal needs
  MonthCalendar.tsx       → a month of days, each saying what happened on it
  calendar.ts             → the Nordic Ice theming both date pickers share
  Version.tsx             → the build's version, at the foot of login and Ajustes
  keyboard.ts             → how much of the screen the software keyboard covers
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
  settings.tsx            → how this tutor wants the app to read, on their device
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

**Display preferences live on the device, not in the row.** `lib/settings.tsx` keeps the time and duration formats in `AsyncStorage`: the household is two tutors with a phone each, so how the app _reads_ belongs to the person holding it, while what it _stores_ stays in Postgres. Times are still instants and durations still minutes — the formatters take the format as a parameter so `lib/` stays pure, and every call site says which side it is on. **The reading side follows the preference; the typing side never does** — a number pad cannot express a meridiem, so the two time fields always take 24-hour digits and Ajustes says so under the option.

**One validator, two forms.** `validatePetDraft` takes `PetDraft | PetEdit` and both the registration and profile screens call it; the mixed-breed coupling (`isMixedShown`, `withMixed`) lives in `lib/pets.ts` for the same reason. The two screens duplicate their _layout_ deliberately — extracting a shared form is a pending job — but anything that would be a bug if it drifted is in `lib/` and unit-tested.

Dates cross the app/database boundary in exactly one format: **ISO `YYYY-MM-DD`**, because `pets.birth_date` is a Postgres `date` and the RPC casts with `::date`, where Postgres's DateStyle makes a `DD/MM/AAAA` string ambiguous. The UI shows and collects the Spanish locale's `DD/MM/AAAA`; `lib/dates.ts` converts at the edge and is the only place that builds or parses a date string. An approximate birth date stores the 1st of the month with `birth_date_approximate = true` — **anything computing a due date must read that flag**, because the day is a placeholder, not data.

Shared UI lives in `components/ui/`, never in `app/` — `app/` holds routes. Three invariants come with it: **window insets are consumed only in `Screen` and `Sheet`** — the two page-level containers, and no screen reaches for `useSafeAreaInsets()` on its own. `Screen` keeps the primary action clear of the Android navigation bar; `Sheet` keeps a panel clear of the keyboard, which a `Modal` cannot inherit from `Screen`, **a colour needed by a React Native prop comes from `components/ui/tokens.ts`**, never a retyped hex literal, and **`Text` is imported from `components/ui`, never from `react-native`** — that wrapper is the only thing applying the typeface on native, where a bare `<Text>` falls back to Roboto (`grep -rnE '\bText\b' app components | grep 'from "react-native"'` should return nothing outside `components/ui/Text.tsx` — the word boundaries keep `TextInput` out). `global.css`'s `@theme` block stays the source of truth for anything a `className` can reach.

**`react-native-ui-datepicker` hands a `CalendarDay` an _instant_, not a date.** `day.date` arrives as `"2026-08-31T22:00:00.000Z"` for the 1st of September — Madrid is UTC+2, so local midnight is the previous day in UTC. Slicing the first ten characters looks safe and is wrong by a day for every timezone east of Greenwich, which marks the wrong cell and raises nothing. It has to go through local getters (`dayKey(new Date(day.date))`).

**A custom `components.Day` replaces the library's cell content**, so `classNames.selected` and `classNames.today` never reach it. A calendar with a custom day has to draw its own selection. It is also wrapped in the library's own `Pressable` with a hardcoded `accessibilityLabel` of the day number and no prop to override it, so a richer label has to sit on a node inside that wrapper — which makes every day **two** TalkBack stops. Measured on the device: both nodes are focusable with identical bounds.

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
- **A real keyboard fires one change per key, and `fill("")` fires one.** Deleting "10:48" on the device takes the field through "10:4", "10:", "1" and then "", and a handler that reacts to an unparseable value on every one of those behaves nothing like the same handler under Playwright's `fill`, which jumps straight to empty. Measured: clearing DESDE wiped the walk's duration on the phone and preserved it in the suite, because the wipe happened on the intermediate values and the final empty string was the one case the code got right. **Treat "does not parse yet" as mid-typing, not as an error**, and delete character by character in the test (`keyboard.press("Backspace")` in a loop) whenever a field reacts as it is typed.
- **A focused `TextInput` on Android ignores a value the JS layer rewrites.** A live mask that inserted the colon into a time as the digits arrived was written, tested and removed: typing `9000` left `9000` on screen while state held `90:00`. The browser applies the correction, so it worked on web and in the e2e suite and not on the phone. **Normalise on blur**, which the platform does honour — and remember that dismissing the keyboard with Back does _not_ blur, so the correction lands when another field takes focus.
- **A bottom sheet must consume the keyboard inset itself.** A `Modal` sits outside the tree `Screen` pads, and under edge-to-edge Android does not resize the window — so a bottom-anchored panel stays where it is and the keyboard covers it. Measured: the walk sheet showed its title and two field labels, with the fields, the steppers, the note and **Guardar** all behind the keyboard. `components/ui/Sheet.tsx` is the fix and the only other place window insets are consumed.
- **A `Pressable` must never take a callback `style`.** Given both a `className` and a `style={(state) => …}`, native drops the callback **entirely** — measured on device: the floating action rendered 24×24dp, the size of its own icon, because its width, height and radius all travelled that way, and `Cerrar sesión` sat at 36dp while asking for 48 in code. A plain object `style` survives alongside a `className`; only the callback form is dropped, and nothing warns. Every one of the eighteen sites looked right in the browser, which honours the callback. **Plain object for the numbers, `active:opacity-70` in the class list for the press** — `react-native-css` supports the `active:` variant on native. `components/__tests__/function-styles.test.ts` fails on any `style={(`.
- **Touch targets come from `TOUCH_TARGET` in `tokens.ts`, never from `min-h-12`.** That class is 3rem, so it silently held every control at 42dp while reading as 48 in the source. An arbitrary value (`min-h-[48px]`) does land on native and is the escape hatch for a third party's own pressables, where a `style` prop cannot reach.

The web target hides all three, so **a change that has to hold on the device is verified on the device**, with a screenshot (`adb exec-out screencap -p`) rather than by eye in the browser.

## Tests

**`e2e/home.spec.ts` assumes a working day, and ten of its tests fail before about 09:00.** They fill real clock times — 08:30, 09:15, 10:45 — and the entry sheet refuses a time in the future, correctly; the quarter-hour steppers have the mirror problem, since counting 45 minutes back from 00:20 lands on yesterday, which the sheet also refuses. A red suite at 01:00 therefore says nothing about the code, and the failures all read "¿Todavía no habéis vuelto?" or "Tiene que ser antes de la hora de vuelta".

**Playwright's clock is not the way out**, and both halves were measured here: `page.clock.setFixedTime` stops Reanimated dead — the button's status animation reads its progress from `Date.now()` and never finishes, so Playwright waits forever for a control that never stops moving — and `page.clock.install` + `resume` patches the timers the app captures at module load, after which the day view never renders at all. The fix is to derive every time in that file from a "now" the test owns, and to give the steppers a fixture whose day has time behind it.

**The e2e suite needs Node 22 or newer.** `@supabase/supabase-js` reaches for a native `WebSocket`, and on Node 20 every spec fails in `e2e/auth.ts` before the browser opens: "Node.js detected but native WebSocket not found." This project's default is 24; a shell that lands on 20 produces a total failure that looks nothing like a version problem. `node -v` is the first thing to check when the whole suite dies in the helper.

**The Expo web dev server dies during long runs.** Three times in one session a suite failed in bulk with `net::ERR_CONNECTION_REFUSED at http://localhost:8081/` — nothing to do with the code under test. A mass failure whose first error is that one is a dead server: `pkill -f "expo start"`, then run again.

## Documentation maintenance

Update README.md whenever you touch one of these:

| If you change…                         | Update…                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json` scripts                 | README (Scripts)                                                                 |
| `package.json` dependencies (versions) | README (Stack tecnológico)                                                       |
| `supabase/migrations/`                 | README (Arquitectura), `docs/supabase-setup.md` if the setup flow itself changes |
| `.env.example`                         | README (Secretos)                                                                |
| Adding `eas.json` / a real CI workflow | README (Compilación de producción / CI/CD)                                       |
