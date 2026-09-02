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
(or run `npx supabase db push` with the CLI linked to the project).

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
