const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // Give className support to plain react-native primitives (View, Text, ...)
  // so app code can import them directly instead of wrapping every element.
  globalClassNamePolyfill: true,
});
