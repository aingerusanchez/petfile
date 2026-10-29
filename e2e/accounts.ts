/**
 * The dedicated throwaway Supabase accounts the suite signs in with, one per
 * Playwright worker, in worker order.
 *
 * Both halves live here so the config and the workers can never disagree about
 * how many accounts exist: `playwright.config.ts` caps the worker count on this
 * list, and `e2e/auth.ts` picks its own entry out of it.
 *
 * The addresses are an exact allow-list, never a pattern. `resetE2EPets` is an
 * unconditional delete of every pet the credentialed account owns, and this is
 * the only thing standing between a mistyped `.env` and a real user's records;
 * a prefix match like /^loki-e2e/ would turn the one check that guards a
 * destructive write into a guess. Adding a third account means adding it here,
 * deliberately, as well as in `.env`.
 *
 * The credentials are read through `values()` rather than captured at import,
 * because `playwright.config.ts` imports this module before it has called
 * `dotenv.config()` — ES imports are evaluated ahead of the importing module's
 * own body, so a value read up here would always be undefined there.
 */
export const E2E_ACCOUNTS = [
  {
    expected: "loki-e2e@example.com",
    emailVar: "E2E_EMAIL",
    passwordVar: "E2E_PASSWORD",
    values: () => ({
      email: process.env.E2E_EMAIL,
      password: process.env.E2E_PASSWORD,
    }),
  },
  {
    expected: "loki-e2e-2@example.com",
    emailVar: "E2E_EMAIL_2",
    passwordVar: "E2E_PASSWORD_2",
    values: () => ({
      email: process.env.E2E_EMAIL_2,
      password: process.env.E2E_PASSWORD_2,
    }),
  },
];

/**
 * How many of them `.env` actually carries, counted up to the first gap.
 *
 * Only names are compared, never values, and nothing from `.env` is printed.
 */
export function configuredAccounts(): number {
  const gap = E2E_ACCOUNTS.findIndex((account) => {
    const { email, password } = account.values();
    return !email || !password;
  });
  return gap === -1 ? E2E_ACCOUNTS.length : gap;
}
