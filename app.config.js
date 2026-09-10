/**
 * The build's identity, with `package.json` as the single source for the
 * version.
 *
 * `app.json` stays the readable base — icons, scheme, plugins — and this file
 * overrides the one field that must never drift: two places to bump a version
 * is one place to forget. Expo passes the static config in and takes what
 * comes back.
 *
 * **The version is what tells a build apart from the one already installed.**
 * A stale APK cost an afternoon of chasing a bug that was already fixed, so it
 * is shown at the foot of the login screen and of Ajustes, and `android:apk`
 * is only honest if the version was bumped before it ran. `versionCode` rides
 * along from the patch number so Android sees an upgrade rather than a
 * reinstall.
 */
const { version } = require("./package.json");

const [major, minor, patch] = version.split(".").map(Number);

module.exports = ({ config }) => ({
  ...config,
  version,
  android: {
    ...config.android,
    versionCode: major * 10000 + minor * 100 + patch,
  },
});
