import { Redirect } from "expo-router";

/**
 * Closes Expo Router's generated `/_sitemap`.
 *
 * That screen lists every route in the app and adds a System Information panel
 * reporting NODE_ENV, the Expo SDK version, the Hermes version and the
 * location origin. It carries no `__DEV__` guard of its own and defaults to
 * being included (`sitemap: config?.sitemap ?? true`), so it ships. Nothing
 * behind it is unprotected — the session guards hold — but a debug surface in
 * a published app is worth closing on principle.
 *
 * `appendSitemapRoute` only generates the built-in when the app has not
 * defined `_sitemap` itself, so this file is the documented way to override
 * it. The cost is losing the route listing in development, which this project
 * never used.
 */
export default function Sitemap() {
  return <Redirect href="/" />;
}
