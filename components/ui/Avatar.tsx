import { Image, View } from "react-native";
import { Text } from "./Text";

type AvatarProps = {
  /** A signed URL from `lib/photos.ts`, or null while there is no photo. */
  uri: string | null;
  /** The pet's name, for the initial that stands in for a missing photo. */
  name: string;
  /** Side length in dp. The profile uses the default. */
  size?: number;
  testID?: string;
};

/**
 * The animal's picture, or its initial.
 *
 * **A squared record photo, not a circular social avatar.** The system has one
 * radius and one recorded exception, and a circle here would make it two — but
 * the reason to keep the square is not only bookkeeping. The product's thesis
 * is the animal's *file*: a dossier, not a profile. A squared photo at the
 * system radius reads as a record photo; a circle reads as a social account,
 * which is the one thing this app is not.
 *
 * **The initial is a complete answer, not a placeholder.** Most tutors will
 * never add a photo, and a screen that treats that as missing data — a broken
 * frame, a camera glyph, a nudge — charges rent for a decision they already
 * made. The initial in `text-primary` on Elevated Frost is finished-looking on
 * its own. It is deliberately not in the accent: the accent means "act here"
 * (The One Accent Rule), and a portrait is not an action.
 */
export function Avatar({ uri, name, size = 96, testID }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <View
      testID={testID}
      // The literal side and radius keep the square proportional at any size:
      // the system's 12px on a 96dp box is a subtler corner than on a 48dp
      // control, which is the right relationship for a photo.
      style={{ width: size, height: size, borderRadius: 12 }}
      className="items-center justify-center overflow-hidden border border-border-default bg-elevated"
    >
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
          accessibilityLabel={`${name}, sin foto`}
          style={{ fontSize: size / 2.5, lineHeight: size / 2 }}
          className="font-bold text-text-primary"
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
