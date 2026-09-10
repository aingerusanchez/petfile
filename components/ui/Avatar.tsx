import { Camera } from "lucide-react-native";
import { Image, Pressable, View } from "react-native";
import { colors, pressed } from "./tokens";
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
 * **The affordance is a badge, not a band.** A word across the foot of the
 * circle read clearly but ate a slice of the one thing the header exists to
 * show — and the obvious way to soften it, revealing it on hover, does not
 * exist on a phone. A camera pinned to the circle's lower right takes no part
 * of the face, carries its own ground so it survives any photograph, and is
 * the mark every messaging app has already taught. It is a marker rather than
 * a control: the whole portrait is the target.
 */
export function Avatar({
  uri,
  name,
  size = 96,
  onPress,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();
  // A third of the portrait: big enough to read at 96dp, small enough that it
  // never competes with the face behind it.
  const badge = Math.round(size / 3);

  const portrait = (
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
    </>
  );

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
  } as const;

  // The clip has to be its own view: `overflow-hidden` is what rounds the
  // photograph, and it would cut the badge off at the same edge.
  const clipped = (
    <View
      style={frame}
      className="items-center justify-center overflow-hidden border border-border-default bg-elevated"
    >
      {portrait}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={frame}>
        {clipped}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={(state) => [frame, pressed(state)]}
    >
      {clipped}
      <View
        testID={testID ? `${testID}-badge` : undefined}
        // On the diagonal at the lower right, where a notification badge sits:
        // the corner of the bounding box is outside the circle, so pinning it
        // there lands it on the edge rather than over the face.
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: badge,
          height: badge,
          borderRadius: badge / 2,
        }}
        className="items-center justify-center border border-border-strong bg-elevated"
      >
        <Camera
          size={Math.round(badge / 2)}
          strokeWidth={2}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}
