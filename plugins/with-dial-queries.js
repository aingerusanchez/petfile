const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Lets the app see the dialer.
 *
 * **Android 11 hid it, and nothing said so.** Package visibility means an app
 * can only resolve intents for schemes it declares in `<queries>`, and Expo's
 * generated manifest declares `https` and nothing else — so
 * `Linking.openURL("tel:944260051")` could not resolve an activity, rejected,
 * and the tap on a clinic's phone number did exactly nothing. No crash, no
 * log, no dialer. Measured on the device; the browser opens `tel:` happily
 * and can never show this.
 *
 * `android/` is generated and gitignored, so this is the only place the
 * declaration survives a `prebuild`.
 */
module.exports = function withDialQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries ?? [];

    const declared = manifest.queries.some((entry) =>
      (entry.intent ?? []).some((intent) =>
        (intent.data ?? []).some(
          (data) => data.$?.["android:scheme"] === "tel",
        ),
      ),
    );
    if (declared) return config;

    manifest.queries.push({
      intent: [
        {
          action: [{ $: { "android:name": "android.intent.action.DIAL" } }],
          data: [{ $: { "android:scheme": "tel" } }],
        },
      ],
    });

    return config;
  });
};
