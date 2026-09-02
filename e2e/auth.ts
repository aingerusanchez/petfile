import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

function requireEnv(): { url: string; anonKey: string; email: string; password: string } {
  if (!url || !anonKey || !email || !password) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY, E2E_EMAIL or E2E_PASSWORD. See docs/supabase-setup.md.",
    );
  }
  return { url, anonKey, email, password };
}

async function signInE2EUser() {
  const env = requireEnv();
  const client = createClient(env.url, env.anonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: env.email,
    password: env.password,
  });
  if (error || !data.session) {
    throw new Error(`E2E sign-in failed: ${error?.message ?? "no session returned"}`);
  }

  return { client, session: data.session, url: env.url };
}

export async function seedSession(page: Page): Promise<void> {
  const { session, url: supabaseUrl } = await signInE2EUser();

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)] as const,
  );
}

/**
 * Deletes every pet owned by the e2e account, so onboarding tests start from
 * a clean slate on every run instead of accumulating duplicate rows.
 *
 * Uses the ordinary publishable key (never the privileged admin key). The
 * "pets deletable by their owners" RLS policy (Task 3's migration) means
 * this can only ever touch rows owned by the signed-in e2e account.
 * `pet_owners` rows cascade from `pets` on delete, so no orphaned
 * membership rows are left behind.
 */
export async function resetE2EPets(): Promise<void> {
  const { client } = await signInE2EUser();
  const { error } = await client.from("pets").delete().not("id", "is", null);
  if (error) {
    throw new Error(`Failed to reset e2e pets: ${error.message}`);
  }
}
