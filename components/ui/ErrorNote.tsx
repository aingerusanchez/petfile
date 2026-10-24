import { CircleAlert } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "./tokens";
import { Text } from "./Text";

type ErrorNoteProps = {
  /** The sentence, already in the app's voice. See `lib/failures.ts`. */
  message: string;
  /** Spacing below, so a caller can close the gap to its own Reintentar. */
  className?: string;
  testID?: string;
};

/**
 * A failure a tutor has to read, where it happened.
 *
 * **Red is the marker, not the reading**, and that is the whole component.
 * These paragraphs were drawn entirely in Error Red: #EF4444 measures
 * **5.01:1** on the diary's ground — AA for normal text by a hair, AAA not at
 * all — against `text-primary`'s **17.21:1**, which made the three lines
 * explaining why the day is missing the lowest-contrast text on the screen. A
 * tutor meets them every time they leave the house and the phone drops off
 * the house wifi. DESIGN.md has the precedent: the inactive tab label was
 * changed for measuring 3.83:1, because it was the last text in the app that
 * should be hard to read.
 *
 * **The toast already had the shape** — a status icon in the status colour
 * beside a message in `text-primary` — so this is the same anatomy on the
 * page rather than a new idea: 20px `CircleAlert` in Error Red, the sentence
 * neutral. The hue does not change, because Error Red means "the app failed"
 * and a lost connection is exactly that; only the weight does. The glyph also
 * keeps the severity off colour alone, which is the rule a red paragraph was
 * quietly leaning on.
 */
export function ErrorNote({
  message,
  className = "mb-5",
  testID,
}: ErrorNoteProps) {
  return (
    <View testID={testID} className={`flex-row items-start gap-3 ${className}`}>
      <CircleAlert size={20} color={colors.error} strokeWidth={2.5} />
      <Text
        testID={testID ? `${testID}-message` : undefined}
        accessibilityLiveRegion="polite"
        className="flex-1 text-text-primary"
      >
        {message}
      </Text>
    </View>
  );
}
