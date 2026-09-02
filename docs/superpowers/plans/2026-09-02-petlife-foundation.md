# Petlife Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Expo app where the user can sign in and register Loki, with the pet persisted to Supabase Postgres under row-level security.

**Architecture:** Expo Router file-based routing over a Supabase backend. All database access goes through `lib/supabase.ts`; screens never import `@supabase/supabase-js` directly. Pet creation is atomic via a `security definer` Postgres function that writes both the `pets` row and its `pet_owners` membership, so a pet can never exist without an owner. Pure validation logic lives in `lib/` and is unit-tested with Jest; user-facing flows are tested with Playwright against the Expo web build.

**Tech Stack:** Expo (React Native) + Expo Router, TypeScript strict, NativeWind, Supabase (Postgres + Auth), Jest (`jest-expo`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-02-petlife-design.md`

## Global Constraints

- Package manager: **pnpm** (all of the user's other projects use pnpm; this repo follows that precedent). pnpm's default symlinked `node_modules` breaks Metro and native builds, so the repo root carries an `.npmrc`/`pnpm-workspace.yaml` forcing `node-linker=hoisted` — a flat, npm-like `node_modules` — before anyone runs `pnpm install`. Never remove that setting or run `pnpm install` without it in place.
- TypeScript **strict mode** enabled; no `any` in committed code.
- Dark mode only in v0. Every colour comes from the Nordic Ice tokens defined in Task 2 — no raw hex values in components.
- Screens must never import `@supabase/supabase-js`. The only import site is `lib/supabase.ts`.
- Conventional Commits for every commit (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `build:`).
- **v0 auth is Google OAuth only.** Magic links are explicitly out of scope for v0. Signing in with Google from day one means the user's account identity never changes, so no tracking data is stranded on an abandoned account later.
- **Google OAuth requires a development build.** Expo Go cannot handle the custom-scheme redirect this flow needs. `pnpm expo run:ios` / `pnpm expo run:android` produces the dev build; the web target still runs under `pnpm web`.

### Secret handling (non-negotiable)

- `.env` is gitignored and is filled in **by the user only**. No agent may `cat`, `Read`, `grep`, `echo`, or otherwise print its contents, and no key value may ever appear in a commit, a log, a test fixture, or the conversation. Agents needing the values run the process that reads `.env` — they do not read it themselves.
- `.env.example` is committed with placeholders only.
- **`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are not secrets.** Every `EXPO_PUBLIC_*` variable is inlined into the client bundle and is extractable by anyone with the app. The anon key is a public identifier; data is protected by the RLS policies in Task 3, not by hiding it. Task 3's RLS verification is therefore a security control, not a formality.
- **Actual secrets, which never enter the repo or any agent's context:** the Supabase `service_role` key (unused in v0 — the app must never reference it) and the Google OAuth **client secret**, which is pasted directly into the Supabase dashboard so that Supabase performs the token exchange server-side.
- For future EAS builds, secrets go in EAS environment variables (encrypted server-side), never in the repo.

---

### Task 1: Scaffold the Expo app

**Files:**
- Create: everything from the Expo template at repo root (`app/`, `package.json`, `app.json`, `tsconfig.json`, `.gitignore`)
- Create: `.env.example`
- Modify: `.gitignore` (add `.env`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a booting Expo Router app at repo root; `pnpm web` serves on `http://localhost:8081`

- [ ] **Step 1: Scaffold into a temp directory**

`create-expo-app` refuses to write into a directory that already has files, and `petlife/` already contains `.git/` and `docs/`. Scaffold beside it, then merge.

```bash
cd /Users/mikel/workspace
pnpm dlx create-expo-app@latest petlife-scaffold --template default
```

- [ ] **Step 2: Merge the scaffold into the repo, preserving git history and docs**

```bash
cd /Users/mikel/workspace
rsync -a --exclude='.git' petlife-scaffold/ petlife/
rm -rf petlife-scaffold
cd petlife && pnpm install
```

- [ ] **Step 3: Verify the app boots on web**

Run: `cd /Users/mikel/workspace/petlife && pnpm web`
Expected: Metro bundles without error and `http://localhost:8081` renders the Expo starter screen. Stop the server with Ctrl-C once confirmed.

- [ ] **Step 4: Remove the template's demo content**

Delete the starter screens and assets the template ships that Petlife will not use, keeping `app/_layout.tsx`:

```bash
cd /Users/mikel/workspace/petlife
rm -rf app/\(tabs\) components/ hooks/ constants/ 2>/dev/null || true
```

Replace `app/_layout.tsx` with a minimal root layout:

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `app/index.tsx` as a temporary landing screen so the router has a route:

```tsx
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Petlife</Text>
    </View>
  );
}
```

- [ ] **Step 5: Add environment variable scaffolding**

Create `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
```

Append to `.gitignore`:

```
.env
```

- [ ] **Step 6: Verify it still boots, then commit**

Run: `pnpm web`
Expected: `http://localhost:8081` renders "Petlife". Stop the server.

```bash
git add -A
git commit -m "build: scaffold Expo Router app with TypeScript"
```

---

### Task 2: NativeWind and the Nordic Ice design tokens

**Files:**
- Create: `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`
- Modify: `babel.config.js`, `metro.config.js`, `app/_layout.tsx`, `app/index.tsx`

**Interfaces:**
- Consumes: booting app from Task 1
- Produces: `className` styling available in every component; the token names `bg-base`, `bg-surface`, `bg-elevated`, `bg-nav`, `border-default`, `border-strong`, `accent-primary`, `accent-secondary`, `text-primary`, `text-secondary`, `text-tertiary`, `text-muted`, `success`, `warning`, `error`, `info`

- [ ] **Step 1: Run the Tailwind setup skill**

REQUIRED SUB-SKILL: invoke the `expo-app-design:expo-tailwind-setup` skill and follow it to install and wire NativeWind. It carries the current, version-correct wiring for `babel.config.js`, `metro.config.js`, `global.css`, and the TypeScript declaration file — do not hand-write those from memory, as the required setup differs between NativeWind v4 and v5.

- [ ] **Step 2: Define the Nordic Ice tokens**

Add the palette to `tailwind.config.js`. These values are copied verbatim from the spec (section 6) and are the only colours the app may use:

```js
// tailwind.config.js — merge into the config the setup skill generated
module.exports = {
  // ...content/presets from the setup skill
  theme: {
    extend: {
      colors: {
        base: "#0B1120",
        surface: "#131C2E",
        elevated: "#1E293B",
        nav: "#0D1525",
        "border-default": "#1E293B",
        "border-strong": "#334155",
        "accent-primary": "#A5F2F3",
        "accent-secondary": "#7DD3E8",
        "text-primary": "#F1F5F9",
        "text-secondary": "#CBD5E1",
        "text-tertiary": "#94A3B8",
        "text-muted": "#64748B",
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
    },
  },
};
```

- [ ] **Step 3: Install the Outfit typeface**

The spec (section 6) specifies Outfit as the app typeface.

```bash
cd /Users/mikel/workspace/petlife
pnpm expo install expo-font @expo-google-fonts/outfit expo-splash-screen
```

Register it as the default font family in `tailwind.config.js`, inside the same `theme.extend` block as the colours:

```js
fontFamily: {
  sans: ["Outfit_500Medium"],
  semibold: ["Outfit_600SemiBold"],
  bold: ["Outfit_700Bold"],
},
```

- [ ] **Step 4: Apply the dark base and load the font in the root layout**

Replace `app/_layout.tsx`. The splash screen is held until the font is ready, so text never flashes in the fallback face:

```tsx
import "../global.css";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0B1120" },
        }}
      />
    </>
  );
}
```

Replace `app/index.tsx` with a token-styled screen:

```tsx
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <Text className="text-3xl font-bold text-text-primary">Petlife</Text>
      <Text className="mt-2 text-accent-primary">Nordic Ice</Text>
    </View>
  );
}
```

- [ ] **Step 5: Verify the tokens and font render**

Run: `pnpm web`
Expected: `http://localhost:8081` shows a dark navy (`#0B1120`) background, a near-white "Petlife" heading set in Outfit, and an ice-blue (`#A5F2F3`) "Nordic Ice" line. If colours are absent, NativeWind is not wired — revisit Step 1 before continuing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add NativeWind with Nordic Ice tokens and the Outfit typeface"
```

---

### Task 3: Supabase schema, RLS policies, and atomic pet creation

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `docs/supabase-setup.md`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure backend)
- Produces: tables `profiles`, `pets`, `pet_owners`; RPC `create_pet_with_owner(pet jsonb) returns pets`; helper `is_pet_owner(p_pet_id uuid) returns boolean`

- [ ] **Step 1: Write the setup guide for the user**

**This step is performed by the user, not by an agent.** The agent's job is to write `docs/supabase-setup.md` and then stop and ask the user to complete it. The user fills `.env` themselves; the agent never reads it.

Create `docs/supabase-setup.md`:

```markdown
# Supabase and Google OAuth setup

Performed once, by a human. No value below is ever committed or shared with an agent.

## 1. Supabase project

1. Create a project at https://supabase.com (free tier is enough for v0).
2. Project Settings → API: copy the **Project URL** and the **`anon` public key**.
3. `cp .env.example .env` and fill both values.

> The anon key is not a secret — it ships inside the app bundle by design. Your data is
> protected by the RLS policies in `supabase/migrations/`, not by hiding this key.
> The **`service_role`** key on that same page *is* secret: it bypasses RLS. Never put it
> in `.env`, in the repo, or in a chat with an agent.

## 2. Google Cloud OAuth credentials

1. Go to https://console.cloud.google.com → create a project (e.g. "Petlife").
2. APIs & Services → OAuth consent screen: External, app name "Petlife", add your own
   email as a test user.
3. APIs & Services → Credentials → Create credentials → OAuth client ID. Create a
   **Web application** client:
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.
4. For native builds, also create an **iOS** client (bundle id `com.petlife.app`) and an
   **Android** client. These have no client secret.

## 3. Connect Google to Supabase

1. Supabase → Authentication → Providers → Google → enable.
2. Paste the **Web** client ID and client secret from step 2.3.
   The client secret lives here and nowhere else — Supabase performs the token exchange
   server-side, so the secret never reaches the app or the repo.
3. Authentication → URL Configuration → Redirect URLs, add:
   - `petlife://auth/callback` (native)
   - `http://localhost:8081` (web dev)

## 4. Apply the database migrations

Paste each file in `supabase/migrations/` into the SQL Editor in order, oldest first
(or run `pnpm dlx supabase db push` with the CLI linked to the project).

## 5. Create the end-to-end test account

Playwright cannot drive Google's consent screen, so the test suite signs in with a
dedicated password account that exists only for testing.

1. Supabase → Authentication → Users → Add user → Create new user.
   - Email: `loki-e2e@example.com`, any strong password, "Auto Confirm User" checked.
2. Add to `.env`:

   ```
   E2E_EMAIL=loki-e2e@example.com
   E2E_PASSWORD=<the password you chose>
   ```

This account is separate from your real Google-backed account, so nothing you record in
normal use is tied to it.
```

- [ ] **Step 2: Add a guard against committing secrets**

Create `.githooks/pre-commit`:

```bash
#!/bin/sh
# Refuse to commit .env or anything that looks like a Supabase service key.
if git diff --cached --name-only | grep -qE '(^|/)\.env$'; then
  echo "BLOCKED: .env must never be committed." >&2
  exit 1
fi
if git diff --cached -U0 | grep -qE 'service_role|eyJ[A-Za-z0-9_-]{20,}\.'; then
  echo "BLOCKED: staged changes look like they contain a JWT or service_role key." >&2
  exit 1
fi
exit 0
```

Enable it:

```bash
cd /Users/mikel/workspace/petlife
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

- [ ] **Step 3: Hand off to the user and wait**

STOP. Tell the user the setup guide is ready and ask them to complete `docs/supabase-setup.md` sections 1-3 and 5, then confirm. Do not continue until they do — the remaining steps need a live project.

- [ ] **Step 4: Write the schema migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
-- Profiles: one row per auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Pets.
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default 'dog',
  sex text not null check (sex in ('male', 'female')),
  breed_primary text,
  breed_secondary text,
  is_mixed boolean not null default false,
  birth_date date,
  birth_date_approximate boolean not null default false,
  photo_url text,
  spayed_neutered boolean,
  activity_level text not null default 'moderate'
    check (activity_level in ('low', 'moderate', 'high')),
  exercise_goal_minutes integer,
  vet_primary jsonb,
  vet_emergency jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership: which users may see and edit which pets.
-- This table is what makes v1 sharing an INSERT rather than a redesign.
create table public.pet_owners (
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);

create index pet_owners_user_id_idx on public.pet_owners (user_id);

-- Membership check as SECURITY DEFINER so pet policies can consult
-- pet_owners without triggering that table's own RLS (infinite recursion).
create or replace function public.is_pet_owner(p_pet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pet_owners
    where pet_id = p_pet_id and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.pet_owners enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select using (id = auth.uid());
create policy "profiles are self-writable"
  on public.profiles for update using (id = auth.uid());

create policy "pets readable by their owners"
  on public.pets for select using (public.is_pet_owner(id));
create policy "pets writable by their owners"
  on public.pets for update using (public.is_pet_owner(id));
create policy "pets deletable by their owners"
  on public.pets for delete using (public.is_pet_owner(id));

create policy "memberships readable by the member"
  on public.pet_owners for select using (user_id = auth.uid());

-- Create the profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomic pet creation: a pet must never exist without an owner, and there
-- is no INSERT policy on either table, so this function is the only path in.
create or replace function public.create_pet_with_owner(pet jsonb)
returns public.pets
language plpgsql
security definer
set search_path = public
as $$
declare
  new_pet public.pets;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.pets (
    name, sex, breed_primary, breed_secondary, is_mixed,
    birth_date, birth_date_approximate, spayed_neutered, activity_level
  )
  values (
    pet ->> 'name',
    pet ->> 'sex',
    pet ->> 'breed_primary',
    pet ->> 'breed_secondary',
    coalesce((pet ->> 'is_mixed')::boolean, false),
    (pet ->> 'birth_date')::date,
    coalesce((pet ->> 'birth_date_approximate')::boolean, false),
    (pet ->> 'spayed_neutered')::boolean,
    coalesce(pet ->> 'activity_level', 'moderate')
  )
  returning * into new_pet;

  insert into public.pet_owners (pet_id, user_id, role)
  values (new_pet.id, auth.uid(), 'owner');

  return new_pet;
end;
$$;
```

**Deliberately not in this migration:** `routine_templates` and `routine_occurrences` ship with the Routines plan, `health_events` with the Health plan, and `invitations` with v1 — the spec defers its mechanism (6-digit code vs. direct link), so creating the table now would mean guessing its shape. Each arrives as its own numbered migration.

- [ ] **Step 5: Apply the migration**

Paste the file into the Supabase SQL Editor and run it (or `pnpm dlx supabase db push` if the CLI is linked).
Expected: "Success. No rows returned".

- [ ] **Step 6: Verify RLS actually isolates data**

In the Supabase SQL Editor, run this as an anonymous caller — `auth.uid()` is null, so every policy must deny:

```sql
set role authenticated;
select count(*) from public.pets;
```

Expected: `0` rows, and no error. A non-zero count or a permission error means the policies are wrong — fix before continuing.

- [ ] **Step 7: Commit**

```bash
git add supabase/ docs/supabase-setup.md .githooks/
git commit -m "feat: add initial Supabase schema with RLS and atomic pet creation"
```

---

### Task 4: Supabase client and generated database types

**Files:**
- Create: `lib/supabase.ts`, `lib/database.types.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Consumes: the project credentials and schema from Task 3
- Produces: `supabase` (typed `SupabaseClient<Database>`) exported from `lib/supabase.ts`; the `Database` type from `lib/database.types.ts`

- [ ] **Step 1: Install the client and its React Native dependencies**

```bash
cd /Users/mikel/workspace/petlife
pnpm expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

- [ ] **Step 2: Generate the database types**

```bash
pnpm dlx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
```

`<project-ref>` is the subdomain of the Project URL (`https://<project-ref>.supabase.co`). If the CLI is not linked, use the Supabase dashboard: API Docs → "Generating types" → copy the output into `lib/database.types.ts`.

- [ ] **Step 3: Create the single client module**

Create `lib/supabase.ts`. `AsyncStorage` persists the session across app restarts. `detectSessionInUrl` must be true on web — that is how the OAuth redirect hands the session back — and false on native, where the session arrives through a deep link instead.

```ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import type { Database } from "./database.types";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Copy .env.example to .env and fill both values.",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
```

On web the client falls back to `localStorage`, which the Playwright suite relies on to seed a session in Task 5.

- [ ] **Step 4: Verify the client constructs and reaches the project**

Run: `pnpm web`, then in the browser devtools console on `http://localhost:8081`, confirm no "Missing EXPO_PUBLIC_SUPABASE_*" error appears in the Metro output or the console.
Expected: the app renders as before, with no thrown configuration error.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add typed Supabase client"
```

---

### Task 5: Authentication — Google OAuth, session context, and route guarding

**Files:**
- Create: `lib/auth.tsx`, `app/(auth)/login.tsx`, `playwright.config.ts`, `e2e/auth.ts`, `e2e/login.spec.ts`
- Modify: `app/_layout.tsx`, `app/index.tsx`, `app.json`, `package.json`

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts`
- Produces: `AuthProvider` (React component) and `useAuth(): { session: Session | null; loading: boolean; signInWithGoogle(): Promise<{ error: string | null }>; signOut(): Promise<void> }` from `lib/auth.tsx`; `seedSession(page: Page): Promise<void>` from `e2e/auth.ts`

- [ ] **Step 1: Install Playwright and scaffold its config**

```bash
cd /Users/mikel/workspace/petlife
pnpm add -D @playwright/test dotenv
pnpm exec playwright install chromium
```

Create `playwright.config.ts`. `dotenv` loads `.env` into the test process — the values are read by the process, never printed. The `webServer` block starts the Expo web build for the tests and reuses an already-running one locally:

```ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:8081",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm web",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

Add the script to `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

- [ ] **Step 2: Write the session-seeding helper**

Playwright cannot drive Google's consent screen (Google blocks automated browsers), so tests that need an authenticated app inject a session directly. This helper signs in the dedicated test account server-side, then writes the resulting session into `localStorage` under the key the Supabase web client reads on boot.

Create `e2e/auth.ts`:

```ts
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

export async function seedSession(page: Page): Promise<void> {
  if (!url || !anonKey || !email || !password) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY, E2E_EMAIL or E2E_PASSWORD. See docs/supabase-setup.md.",
    );
  }

  const client = createClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`E2E sign-in failed: ${error?.message ?? "no session returned"}`);
  }

  const projectRef = new URL(url).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const session = JSON.stringify(data.session);

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, session] as const,
  );
}
```

- [ ] **Step 3: Write the failing end-to-end test**

Create `e2e/login.spec.ts`. Two behaviours matter: an unauthenticated visitor is offered Google and clicking it actually starts Google's flow, and an authenticated visitor never sees the login screen at all.

```ts
import { expect, test } from "@playwright/test";
import { seedSession } from "./auth";

test("offers Google sign-in and starts the OAuth flow", async ({ page }) => {
  await page.goto("/login");

  const button = page.getByTestId("login-google");
  await expect(button).toBeVisible();

  await button.click();
  await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 });
});

test("sends an authenticated visitor past the login screen", async ({ page }) => {
  await seedSession(page);
  await page.goto("/");

  await expect(page.getByTestId("login-google")).toBeHidden({ timeout: 15_000 });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test:e2e -- e2e/login.spec.ts`
Expected: FAIL — `/login` does not exist yet, so `getByTestId("login-google")` times out.

- [ ] **Step 5: Register the deep-link scheme**

Google's redirect comes back to the native app through a custom scheme. In `app.json`, set `expo.scheme`:

```json
{
  "expo": {
    "scheme": "petlife"
  }
}
```

This must match the `petlife://auth/callback` redirect URL registered in Supabase (setup guide, section 3).

- [ ] **Step 6: Create the auth context**

```bash
cd /Users/mikel/workspace/petlife
pnpm expo install expo-web-browser expo-linking
```

Create `lib/auth.tsx`. On web, Supabase redirects the page itself and `detectSessionInUrl` picks the session back up. On native, the flow opens a system browser and returns tokens in the callback URL, which are then handed to `setSession`:

```tsx
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { supabase } from "./supabase";

type AuthValue = {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      signInWithGoogle: async () => {
        const redirectTo =
          Platform.OS === "web"
            ? window.location.origin
            : Linking.createURL("auth/callback");

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
        });

        if (error) return { error: error.message };
        if (Platform.OS === "web") return { error: null }; // the page is redirecting

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== "success") return { error: null }; // user dismissed it

        const fragment = result.url.split("#")[1] ?? "";
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken || !refreshToken) {
          return { error: params.get("error_description") ?? "No se recibió la sesión" };
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return { error: sessionError?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
```

- [ ] **Step 7: Build the login screen**

Create `app/(auth)/login.tsx`:

```tsx
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: failure } = await signInWithGoogle();
    setError(failure);
    setBusy(false);
  }

  return (
    <View className="flex-1 justify-center bg-base px-6">
      <Text className="mb-2 text-4xl font-bold text-text-primary">Petlife</Text>
      <Text className="mb-10 text-text-tertiary">El día a día de Loki</Text>

      {error ? (
        <Text testID="login-error" className="mb-3 text-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="login-google"
        disabled={busy}
        onPress={submit}
        className="items-center rounded-xl bg-accent-primary py-4"
      >
        {busy ? (
          <ActivityIndicator color="#0B1120" />
        ) : (
          <Text className="font-semibold text-base">Continuar con Google</Text>
        )}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 8: Wire the provider and redirect unauthenticated users**

Replace `app/_layout.tsx`, keeping the font loading from Task 2 and wrapping the stack in the provider:

```tsx
import "../global.css";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider } from "../lib/auth";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0B1120" },
        }}
      />
    </AuthProvider>
  );
}
```

Replace `app/index.tsx` so it routes by session state:

```tsx
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color="#A5F2F3" />
      </View>
    );
  }

  return <Redirect href={session ? "/home" : "/login"} />;
}
```

Create a temporary `app/home.tsx` so the authenticated redirect resolves (Task 8 replaces it with the tab shell):

```tsx
import { Text, View } from "react-native";

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <Text testID="home-title" className="text-2xl text-text-primary">
        Hoy
      </Text>
    </View>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Requires the test account from `docs/supabase-setup.md` section 5 and a filled `.env`. Do not read `.env` — just run the suite, which loads it.

