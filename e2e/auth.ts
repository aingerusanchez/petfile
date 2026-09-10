import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

/** The dedicated throwaway account documented in README.md and docs/supabase-setup.md. */
const E2E_ACCOUNT_EMAIL = "loki-e2e@example.com";

function requireEnv(): {
  url: string;
  anonKey: string;
  email: string;
  password: string;
} {
  if (!url || !anonKey || !email || !password) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY, E2E_EMAIL or E2E_PASSWORD. See docs/supabase-setup.md.",
    );
  }
  return { url, anonKey, email, password };
}

type SignedIn = Awaited<ReturnType<typeof authenticate>>;

async function authenticate() {
  const env = requireEnv();
  const client = createClient(env.url, env.anonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: env.email,
    password: env.password,
  });
  if (error || !data.session) {
    throw new Error(
      `E2E sign-in failed: ${error?.message ?? "no session returned"}`,
    );
  }

  return { client, session: data.session, url: env.url };
}

/**
 * One sign-in per run, reused by every test.
 *
 * Each test used to authenticate twice — once for `resetE2EPets` and once for
 * `seedSession` — which at ~20 tests is ~40 sign-ins per run and trips
 * Supabase's auth rate limit ("Request rate limit reached"), failing the suite
 * for a reason that has nothing to do with the app. `workers: 1` in
 * playwright.config.ts means this module-level cache is shared by the whole
 * run, and a run takes well under a minute, so the session cannot go stale
 * inside it.
 */
let signedIn: Promise<SignedIn> | null = null;

function signInE2EUser(): Promise<SignedIn> {
  signedIn ??= authenticate();
  return signedIn;
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
 * membership rows are left behind. Storage does **not** cascade, so the
 * pets' photo objects are removed here first.
 */
export async function resetE2EPets(): Promise<void> {
  // Defence in depth: this is an unconditional delete of every pet the
  // credentialed account can see. RLS scopes it to that account, so a
  // misconfigured `.env` pointing E2E_EMAIL at a real user would silently
  // destroy that user's real pet records. Refuse to run unless the account
  // is the documented throwaway one (README.md, docs/supabase-setup.md).
  if (email !== E2E_ACCOUNT_EMAIL) {
    throw new Error(
      `Refusing to reset pets: E2E_EMAIL is not the dedicated test account (${E2E_ACCOUNT_EMAIL}). ` +
        "resetE2EPets deletes every pet the credentialed account owns — check your .env.",
    );
  }

  const { client } = await signInE2EUser();

  // Storage first, because the paths are derived from the pet ids and those
  // are about to be gone. A photo the suite uploaded is data the suite
  // created, and deleting the row would leave the object behind as litter in
  // a bucket nothing else cleans. The folder is listed rather than read from
  // `photo_url`, so a half-finished upload is collected too.
  const { data: pets } = await client.from("pets").select("id");
  for (const pet of pets ?? []) {
    const { data: files } = await client.storage
      .from("pet-photos")
      .list(pet.id);
    const paths = (files ?? []).map((file) => `${pet.id}/${file.name}`);
    if (paths.length > 0) {
      const { error: storageError } = await client.storage
        .from("pet-photos")
        .remove(paths);
      // Not fatal: the rows are what the next test needs gone, and a storage
      // failure here must not fail a suite for an unrelated reason.
      if (storageError) {
        console.warn(`Could not remove e2e photos: ${storageError.message}`);
      }
    }
  }

  const { error } = await client.from("pets").delete().not("id", "is", null);
  if (error) {
    throw new Error(`Failed to reset e2e pets: ${error.message}`);
  }
}

/**
 * Puts entries straight into `pet_events`, for a spec that needs a month of
 * them rather than a handful.
 *
 * Through the client rather than the UI: seeding thirty days of a realistic
 * pattern by driving the sheet would take minutes and prove nothing about the
 * sheet. Guarded by the same account check as everything else here, and the
 * rows cascade away with the pet on `resetE2EPets`.
 */
export async function seedE2EEvents(
  petId: string,
  rows: {
    kind: "walk" | "meal" | "medication" | "incident";
    occurredAt: Date;
    durationMinutes?: number | null;
    note?: string | null;
    what?: string | null;
  }[],
): Promise<void> {
  if (email !== E2E_ACCOUNT_EMAIL) {
    throw new Error(
      `Refusing to seed events: E2E_EMAIL is not the dedicated test account (${E2E_ACCOUNT_EMAIL}).`,
    );
  }

  const { client } = await signInE2EUser();
  const { error } = await client.from("pet_events").insert(
    rows.map((row) => ({
      pet_id: petId,
      kind: row.kind,
      occurred_at: row.occurredAt.toISOString(),
      duration_minutes: row.durationMinutes ?? null,
      note: row.note ?? null,
      details: row.what ? { what: row.what } : {},
    })),
  );
  if (error) throw new Error(`Failed to seed e2e events: ${error.message}`);
}

/**
 * Creates the pet the profile specs edit.
 *
 * Through the same RPC the app uses, so the row is shaped exactly as a
 * registration leaves it — a hand-written insert would drift from the real one
 * and hide the drift. Guarded by the same account check as `resetE2EPets`,
 * since it writes to whatever account the credentials name.
 */
export async function seedE2EPet(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  if (email !== E2E_ACCOUNT_EMAIL) {
    throw new Error(
      `Refusing to seed a pet: E2E_EMAIL is not the dedicated test account (${E2E_ACCOUNT_EMAIL}).`,
    );
  }

  const client = (await signInE2EUser()).client;

  // The RPC writes only what registration collects. An override outside that
  // set — the exercise goal, a photo path — is applied afterwards, exactly as
  // the profile screen would, rather than being passed to a function that
  // would silently drop it.
  const registration = new Set([
    "name",
    "sex",
    "breed_primary",
    "breed_secondary",
    "is_mixed",
    "birth_date",
    "birth_date_approximate",
    "spayed_neutered",
    "activity_level",
  ]);
  const atRegistration: Record<string, unknown> = {};
  const afterwards: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    (registration.has(key) ? atRegistration : afterwards)[key] = value;
  }

  const { data, error } = await client.rpc("create_pet_with_owner", {
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
      ...atRegistration,
    },
  });

  if (error) throw new Error(`Failed to seed an e2e pet: ${error.message}`);
  const id = (data as { id: string }).id;

  if (Object.keys(afterwards).length > 0) {
    const { error: updateError } = await client
      .from("pets")
      .update(afterwards)
      .eq("id", id);
    if (updateError) {
      throw new Error(`Failed to seed pet extras: ${updateError.message}`);
    }
  }

  return id;
}

/**
 * Whether `0006_events_weights_treatments.sql` has been applied.
 *
 * Probed rather than assumed, so the day-view specs skip with a message that
 * names the migration instead of failing for a reason that has nothing to do
 * with the app — and start running by themselves once it lands.
 */
export async function eventsTableExists(): Promise<boolean> {
  const { client } = await signInE2EUser();
  const { error } = await client.from("pet_events").select("id").limit(1);
  return !error;
}
