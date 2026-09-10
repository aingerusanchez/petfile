/**
 * The build's identity, with `package.json` as the single source for the
 * version — and the commit it was built from, because the version alone was
 * not enough.
 *
 * `app.json` stays the readable base — icons, scheme, plugins — and this file
 * overrides the fields that must never drift: two places to bump a version is
 * one place to forget.
 *
 * **Why the commit hash is here.** A stale APK cost an afternoon of chasing a
 * bug that was already fixed, so the version was added to catch it. Then two
 * builds went out at the same version and it happened again in miniature: the
 * phone was three commits behind and nothing on screen could say so. A version
 * only separates builds if somebody remembers to bump it; a commit hash
 * separates them for free.
 *
 * `+` means the working tree had uncommitted changes when the build ran, which
 * is the other thing worth knowing about a build nobody can reproduce.
 */
const { execSync } = require("node:child_process");
const { version } = require("./package.json");

/** The commit, or null where git is not available — EAS, a tarball, CI. */
function commit() {
  try {
    const sha = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const dirty =
      execSync("git status --porcelain", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim().length > 0;
    return sha ? `${sha}${dirty ? "+" : ""}` : null;
  } catch {
    return null;
  }
}

const [major, minor, patch] = version.split(".").map(Number);

module.exports = ({ config }) => ({
  ...config,
  version,
  android: {
    ...config.android,
    versionCode: major * 10000 + minor * 100 + patch,
  },
  extra: { ...config.extra, commit: commit() },
});
