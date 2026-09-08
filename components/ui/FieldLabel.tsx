import { Text } from "react-native";
import { colors } from "./tokens";

type FieldLabelProps = {
  children: string;
  /** Links this label to its input via `accessibilityLabelledBy`. */
  nativeID?: string;
  /**
   * Marks the field as one that blocks a save.
   *
   * **Required is marked, not optional.** Only two fields in the whole
   * registration qualify — the name, which identifies the animal, and the
   * birth date, which yields its age — so marking those two is less ink than
   * marking everything else, and it answers the question a tutor actually has:
   * what do I have to give to get past this screen. Marking the optional ones
   * instead framed skippable data as the exception when it is the majority.
   *
   * Everything visible at registration still reads at the same weight: the
   * marker says what blocks a save, not what matters.
   */
  required?: boolean;
  /**
   * This field's own error state — never a sibling's. The asterisk turns Error
   * Red so the label carries the fault too, which matters once the message
   * below it has scrolled out of view.
   */
  errored?: boolean;
};

/**
 * The uppercase label above a form field or a chip group.
 *
 * DESIGN.md's Label role specifies 600 weight, 12px, uppercase **and +0.05em
 * tracking**. All eight hand-written copies of this label in onboarding
 * dropped the tracking; centralising it fixes every one of them at once.
 */
export function FieldLabel({
  children,
  nativeID,
  required = false,
  errored = false,
}: FieldLabelProps) {
  return (
    <Text
      nativeID={nativeID}
      // The asterisk carries the meaning, not the colour — so this satisfies
      // the rule against communicating state by colour alone even though the
      // glyph is tinted. Aqua Glaciar keeps Ice Blue Glacial free to mean
      // "act here" (The One Accent Rule).
      className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-text-tertiary"
      // Screen readers get the word, not a punctuation mark read aloud.
      accessibilityLabel={
        required
          ? `${children}, obligatorio${errored ? ", con error" : ""}`
          : children
      }
    >
      {children}
      {required ? (
        <Text
          style={{ color: errored ? colors.error : colors.accentSecondary }}
        >
          {" *"}
        </Text>
      ) : null}
    </Text>
  );
}
