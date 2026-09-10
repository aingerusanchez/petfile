import { Redirect } from "expo-router";
import type { ComponentType } from "react";

/**
 * Expo Router's generated `/_sitemap`, kept in development and closed in
 * production.
 *
 * That screen lists every route and adds a System Information panel reporting
 * NODE_ENV, the Expo SDK version, the Hermes version and the location origin.
 * It carries no `__DEV__` guard of its own and defaults to being included
 * (`sitemap: config?.sitemap ?? true`), so it would ship. Nothing behind it is
 * unprotected — the session guards hold — but it is a developer tool, and a
 * released app should not hand out its own route map and build metadata.
 *
 * `appendSitemapRoute` only generates the built-in when the app has not
 * defined `_sitemap` itself, so this file is the documented way to take the
 * route over. Requiring the built-in lazily and only under `__DEV__` keeps it
 * usable while developing, at the cost of one internal import path: if a
 * future expo-router moves it, the guard degrades to the redirect and only
 * development loses a convenience.
 */
export default function Sitemap() {
  // The require is what needs guarding, not the render. Constructing the JSX
  // inside the try would be a mistake of its own: React does not render on
  // the spot, so a render error would escape the catch anyway — which is what
  // `react-hooks/error-boundaries` is pointing at.
  let Generated: ComponentType | null = null;
  if (__DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Generated = require("expo-router/build/views/Sitemap")?.Sitemap ?? null;
    } catch {
      Generated = null;
    }
  }

  return Generated ? <Generated /> : <Redirect href="/" />;
}
