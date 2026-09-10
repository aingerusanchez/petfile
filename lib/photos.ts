import * as ImagePicker from "expo-image-picker";
import { describeFailure, withTimeout } from "./failures";
import { supabase } from "./supabase";

/**
 * The pet's avatar: picking it, storing it, and reading it back.
 *
 * **`pets.photo_url` holds an object path, not a URL.** The bucket is private
 * (see `0005_pet_photos_bucket.sql`), because a public bucket would be the one
 * place where holding a link beats the RLS policies. So the column stores
 * `<pet_id>/avatar.jpg` and this module signs a short-lived URL when a screen
 * needs to render it. The column name is inherited and now half a lie; the
 * migration says so too.
 *
 * **One object per pet.** The path is derived from the pet's id, so a new
 * photo replaces the old one rather than leaving a file nobody will look at
 * again. That is what `upsert` buys here.
 */

const BUCKET = "pet-photos";

/** How long a rendered photo's URL stays valid. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Opens the system picker, square-cropped.
 *
 * Square because the avatar is a squared record photo everywhere it appears
 * (see `components/ui/Avatar.tsx`), and cropping at pick time means the tutor
 * chooses what survives the crop instead of discovering later that the app cut
 * their dog's head off.
 *
 * Returns null when the tutor backs out, which is not a failure.
 */
export async function pickPetPhoto(): Promise<{
  uri: string | null;
  error: string | null;
}> {
  try {
    // Android 13+ needs no read permission for the system photo picker, and
    // asking for one anyway is a dialog the tutor has to dismiss for nothing.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return { uri: null, error: null };
    return { uri: result.assets[0].uri, error: null };
  } catch (cause) {
    return { uri: null, error: describeFailure(cause, "pickPetPhoto") };
  }
}

/** The object path a pet's photo lives at, whatever its extension. */
export function photoPath(petId: string, uri: string): string {
  const extension = /\.(jpe?g|png|webp|heic)$/i.exec(uri)?.[1]?.toLowerCase();
  return `${petId}/avatar.${extension === "jpeg" ? "jpg" : (extension ?? "jpg")}`;
}

/**
 * Uploads a picked image and returns the path to store in `photo_url`.
 *
 * The file is read through `fetch` into an ArrayBuffer rather than handed over
 * as a React Native `FormData` blob: on Android the blob route uploads zero
 * bytes for a `file://` URI, which is the kind of failure that looks like a
 * success until someone tries to look at the picture.
 */
export async function uploadPetPhoto(
  petId: string,
  uri: string,
): Promise<{ path: string | null; error: string | null }> {
  const path = photoPath(petId, uri);

  try {
    const body = await withTimeout(
      fetch(uri).then((response) => response.arrayBuffer()),
      "readPickedPhoto",
    );

    const { error } = await withTimeout(
      supabase.storage.from(BUCKET).upload(path, body, {
        contentType: uri.endsWith(".png") ? "image/png" : "image/jpeg",
        upsert: true,
      }),
      "uploadPetPhoto",
    );

    if (error)
      return { path: null, error: describeFailure(error, "uploadPetPhoto") };
    return { path, error: null };
  } catch (cause) {
    return { path: null, error: describeFailure(cause, "uploadPetPhoto") };
  }
}

/**
 * A URL a screen can render, valid for an hour.
 *
 * Returns null rather than an error string when there is no photo or the
 * signing fails: a missing avatar falls back to the pet's initial, which is a
 * complete answer on its own and not worth a message.
 */
export async function signedPhotoUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;

  try {
    const { data, error } = await withTimeout(
      supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS),
      "signedPhotoUrl",
    );
    if (error) {
      describeFailure(error, "signedPhotoUrl");
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (cause) {
    describeFailure(cause, "signedPhotoUrl");
    return null;
  }
}

/** Removes the stored object. The column is cleared by the caller's update. */
export async function removePetPhoto(
  path: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await withTimeout(
      supabase.storage.from(BUCKET).remove([path]),
      "removePetPhoto",
    );
    return { error: error ? describeFailure(error, "removePetPhoto") : null };
  } catch (cause) {
    return { error: describeFailure(cause, "removePetPhoto") };
  }
}
