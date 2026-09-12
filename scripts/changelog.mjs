#!/usr/bin/env node
/**
 * Copies `CHANGELOG.md` into a module the bundler can reach.
 *
 * **Metro cannot import Markdown, and `app.config.js`'s `extra` cannot carry
 * it.** The commit hash rides in `extra` happily; 5KB of changelog does not
 * arrive on the web target at all — measured, with the value present in
 * `expo config --type public` and absent from `Constants.expoConfig` in the
 * running app. So the file becomes a module, generated from the same source.
 *
 * The generated file is committed, so a fresh clone builds without running
 * anything first, and `lib/__tests__/changelog.test.ts` fails when it drifts
 * from the Markdown — which is what keeps "read at build time" honest rather
 * than aspirational.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";

const root = process.cwd();
const source = readFileSync(join(root, "CHANGELOG.md"), "utf8");

const out = `// Generated from CHANGELOG.md by scripts/changelog.mjs. Do not edit.
// \`pnpm changelog\` regenerates it; a test fails if the two drift.
export const CHANGELOG = ${JSON.stringify(source)};
`;

/**
 * Formatted before it is written, because otherwise it is written twice.
 *
 * `JSON.stringify` always emits double quotes and escapes the ones inside;
 * Prettier picks whichever quote costs fewer escapes, which for a changelog
 * full of "quoted words" is the single one. So every run of this script left a
 * modified file that the pre-commit hook immediately reformatted back —
 * a diff that appeared out of nowhere three times before anybody chased it.
 */
const formatted = await format(out, {
  filepath: join(root, "lib/changelog.generated.ts"),
});

writeFileSync(join(root, "lib/changelog.generated.ts"), formatted);
console.log(`changelog: ${source.length} chars -> lib/changelog.generated.ts`);
