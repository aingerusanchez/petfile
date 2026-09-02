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
