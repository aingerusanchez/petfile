import { Text as RNText, type TextProps } from "react-native";

/**
 * Text in the app's own typeface.
 *
 * **Why a wrapper rather than a global rule.** `global.css` makes Outfit the
 * default on the web with a `[dir="auto"]` rule, which works because
 * react-native-web marks every rendered `<Text>` with that attribute. Native
 * has no such hook: the CSS compiler supports class selectors and nothing
 * else — universal and type selectors are dropped — so a bare `<Text>` on
 * Android inherited nothing and rendered in Roboto while headings, which name
 * `font-bold` explicitly, stayed in Outfit. One typeface is a design rule, and
 * a rule that only holds when each call site remembers to restate it is not a
 * rule, so the family is applied here, once.
 *
 * `font-sans` goes first so an explicit weight class from the caller still
 * wins: `--font-semibold` and `--font-bold` are declared after `--font-sans`
 * in the `@theme` block, so their utilities compile later and take precedence
 * at equal specificity regardless of the order they appear in `className`.
 *
 * Size is deliberately not set here: `text-base` would collide with the
 * `text-xs` labels wear, and font-size utilities resolve by compile order
 * rather than by call site.
 */
export function Text({ className, ...rest }: TextProps) {
  return (
    <RNText
      className={className ? `font-sans ${className}` : "font-sans"}
      {...rest}
    />
  );
}