Run: `pnpm test:e2e -- e2e/login.spec.ts`
Expected: PASS — both tests green. On failure, inspect the recorded trace with `pnpm exec playwright show-trace` to see the rendered screen at the failing step, or re-run with `pnpm test:e2e:ui`.

- [ ] **Step 10: Verify Google sign-in end to end by hand**

Automation cannot complete Google's consent screen, so confirm the real flow once manually:

Run: `pnpm web`, open `http://localhost:8081`, click "Continuar con Google", complete consent.
Expected: you land back on the app, signed in, and reloading the page keeps you signed in.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add Google OAuth sign-in with session-based routing"
```

---

### Task 6: Pet draft validation (pure logic)

**Files:**
- Create: `lib/pets.ts`, `lib/__tests__/pets.test.ts`
- Modify: `package.json` (Jest config and scripts)

**Interfaces:**
- Consumes: nothing at runtime (pure module)
- Produces: `type PetDraft = { name: string; sex: "male" | "female" | null; breedPrimary: string | null; isMixed: boolean; birthDate: string | null; birthDateApproximate: boolean; spayedNeutered: boolean | null; activityLevel: "low" | "moderate" | "high" }` and `validatePetDraft(draft: PetDraft, today?: Date): Record<string, string>` — an object keyed by field name, empty when valid

- [ ] **Step 1: Install and configure Jest**

```bash
cd /Users/mikel/workspace/petlife
pnpm expo install --dev jest jest-expo @types/jest
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "testPathIgnorePatterns": ["/node_modules/", "/e2e/"]
  }
}
```

`testPathIgnorePatterns` keeps Jest out of the Playwright suite — without it, Jest tries to run `e2e/*.spec.ts` and fails on Playwright's imports.

- [ ] **Step 2: Write the failing test**

Create `lib/__tests__/pets.test.ts`:

```ts
import { validatePetDraft, type PetDraft } from "../pets";

const valid: PetDraft = {
  name: "Loki",
  sex: "male",
  breedPrimary: "Husky Siberiano",
  isMixed: false,
  birthDate: "2025-09-14",
  birthDateApproximate: false,
  spayedNeutered: false,
  activityLevel: "high",
};

const today = new Date("2026-09-02T00:00:00Z");

describe("validatePetDraft", () => {
  it("accepts a complete draft", () => {
    expect(validatePetDraft(valid, today)).toEqual({});
  });

  it("requires a name", () => {
    expect(validatePetDraft({ ...valid, name: "   " }, today)).toHaveProperty("name");
  });

  it("requires a sex", () => {
    expect(validatePetDraft({ ...valid, sex: null }, today)).toHaveProperty("sex");
  });

  it("rejects a birth date in the future", () => {
    expect(
      validatePetDraft({ ...valid, birthDate: "2026-12-01" }, today),
    ).toHaveProperty("birthDate");
  });

  it("rejects an unparseable birth date", () => {
    expect(
      validatePetDraft({ ...valid, birthDate: "14/09/2025" }, today),
    ).toHaveProperty("birthDate");
  });

  it("allows an unknown birth date", () => {
    expect(validatePetDraft({ ...valid, birthDate: null }, today)).toEqual({});
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test -- lib/__tests__/pets.test.ts`
Expected: FAIL — "Cannot find module '../pets'".

- [ ] **Step 4: Write the minimal implementation**

Create `lib/pets.ts`:

```ts
export type PetDraft = {
  name: string;
  sex: "male" | "female" | null;
  breedPrimary: string | null;
  isMixed: boolean;
  birthDate: string | null; // YYYY-MM-DD
  birthDateApproximate: boolean;
  spayedNeutered: boolean | null;
  activityLevel: "low" | "moderate" | "high";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePetDraft(
  draft: PetDraft,
  today: Date = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.name.trim()) {
    errors.name = "El nombre es obligatorio";
  }

  if (!draft.sex) {
    errors.sex = "Indica el sexo";
  }

  if (draft.birthDate !== null) {
    if (!ISO_DATE.test(draft.birthDate)) {
      errors.birthDate = "Usa el formato AAAA-MM-DD";
    } else {
      const parsed = new Date(`${draft.birthDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.birthDate = "Fecha no válida";
      } else if (parsed.getTime() > today.getTime()) {
        errors.birthDate = "La fecha no puede ser futura";
      }
    }
  }

  return errors;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- lib/__tests__/pets.test.ts`
Expected: PASS — 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add pet draft validation with unit tests"
```

---

### Task 7: Persist a pet through the atomic RPC

**Files:**
- Modify: `lib/pets.ts`
- Create: `lib/__tests__/pets.rpc.test.ts`

**Interfaces:**
- Consumes: `validatePetDraft`, `PetDraft` from Task 6; `supabase` from Task 4; the `create_pet_with_owner` RPC from Task 3
- Produces: `createPet(draft: PetDraft): Promise<{ petId: string | null; error: string | null }>` and `getMyPet(): Promise<{ pet: PetRow | null; error: string | null }>`, where `PetRow = Database["public"]["Tables"]["pets"]["Row"]`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/pets.rpc.test.ts`. The Supabase client is mocked so this stays a fast unit test — it asserts the mapping from camelCase draft to the snake_case payload the RPC expects, which is exactly where this kind of code breaks:

```ts
import { createPet } from "../pets";
import type { PetDraft } from "../pets";

const rpc = jest.fn();
jest.mock("../supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const draft: PetDraft = {
  name: "Loki",
  sex: "male",
  breedPrimary: "Husky Siberiano",
  isMixed: false,
  birthDate: "2025-09-14",
  birthDateApproximate: false,
  spayedNeutered: false,
  activityLevel: "high",
};

beforeEach(() => rpc.mockReset());

describe("createPet", () => {
  it("sends the draft as a snake_case payload and returns the new id", async () => {
    rpc.mockResolvedValue({ data: { id: "pet-1" }, error: null });

    const result = await createPet(draft);

    expect(rpc).toHaveBeenCalledWith("create_pet_with_owner", {
      pet: {
        name: "Loki",
        sex: "male",
        breed_primary: "Husky Siberiano",
        breed_secondary: null,
        is_mixed: false,
        birth_date: "2025-09-14",
        birth_date_approximate: false,
        spayed_neutered: false,
        activity_level: "high",
      },
    });
    expect(result).toEqual({ petId: "pet-1", error: null });
  });

  it("rejects an invalid draft without calling the database", async () => {
    const result = await createPet({ ...draft, name: "" });

    expect(rpc).not.toHaveBeenCalled();
    expect(result.petId).toBeNull();
    expect(result.error).toBe("El nombre es obligatorio");
  });

  it("surfaces a database error message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not authenticated" } });

    const result = await createPet(draft);

    expect(result).toEqual({ petId: null, error: "not authenticated" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- lib/__tests__/pets.rpc.test.ts`
Expected: FAIL — `createPet` is not exported from `../pets`.

- [ ] **Step 3: Implement `createPet` and `getMyPet`**

Append to `lib/pets.ts`:

```ts
import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type PetRow = Database["public"]["Tables"]["pets"]["Row"];

export async function createPet(
  draft: PetDraft,
): Promise<{ petId: string | null; error: string | null }> {
  const errors = validatePetDraft(draft);
  const firstError = Object.values(errors)[0];
  if (firstError) {
    return { petId: null, error: firstError };
  }

  const { data, error } = await supabase.rpc("create_pet_with_owner", {
    pet: {
      name: draft.name.trim(),
      sex: draft.sex,
      breed_primary: draft.breedPrimary,
      breed_secondary: null,
      is_mixed: draft.isMixed,
      birth_date: draft.birthDate,
      birth_date_approximate: draft.birthDateApproximate,
      spayed_neutered: draft.spayedNeutered,
      activity_level: draft.activityLevel,
    },
  });

  if (error) {
    return { petId: null, error: error.message };
  }

  return { petId: (data as { id: string }).id, error: null };
}

export async function getMyPet(): Promise<{
  pet: PetRow | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return { pet: null, error: error.message };
  }

  return { pet: data, error: null };
}
```

`getMyPet` needs no explicit owner filter: the RLS policy from Task 3 already restricts `pets` to rows the caller owns.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — all tests in `lib/__tests__/` green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: persist pets through the atomic create_pet_with_owner RPC"
```

---

### Task 8: Onboarding screen and the authenticated shell

**Files:**
- Create: `app/onboarding.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/health.tsx`, `app/(tabs)/profile.tsx`, `e2e/onboarding.spec.ts`
- Delete: `app/home.tsx` (the placeholder from Task 5)
- Modify: `app/index.tsx`

**Interfaces:**
- Consumes: `useAuth` from Task 5; `createPet`, `getMyPet`, `PetDraft` from Tasks 6-7
- Produces: the routes `/onboarding`, `/(tabs)` (Home), `/(tabs)/health`, `/(tabs)/profile`

- [ ] **Step 1: Write the failing end-to-end test**

Create `e2e/onboarding.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { seedSession } from "./auth";

test("blocks submission until the required fields are filled", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-submit").click();

  await expect(page.getByTestId("onboarding-error")).toBeVisible();
});

test("registers a pet and lands on the day view", async ({ page }) => {
  await seedSession(page);
  await page.goto("/onboarding");

  await page.getByTestId("onboarding-name").fill("Loki");
  await page.getByTestId("onboarding-sex-male").click();
  await page.getByTestId("onboarding-breed").fill("Husky Siberiano");
  await page.getByTestId("onboarding-birthdate").fill("2025-09-14");
  await page.getByTestId("onboarding-submit").click();

  await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e -- e2e/onboarding.spec.ts`
Expected: FAIL — `/onboarding` does not exist, so `onboarding-name` times out.

- [ ] **Step 3: Build the onboarding screen**

Create `app/onboarding.tsx`:

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createPet, type PetDraft } from "../lib/pets";

const ACTIVITY: PetDraft["activityLevel"][] = ["low", "moderate", "high"];
const ACTIVITY_LABEL: Record<PetDraft["activityLevel"], string> = {
  low: "Bajo",
  moderate: "Moderado",
  high: "Alto",
};

export default function Onboarding() {
  const router = useRouter();
  const [draft, setDraft] = useState<PetDraft>({
    name: "",
    sex: null,
    breedPrimary: null,
    isMixed: false,
    birthDate: null,
    birthDateApproximate: false,
    spayedNeutered: null,
    activityLevel: "moderate",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { petId, error: failure } = await createPet(draft);
    setBusy(false);

    if (petId) {
      router.replace("/(tabs)");
      return;
    }
    setError(failure);
  }

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="px-6 py-12">
      <Text className="mb-8 text-3xl font-bold text-text-primary">
        ¿Quién vive contigo?
      </Text>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Nombre
      </Text>
      <TextInput
        testID="onboarding-name"
        value={draft.name}
        onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
        placeholder="Loki"
        placeholderTextColor="#64748B"
        className="mb-5 rounded-xl border border-border-default bg-surface px-4 py-3 text-text-primary"
      />

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Sexo
      </Text>
      <View className="mb-5 flex-row gap-3">
        {(["male", "female"] as const).map((sex) => (
          <Pressable
            key={sex}
            testID={`onboarding-sex-${sex}`}
            onPress={() => setDraft((d) => ({ ...d, sex }))}
            className={`flex-1 items-center rounded-xl border py-3 ${
              draft.sex === sex
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">
              {sex === "male" ? "♂ Macho" : "♀ Hembra"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Raza
      </Text>
      <TextInput
        testID="onboarding-breed"
        value={draft.breedPrimary ?? ""}
        onChangeText={(value) =>
          setDraft((d) => ({ ...d, breedPrimary: value || null }))
        }
        placeholder="Husky Siberiano"
        placeholderTextColor="#64748B"
        className="mb-5 rounded-xl border border-border-default bg-surface px-4 py-3 text-text-primary"
      />

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Fecha de nacimiento
      </Text>
      <TextInput
        testID="onboarding-birthdate"
        value={draft.birthDate ?? ""}
        onChangeText={(value) =>
          setDraft((d) => ({ ...d, birthDate: value || null }))
        }
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#64748B"
        className="mb-5 rounded-xl border border-border-default bg-surface px-4 py-3 text-text-primary"
      />

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Nivel de actividad
      </Text>
      <View className="mb-8 flex-row gap-3">
        {ACTIVITY.map((level) => (
          <Pressable
            key={level}
            testID={`onboarding-activity-${level}`}
            onPress={() => setDraft((d) => ({ ...d, activityLevel: level }))}
            className={`flex-1 items-center rounded-xl border py-3 ${
              draft.activityLevel === level
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">{ACTIVITY_LABEL[level]}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Text testID="onboarding-error" className="mb-3 text-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="onboarding-submit"
        disabled={busy}
        onPress={submit}
        className="items-center rounded-xl bg-accent-primary py-4"
      >
        <Text className="font-semibold text-base">
          {busy ? "Guardando..." : "Guardar"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Build the tab shell**

Delete the placeholder and create the tab group:

```bash
rm app/home.tsx
```

Create `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0D1525", borderTopColor: "#1E293B" },
        tabBarActiveTintColor: "#A5F2F3",
        tabBarInactiveTintColor: "#64748B",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Hoy" }} />
      <Tabs.Screen name="health" options={{ title: "Salud" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
```

Create `app/(tabs)/index.tsx`:

```tsx
import { Text, View } from "react-native";

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <Text testID="home-title" className="text-2xl text-text-primary">
        Hoy
      </Text>
      <Text className="mt-2 text-text-tertiary">
        El checklist del día llega en el plan de rutinas
      </Text>
    </View>
  );
}
```

Create `app/(tabs)/health.tsx`:

```tsx
import { Text, View } from "react-native";

export default function Health() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <Text testID="health-title" className="text-2xl text-text-primary">
        Salud
      </Text>
    </View>
  );
}
```

Create `app/(tabs)/profile.tsx`:

```tsx
import { Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { Pressable } from "react-native";

export default function Profile() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-base px-6">
      <Text testID="profile-title" className="mb-8 text-2xl text-text-primary">
        Perfil
      </Text>
      <Pressable
        testID="profile-signout"
        onPress={signOut}
        className="rounded-xl border border-border-strong px-6 py-3"
      >
        <Text className="text-text-secondary">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 5: Route by whether a pet exists**

Replace `app/index.tsx` so a signed-in user without a pet is sent to onboarding:

```tsx
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import { getMyPet } from "../lib/pets";

export default function Index() {
  const { session, loading } = useAuth();
  const [hasPet, setHasPet] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setHasPet(null);
      return;
    }
    getMyPet().then(({ pet }) => setHasPet(pet !== null));
  }, [session]);

  if (loading || (session && hasPet === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color="#A5F2F3" />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href={hasPet ? "/(tabs)" : "/onboarding"} />;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:e2e`
Expected: PASS — both `login.spec.ts` and `onboarding.spec.ts` green.

Note: the second onboarding test creates a pet, so re-running it against the same test account will land on `/(tabs)` before onboarding. Reset it between runs with `delete from pets;` in the Supabase SQL Editor — this only touches the e2e account's data, never the real Google-backed one.

- [ ] **Step 7: Run the whole suite and commit**

Run: `pnpm test && pnpm test:e2e`
Expected: all Jest and Playwright tests pass.

```bash
git add -A
git commit -m "feat: add pet onboarding and the authenticated tab shell"
```

---

### Task 9: Project documentation

**Files:**
- Create: `README.md`, `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything built in Tasks 1-8
- Produces: no code

**Split of responsibility** (per the user's explicit instruction): `README.md` is the entry point for a human developer — clone, run in dev, build for production, CI/CD — and must stay accurate as the project evolves. `AGENTS.md` is tool-agnostic agent guidance (constraints, secrets, commands, architecture) usable by any AI coding tool. `CLAUDE.md` is Claude-Code-specific: it imports `AGENTS.md`, then adds the documentation-maintenance mandate and pointers to project-scoped skills.

Before writing, read `package.json` for the exact installed versions of Expo, React Native, React, TypeScript, NativeWind and Supabase — do not hardcode versions from this plan, which was written before some of these were pinned by later tasks. Also confirm which scripts actually exist in `package.json` (Jest/Playwright scripts land in Tasks 6 and 5 respectively) and list exactly those.

**Known gap to document, not silently fix**: this app has no development-mode login bypass (PetFile, the parked sibling project, had one via a `bypassAuth` flag; Petlife does not). Every environment, including local dev, requires a real Google sign-in. Document this explicitly in the README rather than implying a bypass exists — do not invent one.

- [ ] **Step 1: Write the README**

Create `README.md` with these sections, in this order:

1. **Title and one-line description.**
2. **Primeros pasos** — clone, `pnpm install`, `cp .env.example .env` + fill Supabase credentials, `pnpm web` for the web target, `pnpm expo run:ios` / `pnpm expo run:android` for a native dev build (needed for Google sign-in — link to why in `docs/supabase-setup.md`).
3. **Secretos** — same content as the plan's earlier drafts: `EXPO_PUBLIC_*` vars are not secrets (RLS protects the data, not hiding the key); `service_role` and the Google client secret never enter the repo; the pre-commit hook (`.githooks/pre-commit`) blocks committing `.env` or key-shaped strings, and `pnpm install` wires it via the `prepare` script.
4. **Desarrollo y testing** — state plainly that there is no dev-mode auth bypass; every run needs a real Google sign-in. Document the Playwright e2e test account by email only (`loki-e2e@example.com` — never the password, which stays in `.env`), and how to run it (`pnpm test:e2e`, `pnpm test:e2e:ui` for visual debugging with the trace viewer). Document `pnpm test` for the Jest suite covering pure domain logic.
5. **Scripts** — a table with every script actually present in `package.json` at the time this task runs, one row each, plain description.
6. **Stack tecnológico** — a table (layer → technology → exact version from `package.json`): Expo/Expo Router, React Native, React, TypeScript, NativeWind/Tailwind, Supabase JS client, Jest, Playwright.
7. **Arquitectura** — directory map (`app/`, `lib/`, `supabase/migrations/`, `e2e/`) and the one invariant that matters most: screens never import `@supabase/supabase-js`, only `lib/supabase.ts` does. Mention the Postgres/RLS data model briefly (households-free, `pet_owners` join table is what makes v1 sharing an insert, not a redesign).
8. **Compilación de producción** — be honest about current state: native builds go through EAS (`eas build`), not yet configured in this repo (no `eas.json` exists yet — first real build needs `eas init`); the web target builds via `expo export --platform web` to a static bundle deployable to any static host. Do not claim more automation exists than does.
9. **CI/CD** — state plainly that none is configured yet in this repo, as a known gap rather than glossing over it.
10. **Documentación** — links to the spec (`docs/superpowers/specs/2026-09-02-petlife-design.md`) and the plans directory.

- [ ] **Step 2: Write AGENTS.md**

Create `AGENTS.md` with the same content as the plan's earlier draft (Constraints, Secrets, Commands, Definition of done, Commits, Architecture — reusing the exact text already validated in this plan), plus one addition: a **documentation maintenance** table mirroring the one PetFile uses (`AGENTS.md` in the sibling `petfile/` project, section "Mantenimiento de documentación"), adapted to this repo's actual files:

```markdown
## Documentation maintenance

Update README.md whenever you touch one of these:

| If you change…                          | Update…                                    |
| ---------------------------------------- | ------------------------------------------- |
| `package.json` scripts                   | README (Scripts)                             |
| `package.json` dependencies (versions)   | README (Stack tecnológico)                   |
| `supabase/migrations/`                   | README (Arquitectura), `docs/supabase-setup.md` if the setup flow itself changes |
| `.env.example`                           | README (Secretos)                            |
| Adding `eas.json` / a real CI workflow   | README (Compilación de producción / CI/CD)   |
```

- [ ] **Step 3: Write CLAUDE.md**

Create `CLAUDE.md`. It starts with the existing import (already present in the repo from the Expo template scaffold) and adds Claude-Code-specific guidance below it:

```markdown
@AGENTS.md

## Keeping documentation current

Before ending a session that touched `package.json` scripts/dependencies, `supabase/migrations/`, `.env.example`, or added build/CI tooling, check the table in AGENTS.md's "Documentation maintenance" section and update README.md accordingly. Stale docs are a defect, not a follow-up.

## Project-scoped skills

No project-scoped skills are configured in `.claude/skills/` for Petlife yet. If one is added later (for example, copying `impeccable` from the sibling `one-ui/` project for UI design work, per the design spec's decision to integrate it manually — see `docs/superpowers/specs/2026-09-02-petlife-design.md` section 11), list it here with what it's for, so a future session knows it exists without rediscovering it. A `graphify` knowledge graph is not set up for this repo; if one ever is, add the same read-before-architecture-questions rule the sibling `one-ui/` project uses.
```

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md CLAUDE.md
git commit -m "docs: add README, AGENTS.md, and CLAUDE.md with doc-maintenance policy"
```

---

## Done when

- [ ] `pnpm test` passes (pet validation and RPC mapping).
- [ ] `pnpm test:e2e` passes (Google button starts the OAuth flow, seeded session bypasses login, onboarding validation, onboarding success).
- [ ] Signing in with the real Google account on a fresh profile lands on `/onboarding`; after registering Loki it lands on the day view, and reopening the app goes straight there.
- [ ] The app renders in Nordic Ice dark mode with the Outfit typeface, on web and in a native dev build.
- [ ] `git log -p` contains no key material, and `.env` is untracked.

## Next plans

- **Routines** — recurrence engine in `lib/routines.ts`, daily occurrence materialisation, the Home checklist with swipe-to-complete/skip, walk duration chips, and the one-off item FAB.
- **Health** — `lib/health.ts` next-due-date calculation, weight and incident logging, the vaccine/deworming calendar, in-app due alerts, and the weight chart with `react-native-gifted-charts`.
