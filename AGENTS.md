# AGENTS.md

This file provides guidance to agentic AI tools when working with code in this repository.

## Constraints

- Package manager: **pnpm** only. pnpm's default symlinked `node_modules` breaks Metro and native builds, so the repo root carries an `.npmrc` / `pnpm-workspace.yaml` forcing `node-linker=hoisted` (a flat, npm-like `node_modules`). Never remove that setting or run `pnpm install` without it in place.
- TypeScript **strict mode** is enabled; no `any` in committed code.
- Dark mode only in v0. Every colour comes from the Nordic Ice tokens — no raw hex values in components.
- Screens must never import `@supabase/supabase-js`. The only import site in app code is `lib/supabase.ts` — `e2e/auth.ts` also uses `createClient` directly, but that is test setup, not app runtime.
- Conventional Commits for every commit (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `build:`).
- **v0 auth is Google OAuth only.** Magic links are out of scope for v0. There is **no development-mode auth bypass** — every environment, including local dev, requires a real Google sign-in. Do not add one, and do not write code or docs that imply one exists.
- **Google OAuth requires a native dev build.** Expo Go cannot handle the custom-scheme redirect this flow needs. `pnpm expo run:ios` / `pnpm expo run:android` produces the dev build; the web target runs under `pnpm web`.

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
pnpm ios                # expo start --ios (requires a native dev build for Google sign-in)
pnpm android            # expo start --android (requires a native dev build for Google sign-in)
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
app/                     → Expo Router routes
  (auth)/                → login
  (tabs)/                → authenticated shell (home, health, profile)
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

## Documentation maintenance

Update README.md whenever you touch one of these:

| If you change…                         | Update…                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json` scripts                 | README (Scripts)                                                                 |
| `package.json` dependencies (versions) | README (Stack tecnológico)                                                       |
| `supabase/migrations/`                 | README (Arquitectura), `docs/supabase-setup.md` if the setup flow itself changes |
| `.env.example`                         | README (Secretos)                                                                |
| Adding `eas.json` / a real CI workflow | README (Compilación de producción / CI/CD)                                       |
