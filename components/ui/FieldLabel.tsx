import { Text } from "react-native";

type FieldLabelProps = {
  children: string;
  /** Links this label to its input via `accessibilityLabelledBy`. */
  nativeID?: string;
  /** Marks the field as not required. Rendered as a visible word, never colour alone. */
  optional?: boolean;
};

/**
 * The uppercase label above a form field or a chip group.
 *
 * DESIGN.md's Label role specifies 600 weight, 12px, uppercase **and +0.05em
 * tracking**. All eight hand-written copies of this label in onboarding
 * dropped the tracking; centralising it fixes every one of them at once.
 */
export function FieldLabel({ children, nativeID, optional = false }: FieldLabelProps) {
  return (
    <Text
      nativeID={nativeID}
      className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-text-tertiary"
    >
      {children}
      {optional ? (
        <Text className="font-semibold normal-case tracking-normal text-text-tertiary">
          {"  ·  opcional"}
        </Text>
      ) : null}
    </Text>
  );
}
