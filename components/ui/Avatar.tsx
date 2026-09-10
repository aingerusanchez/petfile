import { Image, Pressable, View } from "react-native";
import { pressed } from "./tokens";
import { Text } from "./Text";

type AvatarProps = {
  /** A signed URL from `lib/photos.ts`, or null while there is no photo. */
  uri: string | null;
  /** The pet's name, for the initial that stands in for a missing photo. */
  name: string;
  /** Side length in dp. The profile uses the default. */
  size?: number;
  /**
   * Makes the portrait itself the way the photo is changed.
   *
   * The alternative was a pair of links beside it, which is one more thing on
   * a page that exists to present the animal — and the portrait is where a
   * tutor reaches first anyway.
   */
  onPress?: () => void;
  /** The word on the band across the foot of the circle. Needs `onPress`. */
  actionLabel?: string;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * The animal's picture, or its initial.
 *
 * **A circle.** It was a squared record photo first, on the reasoning that the
 * product's thesis is the animal's _file_ and that a circle would make a
 * second exception to The One Radius Rule. Tried with a real photo of a real
 * dog, the square lost: a dog's head is round, the crop that flatters it is
 * round, and the square framed the animal like an ID document. The reasoning
 * was sound and the result was wrong, which is what testing with real content
 * is for. It is the system's second radius exception, and the last one.
 *
 * **The initial is a complete answer, not a placeholder.** With nothing stored
 * it draws the name's initial in `text-primary` at two-fifths of the frame.
 * Most tutors will never add a photo, and a broken frame, a camera glyph or a
 * nudge charges rent for a decision they already made. The initial is
 * deliberately **not** in the accent: the accent means "act here" (The One
 * Accent Rule), and a portrait is not an action.
 *
 * **The action band is always visible, not revealed on hover.** There is no
 * hover on a phone, so an affordance that waits for one is an affordance that
 * never appears — the band is a permanent, quiet part of the portrait.
 */
export function Avatar({
  uri,
  name,
  size = 96,
  onPress,
  actionLabel,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  const body = (
    <>
      {uri ? (
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          // The photo is the pet, and the screen already names it: announcing
          // "foto de Loki" next to the heading "Loki" says it twice.
          accessible={false}
        />
      ) : (
        <Text
          testID={testID ? `${testID}-initial` : undefined}
          accessibilityLabel={onPress ? undefined : `${name}, sin foto`}
          style={{ fontSize: size / 2.5, lineHeight: size / 2 }}
          className="font-bold text-text-primary"
        >
          {initial}
        </Text>
      )}
      {onPress && actionLabel ? (
        // Polar Night at 85% rather than a token fill: what sits behind it is
        // an arbitrary photograph, so the band has to make its own ground.
        <View className="absolute bottom-0 left-0 right-0 items-center bg-base/85 py-1">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-primary">
            {actionLabel}
          </Text>
        </View>
      ) : null}
    </>
  );

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
  } as const;

  if (!onPress) {
    return (
      <View
        testID={testID}
        style={frame}
        className="items-center justify-center overflow-hidden border border-border-default bg-elevated"
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? actionLabel}
      style={(state) => [frame, pressed(state)]}
      className="items-center justify-center overflow-hidden border border-border-default bg-elevated"
    >
      {body}
    </Pressable>
  );
}
