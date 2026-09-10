import { useRouter } from "expo-router";
import { Mars, Pencil, Power, Trash2, Venus } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import {
  Avatar,
  AvatarEditor,
  BreedField,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  DateField,
  Group,
  LoadingScreen,
  Screen,
  Text,
  TextField,
  colors,
  pressed,
  useToast,
} from "../../components/ui";
import { describeAge } from "../../lib/age";
import { useAuth } from "../../lib/auth";
import { parseISO, toApproximateISO } from "../../lib/dates";
import {
  DURATION_HINT,
  formatDuration,
  parseDuration,
} from "../../lib/duration";
import {
  deletePet,
  getMyPet,
  isMixedShown,
  petEditFromRow,
  updatePet,
  updatePetPhoto,
  validatePetDraft,
  withMixed,
  type PetEdit,
  type PetRow,
} from "../../lib/pets";
import {
  cropToSquare,
  pickPetPhoto,
  removePetPhoto,
  signedPhotoUrl,
  uploadPetPhoto,
} from "../../lib/photos";

type ActivityLevel = NonNullable<PetEdit["activityLevel"]>;

const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: "low", label: "Bajo" },
  { value: "moderate", label: "Moderado" },
  { value: "high", label: "Alto" },
];

const NEUTERED: { value: boolean | null; label: string; testId: string }[] = [
  { value: true, label: "Sí", testId: "yes" },
  { value: false, label: "No", testId: "no" },
  { value: null, label: "No sé", testId: "unknown" },
];

/** Which block is open for editing. Only ever one. */
type Section = "main" | "health" | null;

/**
 * One line of the file: what it is called, and what it says.
 *
 * Announced as a single item — "Esterilizado: Sí" — because a screen reader
 * moving through two nodes per row reads a list of labels and then a list of
 * answers.
 */
