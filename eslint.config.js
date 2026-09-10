const expo = require("eslint-config-expo/flat");

/**
 * Lint rules for this app.
 *
 * `expo lint` had no configuration at all, so it reported nothing — which
 * matters more than it sounds: nothing was checking hook dependency arrays,
 * and this codebase has already hand-fixed two "the callback kept the first
 * render's value" bugs (the slider's and the photo editor's PanResponder).
 * `react-hooks/exhaustive-deps` is the rule that catches that family.
 *
 * On top of Expo's own config, three of the project's written invariants stop
 * being greps in AGENTS.md and become errors here.
 */
module.exports = [
  ...expo,

  {
    ignores: [
      // Vendored tooling and generated native projects.
      ".claude/**",
      ".impeccable/**",
      "android/**",
      "ios/**",
      ".expo/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
      "expo-env.d.ts",
    ],
  },

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // AGENTS.md: strict mode is on and no `any` reaches a commit.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // An unused import is dead weight the formatter will not remove;
      // an unused argument prefixed with _ is a deliberate signature.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // A stale dependency array is the one React bug that looks like a data
      // bug, so it is an error here rather than Expo's default warning.
      "react-hooks/exhaustive-deps": "error",
    },
  },

  {
    // The design system's two import invariants, previously enforced by a
    // grep in AGENTS.md and by whoever remembered to run it.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                "Import Text from components/ui — it is the only thing applying the typeface on native, where a bare <Text> falls back to Roboto.",
            },
            {
              name: "@supabase/supabase-js",
              message:
                "Screens never talk to Supabase directly. Go through lib/, whose only import site is lib/supabase.ts.",
            },
          ],
        },
      ],
    },
  },

  {
    // The one legitimate place a bare Text is constructed.
    files: ["components/ui/Text.tsx"],
    rules: { "no-restricted-imports": "off" },
  },

  {
    // Test setup, not app runtime: e2e/auth.ts builds its own client on
    // purpose, and specs are free to reach for whatever they need.
    files: ["e2e/**/*.ts", "**/__tests__/**/*.ts", "jest.setup.ts"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