function Row({
  label,
  value,
  muted = false,
  testID,
}: {
  label: string;
  value: string;
  /** For a value that is an absence rather than an answer. */
  muted?: boolean;
  testID?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="mb-4 flex-row items-baseline justify-between gap-4"
    >
      <Text className="font-semibold text-xs tracking-[0.05em] text-text-tertiary uppercase">
        {label}
      </Text>
      <Text
        testID={testID}
        numberOfLines={2}
        className={`flex-1 text-right ${muted ? "text-text-tertiary" : "text-text-primary"}`}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The pet's file: a page that presents the animal, with the form behind a door.
 *
 * **A CV, not a form.** The screen a tutor opens to look at their dog should
 * read like a record — photo, name, breed, age — and not like eight inputs
 * waiting to be corrected. A permanently editable form makes every visit feel
 * like data entry, puts a save button on a screen nobody came to save, and
 * gives the most destructive action in the app a permanent seat. So the data
 * is presented, and each block carries its own "Editar…" button that swaps
 * that block — and only that block — for its fields.
 *
 * **One block open at a time.** Two open forms mean two dirty states and two
 * save buttons disagreeing about what is unsaved, for no gain: an edit here is
 * one deliberate correction.
 *
 * **The header is where missing data shows.** The four fields it presents are
 * all optional except the name and the birth date, so a thin file is a real
 * outcome — and the honest response is to drop the line and offer the door,
 * not to draw an empty row or caption the hole. A missing breed simply is not
 * there; the initial stands in for the photo; and one link invites whatever is
 * left. See `components/ui/Avatar.tsx` on why the initial is a complete answer
 * rather than a gap.
 *
 * **The portrait is the way the photo changes.** Tapping it opens
 * `AvatarEditor`, which frames the picture against the circle it will appear
 * in. That is why the photo is not among the fields behind the edit door: it
 * has a better affordance of its own, and two paths to one action is the
 * ambiguity this screen is trying to remove.
 *
 * **Explicit save, not per-field autosave.** The same contract the onboarding
 * form uses: validate on submit, forgive on input. Autosave reads as less
 * friction until the required field is empty (what would it save?) or the
 * network drops (six requests, six separate failures to explain).
 *
 * **The form's layout is duplicated from onboarding; its behaviour is not.**
 * What must never drift between the two screens — validation, the mixed-breed
 * coupling, the payload — lives in `lib/pets.ts` and is unit-tested. The JSX
 * around it is inert, and pulling it into a shared component is a job for
 * `/impeccable extract` rather than something to invent here.
 */
export default function Profile() {
  const { signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [pet, setPet] = useState<PetRow | null>(null);
  const [edit, setEdit] = useState<PetEdit | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * Which fields have been submitted, not what is wrong with them.
   *
   * **Forgive on input, derived rather than synchronised.** This used to be a
   * map of messages plus an effect that pruned it on every keystroke, which is
   * a cascading render for something that is not state at all: the messages
   * are a pure function of the draft, and what the tutor's submit actually
   * changed is *which fields are allowed to speak*. Keeping the keys and
   * deriving the messages is the same behaviour with nothing to keep in step —
   * an error still cannot appear for a field nobody submitted, and it still
   * clears the moment that field becomes valid.
   */
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [editing, setEditing] = useState<Section>(null);
  const [editingPhoto, setEditingPhoto] = useState(false);
  /**
   * What the goal field shows while it is being typed into.
   *
   * The stored value is a number of minutes and the field speaks hours, so the
   * text cannot be derived from the number on every keystroke — "5h" would
   * become "5 min" halfway through typing it. The buffer holds what was typed
   * and is tidied when the field loses focus.
   */
  const [goalText, setGoalText] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyPet().then(async ({ pet: row, error }) => {
      if (cancelled) return;
      if (error) {
        setLoadError(error);
        return;
      }
      if (!row) {
        setLoadError("Todavía no hay ninguna mascota que editar");
        return;
      }
      setPet(row);
      setEdit(petEditFromRow(row));
      // The column holds an object path, so it has to be signed before an
      // <Image> can read it. A failure here is silent on purpose: the initial
      // is a complete answer.
      const url = await signedPhotoUrl(row.photo_url);
      if (!cancelled) setPhotoUri(url);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const dirty =
    !!pet &&
    !!edit &&
    JSON.stringify(edit) !== JSON.stringify(petEditFromRow(pet));

  /**
   * Opens a block, from the stored row rather than from whatever is in state.
   *
   * Closing without saving and opening again has to show the file as it is —
   * otherwise the CV above and the form below would disagree about the same
   * dog.
   */
  const openSection = useCallback(
    (section: Exclude<Section, null>) => {
      if (!pet) return;
      setEdit(petEditFromRow(pet));
      setSubmitted([]);
      setGoalText(
        pet.exercise_goal_minutes
          ? formatDuration(pet.exercise_goal_minutes)
          : "",
      );
      setGoalError(null);
      setEditing(section);
    },
    [pet],
  );

  const closeSection = useCallback(() => {
    if (pet) setEdit(petEditFromRow(pet));
    setSubmitted([]);
    setGoalError(null);
    setEditing(null);
  }, [pet]);

  /**
   * Reads "5h", "90", "1h 30m" — whatever a tutor types — into the column's
   * minutes. An unparseable string leaves the stored number alone and says so,
   * rather than silently writing a null over a target somebody set.
   */
  const editGoal = useCallback((text: string) => {
    setGoalText(text);
    if (!text.trim()) {
      setGoalError(null);
      setEdit((d) => d && { ...d, exerciseGoalMinutes: null });
      return;
    }
    const minutes = parseDuration(text);
    if (minutes === null) {
      setGoalError(DURATION_HINT);
      return;
    }
    setGoalError(null);
    setEdit((d) => d && { ...d, exerciseGoalMinutes: minutes });
  }, []);

  const save = useCallback(async () => {
    if (!pet || !edit) return false;

    const errors = validatePetDraft(edit);
    if (Object.keys(errors).length > 0) {
      setSubmitted(Object.keys(errors));
      return false;
    }

    const { error } = await updatePet(pet.id, edit);
    if (error) {
      toast.show({ variant: "error", message: error, persist: true });
      return false;
    }

    // Re-reading is what makes the CV catch up: `dirty` compares the form
    // against the stored row, so the row has to move.
    setAttempt((n) => n + 1);
    setEditing(null);
    toast.show({
      variant: "success",
      message: `Guardado. ${edit.name.trim()} está al día.`,
    });
    return true;
  }, [pet, edit, toast]);

  const pickPhoto = useCallback(async () => {
    const { uri, error } = await pickPetPhoto();
    if (error) {
      toast.show({ variant: "error", message: error, persist: true });
      return null;
    }
    return uri;
  }, [toast]);

  /** Crop, upload, then the column — in that order, so nothing half-lands. */
  const savePhoto = useCallback(
    async (
      uri: string,
      rect: { originX: number; originY: number; size: number },
    ) => {
      if (!pet) return false;

      const { uri: cropped, error: cropError } = await cropToSquare(uri, rect);
      if (cropError || !cropped) {
        toast.show({
          variant: "error",
          message: cropError ?? "No hemos podido recortar la foto",
          persist: true,
        });
        return false;
      }

      const { path, error } = await uploadPetPhoto(pet.id, cropped);
      if (error || !path) {
        toast.show({
          variant: "error",
          message: error ?? "No hemos podido guardar la foto",
          persist: true,
        });
        return false;
      }

      // Only the photo column: an unsaved edit on screen stays unsaved.
      const { error: columnError } = await updatePetPhoto(pet.id, path);
      if (columnError) {
        toast.show({ variant: "error", message: columnError, persist: true });
        return false;
      }

      setEditingPhoto(false);
      setAttempt((n) => n + 1);
      toast.show({ variant: "success", message: "Foto actualizada" });
      return true;
    },
    [pet, toast],
  );

  const dropPhoto = useCallback(async () => {
    if (!pet?.photo_url) return true;

    const { error } = await removePetPhoto(pet.photo_url);
    if (error) {
      toast.show({ variant: "error", message: error, persist: true });
      return false;
    }
    const { error: columnError } = await updatePetPhoto(pet.id, null);
    if (columnError) {
      toast.show({ variant: "error", message: columnError, persist: true });
      return false;
    }
    setPhotoUri(null);
    setEditingPhoto(false);
    setAttempt((n) => n + 1);
    return true;
  }, [pet, toast]);

  const confirmDelete = useCallback(async () => {
    if (!pet) return false;

    if (pet.photo_url) await removePetPhoto(pet.photo_url);
    const { error } = await deletePet(pet.id);
    if (error) {
      toast.show({ variant: "error", message: error, persist: true });
      return false;
    }

    setConfirmingDelete(false);
    // Straight to registration, not to "/". Both `app/index.tsx` and
    // `app/(tabs)/index.tsx` answer to "/", and the tab group wins that race —
    // measured: deleting the pet landed on the day view with no pet behind it.
    // Onboarding is the honest destination anyway, and its own guard sends the
    // tutor away again if a pet somehow exists.
    router.replace("/onboarding");
    return true;
  }, [pet, router, toast]);

  if (loadError) {
    return (
      <Screen center edges={["top"]}>
        <Text
          accessibilityLiveRegion="polite"
          className="mb-5 text-center text-error"
        >
          {loadError}
        </Text>
        <Button
          testID="profile-retry"
          label="Reintentar"
          onPress={() => {
            setLoadError(null);
            setAttempt((n) => n + 1);
          }}
        />
      </Screen>
    );
  }

  if (!pet || !edit) return <LoadingScreen />;

  const name = pet.name.trim();
  const nameMatches =
    typedName.trim().toLocaleLowerCase() === name.toLocaleLowerCase();

  const SexIcon =
    pet.sex === "male" ? Mars : pet.sex === "female" ? Venus : null;
  const sexLabel = pet.sex === "male" ? "Macho" : "Hembra";
  const breed = pet.breed_primary?.trim() || null;
  const age = describeAge(pet.birth_date, pet.birth_date_approximate);
  // The photo is not in this list: it has its own affordance on the portrait,
  // and a link promising to complete the file would open a form without it.
  const incomplete = !pet.sex || !breed;

  const goal = pet.exercise_goal_minutes;

  // Only the fields the tutor has already submitted may speak, and each says
  // whatever is wrong with it *now*.
  const validation = validatePetDraft(edit);
  const fieldErrors: Record<string, string> = {};
  for (const key of submitted) {
    if (validation[key]) fieldErrors[key] = validation[key];
  }
  const saveErrorLabel =
    Object.keys(fieldErrors).length > 0
      ? "Faltan datos por rellenar"
      : "No se ha podido guardar";

  return (
    <Screen scroll edges={["top"]}>
      {/* The file's cover: who this is, at a glance, before any control. */}
      <View className="mb-8 flex-row items-center gap-5">
        <Avatar
          testID="profile-avatar"
          uri={photoUri}
          name={name}
          onPress={() => setEditingPhoto(true)}
          accessibilityLabel={
            pet.photo_url
              ? `Cambiar la foto de ${name}`
              : `Añadir una foto de ${name}`
          }
        />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text
              testID="profile-title"
              accessibilityRole="header"
              numberOfLines={1}
              className="shrink font-bold text-2xl text-text-primary"
            >
              {name}
            </Text>
            {SexIcon ? (
              // The glyph is the only place the sex appears, so it carries a
              // name: an unlabelled icon is decoration, and this is data.
              <View
                accessible
                accessibilityLabel={sexLabel}
                className="shrink-0"
              >
                <SexIcon
                  size={18}
                  strokeWidth={2.5}
                  color={colors.textSecondary}
                />
              </View>
            ) : null}
          </View>
          {/* Only when there is one: a line saying nobody has written the
              breed down is a hole with a caption, and the age below carries
              the file on its own. The invitation link covers the gap. */}
          {breed ? (
            <Text
              testID="profile-breed"
              numberOfLines={2}
              className="text-text-secondary"
            >
              {breed}
            </Text>
          ) : null}
          {age ? (
            <Text
              testID="profile-age"
              accessibilityLabel={`${age.text}, ${age.stageLabel}`}
              className="mt-0.5 text-sm text-text-tertiary"
            >
              {`${age.text} · ${age.stageLabel}`}
            </Text>
          ) : null}
          {incomplete && editing !== "main" ? (
            <Button
              testID="profile-complete"
              variant="link"
              label="Completa su ficha"
              accessibilityLabel={`Completar la ficha de ${name}`}
              onPress={() => openSection("main")}
            />
          ) : null}
        </View>
      </View>

      {editing === "main" ? (
        <Group testID="profile-group-main">
          <TextField
            testID="profile-name"
            label="Nombre"
            required
            value={edit.name}
            onChangeText={(next) => setEdit((d) => d && { ...d, name: next })}
            placeholder={pet.name}
            error={fieldErrors.name}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
          />

          <ChipGroup label="Sexo" className="mb-5">
            {(
              [
                { value: "male", label: "Macho" },
                { value: "female", label: "Hembra" },
              ] as const
            ).map(({ value, label }) => (
              <Chip
                key={value}
                testID={`profile-sex-${value}`}
                label={label}
                selected={edit.sex === value}
                onPress={() => setEdit((d) => d && { ...d, sex: value })}
              />
            ))}
          </ChipGroup>

          <DateField
            testID="profile-birthdate"
            label="Fecha de nacimiento"
            required
            value={edit.birthDate}
            approximate={edit.birthDateApproximate}
            onChange={(iso) => setEdit((d) => d && { ...d, birthDate: iso })}
            error={fieldErrors.birthDate}
          />
          <View className="-mt-3 mb-5">
            <Checkbox
              testID="profile-birthdate-approx"
              label="Aproximado"
              accessibilityLabel="Fecha de nacimiento aproximada"
              checked={edit.birthDateApproximate}
              onChange={(approximate) =>
                setEdit((d) => {
                  if (!d) return d;
                  const parsed = d.birthDate ? parseISO(d.birthDate) : null;
                  return {
                    ...d,
                    birthDateApproximate: approximate,
                    // Rewrites the day to the 1st when the date becomes
                    // approximate, so the stored value cannot keep a day the
                    // tutor has just said they do not know.
                    birthDate:
                      approximate && parsed
                        ? toApproximateISO(parsed.month, parsed.year)
                        : d.birthDate,
                  };
                })
              }
            />
          </View>

          <BreedField
            testID="profile-breed-input"
            label="Raza"
            value={edit.breedPrimary}
            onChange={(next) =>
              setEdit((d) => d && { ...d, breedPrimary: next })
            }
            placeholder="Husky Siberiano"
            error={fieldErrors.breedPrimary}
          />
          <View className="-mt-3 mb-5">
            <Checkbox
              testID="profile-mixed"
              label="Es mestizo"
              accessibilityLabel="Es mestizo, sin raza concreta"
              checked={isMixedShown(edit)}
              onChange={(next) => setEdit((d) => d && withMixed(d, next))}
            />
          </View>

          <SectionActions
            dirty={dirty}
            errorLabel={saveErrorLabel}
            onSave={save}
            onCancel={closeSection}
          />

          {/* Behind the same door as the rest of the editing, and at the
                bottom of it: the action that ends the file should not be
                reachable from a screen someone opened to look at their dog.
                Outlined rather than filled — it is available, not invited. */}
          <View className="mt-8 mb-5 border-t border-border-default pt-6">
            <Button
              testID="profile-delete"
              variant="outlined"
              tone="danger"
              icon={Trash2}
              label={`Borrar la ficha de ${name}`}
              onPress={() => {
                setTypedName("");
                setConfirmingDelete(true);
              }}
            />
          </View>
        </Group>
      ) : (
        // No read-only frame for the identity block: the header above already
        // presents the name, the sex, the breed and the age, and a section
        // holding one date and a button was a box around a door.
        <EditButton
          testID="profile-edit-main"
          label={`Editar datos de ${name}`}
          onPress={() => openSection("main")}
        />
      )}

      <Group testID="profile-group-health" title="Salud y actividad">
        {editing === "health" ? (
          <>
            <ChipGroup label="¿Esterilizado?">
              {NEUTERED.map(({ value, label, testId }) => (
                <Chip
                  key={testId}
                  testID={`profile-neutered-${testId}`}
                  label={label}
                  selected={edit.spayedNeutered === value}
                  onPress={() =>
                    setEdit((d) => d && { ...d, spayedNeutered: value })
                  }
                />
              ))}
            </ChipGroup>

            <ChipGroup label="Nivel de actividad">
              {ACTIVITY.map(({ value, label }) => (
                <Chip
                  key={value}
                  testID={`profile-activity-${value}`}
                  label={label}
                  selected={edit.activityLevel === value}
                  onPress={() =>
                    setEdit((d) => d && { ...d, activityLevel: value })
                  }
                />
              ))}
            </ChipGroup>

            <TextField
              testID="profile-exercise-goal"
              label="Objetivo diario de paseo"
              value={goalText}
              onChangeText={editGoal}
              onBlur={() =>
                setGoalText(
                  edit.exerciseGoalMinutes
                    ? formatDuration(edit.exerciseGoalMinutes)
                    : "",
                )
              }
              placeholder="1h"
              // The alphabetic keyboard here, unlike in the walk sheet: this
              // is a target set once, "5h" is the shape a tutor reaches for,
              // and a number pad could not type it.
              error={goalError ?? fieldErrors.exerciseGoalMinutes}
              maxLength={10}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text className="-mt-3 mb-5 text-xs text-text-tertiary">
              El diario compara con esto los paseos del día.
            </Text>

            <SectionActions
              dirty={dirty}
              errorLabel={saveErrorLabel}
              onSave={save}
              onCancel={closeSection}
            />
            <View className="mb-4" />
          </>
        ) : (
          <>
            <Row
              label="Esterilizado"
              testID="profile-neutered-value"
              muted={pet.spayed_neutered === null}
              value={
                pet.spayed_neutered === null
                  ? "No lo sabemos"
                  : pet.spayed_neutered
                    ? "Sí"
                    : "No"
              }
            />
            <Row
              label="Actividad"
              testID="profile-activity-value"
              muted={!pet.activity_level}
              value={
                ACTIVITY.find((a) => a.value === pet.activity_level)?.label ??
                "Sin definir"
              }
            />
            <Row
              label="Paseo al día"
              testID="profile-goal-value"
              muted={goal === null}
              value={goal === null ? "Sin objetivo" : formatDuration(goal)}
            />
            <EditButton
              testID="profile-edit-health"
              label="Editar salud y actividad"
              onPress={() => openSection("health")}
            />
          </>
        )}
      </Group>

      {/* Signing out is routine and reversible, so it keeps its place on the
          page — and it is now the only exit that does, which is the point. */}
      <View className="mt-6 border-t border-border-default pt-8">
        <Button
          testID="profile-signout"
          icon={Power}
          label="Cerrar sesión"
          onPress={signOut}
        />
      </View>

      {editingPhoto ? (
        <AvatarEditor
          name={name}
          currentUri={photoUri}
          onPick={pickPhoto}
          onSave={savePhoto}
          onRemove={dropPhoto}
          onClose={() => setEditingPhoto(false)}
        />
      ) : null}

      <Modal
        visible={confirmingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmingDelete(false)}
      >
        <Pressable
          testID="profile-delete-scrim"
          onPress={() => setConfirmingDelete(false)}
          className="flex-1 justify-end bg-base/80"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-xl border border-error bg-surface p-5"
          >
            {/* The file is what gets deleted, and the wording says so. A tutor
                reaching this screen may have lost the animal, and "borrar a
                Loki" asks them to confirm a sentence about their dog rather
                than about a record in an app. */}
            <Text
              accessibilityRole="header"
              className="mb-2 font-bold text-xl text-text-primary"
            >
              {`¿Borrar la ficha de ${name}?`}
            </Text>
            <Text className="mb-5 text-text-secondary">
              Se borra su ficha y todo lo que habéis registrado. No hay vuelta
              atrás.
            </Text>
            {/* The name goes in the label as a request, not as an example: the
                label is uppercased by the type scale, so "ESCRIBE LOKI" next
                to a field holding "Loki" read like a mismatch the tutor had to
                fix. The comparison ignores case either way. */}
            <TextField
              testID="profile-delete-name"
              label="Escribe el nombre de la mascota que quieres borrar"
              value={typedName}
              onChangeText={setTypedName}
              autoCapitalize="words"
              autoCorrect={false}
              className="mb-5"
            />
            <View className="flex-row gap-3">
              <Pressable
                testID="profile-delete-cancel"
                onPress={() => setConfirmingDelete(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                style={(state) => [{ minHeight: 48 }, pressed(state)]}
                className="flex-1 items-center justify-center rounded-xl border border-border-strong py-4"
              >
                <Text className="text-text-secondary">Cancelar</Text>
              </Pressable>
              <View className="flex-1">
                <Button
                  testID="profile-delete-confirm"
                  variant="primary"
                  tone="danger"
                  label="Borrar la ficha"
                  accessibilityLabel={`Borrar la ficha de ${name} definitivamente`}
                  disabled={!nameMatches}
                  successLabel="Borrada"
                  errorLabel="No se ha podido borrar"
                  onPress={confirmDelete}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/** The door into a block. Outlined, so it reads as available and not as urgent. */
function EditButton({
  testID,
  label,
  onPress,
}: {
  testID: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View className="mb-5">
      <Button
        testID={testID}
        variant="outlined"
        icon={Pencil}
        label={label}
        onPress={onPress}
      />
    </View>
  );
}

/**
 * Save and cancel for an open block.
 *
 * The primary stays disabled until the form differs from the stored row, which
 * is the same promise the button made when it was the only one on the screen:
 * it says "there is nothing to save" instead of inviting an empty write.
 */
function SectionActions({
  dirty,
  errorLabel,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  /** Names the failure: a rejected field reads differently from a lost request. */
  errorLabel: string;
  onSave: () => Promise<boolean>;
  onCancel: () => void;
}) {
  return (
    <View className="mt-1 flex-row items-center gap-4">
      <View className="flex-1">
        <Button
          testID="profile-save"
          variant="primary"
          label="Guardar cambios"
          disabled={!dirty}
          successLabel="Guardado"
          errorLabel={errorLabel}
          onPress={onSave}
        />
      </View>
      <Button
        testID="profile-cancel"
        variant="link"
        label="Cancelar"
        onPress={onCancel}
      />
    </View>
  );
}
