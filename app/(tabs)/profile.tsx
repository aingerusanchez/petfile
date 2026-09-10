import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import {
  Avatar,
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
  pressed,
  useToast,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { parseISO, toApproximateISO } from "../../lib/dates";
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

/**
 * The pet's file: everything the onboarding form stopped asking for.
 *
 * Onboarding deliberately collects two required fields and defers the rest on
 * the promise that they can be filled in later. Until this screen existed that
 * promise was broken — there was no way to add a breed, correct a typo in a
 * name, or record that the dog had been neutered.
 *
 * **Explicit save, not per-field autosave.** The same contract the onboarding
 * form uses: validate on submit, forgive on input. Autosave reads as less
 * friction until the required field is empty (what would it save?) or the
 * network drops (six requests, six separate failures to explain). An edit here
 * is a deliberate correction, and one button is the honest shape for it.
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  /**
   * Forgive on input, exactly as onboarding does: an error clears the moment
   * its own field becomes valid, and this never *adds* one, so it is safe to
   * run on every keystroke.
   */
  useEffect(() => {
    if (!edit) return;
    setFieldErrors((previous) => {
      const keys = Object.keys(previous);
      if (keys.length === 0) return previous;

      const current = validatePetDraft(edit);
      const next: Record<string, string> = {};
      for (const key of keys) if (current[key]) next[key] = current[key];
      return keys.length === Object.keys(next).length ? previous : next;
    });
  }, [edit]);

  const dirty =
    !!pet &&
    !!edit &&
    JSON.stringify(edit) !== JSON.stringify(petEditFromRow(pet));

  const save = useCallback(async () => {
    if (!pet || !edit) return false;

    const errors = validatePetDraft(edit);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    const { error } = await updatePet(pet.id, edit);
    if (error) {
      toast.show({ variant: "error", message: error, persist: true });
      return false;
    }

    // Re-reading is what makes the button go quiet again: `dirty` compares the
    // form against the stored row, so the row has to catch up.
    setAttempt((n) => n + 1);
    toast.show({
      variant: "success",
      message: `Guardado. ${edit.name.trim()} está al día.`,
    });
    return true;
  }, [pet, edit, toast]);

  const changePhoto = useCallback(async () => {
    if (!pet) return false;

    const { uri, error: pickError } = await pickPetPhoto();
    if (pickError) {
      toast.show({ variant: "error", message: pickError, persist: true });
      return false;
    }
    if (!uri) return true; // backed out of the picker, which is not a failure

    const { path, error } = await uploadPetPhoto(pet.id, uri);
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

    setAttempt((n) => n + 1);
    toast.show({ variant: "success", message: "Foto actualizada" });
    return true;
  }, [pet, toast]);

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
    // Straight to registration, not to `/`. Both `app/index.tsx` and
    // `app/(tabs)/index.tsx` answer to "/", and the tab group wins that race —
    // measured: deleting the pet landed on "Hoy" with no pet behind it.
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

  const name = edit.name.trim() || pet.name;
  const nameMatches =
    typedName.trim().toLocaleLowerCase() ===
    pet.name.trim().toLocaleLowerCase();

  return (
    <Screen scroll edges={["top"]}>
      <View className="mb-8 flex-row items-center gap-5">
        <Avatar testID="profile-avatar" uri={photoUri} name={name} />
        <View className="flex-1">
          <Text
            testID="profile-title"
            accessibilityRole="header"
            className="mb-1 text-2xl font-bold text-text-primary"
          >
            {name}
          </Text>
          <View className="flex-row flex-wrap">
            <Button
              testID="profile-photo"
              variant="link"
              label={pet.photo_url ? "Cambiar foto" : "Añadir foto"}
              successLabel="Lista"
              errorLabel="No se pudo subir"
              onPress={changePhoto}
            />
            {pet.photo_url ? (
              <View className="ml-5">
                <Button
                  testID="profile-photo-remove"
                  variant="link"
                  label="Quitar"
                  accessibilityLabel="Quitar la foto"
                  successLabel="Quitada"
                  errorLabel="No se pudo quitar"
                  onPress={dropPhoto}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

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
        <View className="mb-5 -mt-3">
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
          testID="profile-breed"
          label="Raza"
          value={edit.breedPrimary}
          onChange={(breed) =>
            setEdit((d) => d && { ...d, breedPrimary: breed })
          }
          placeholder="Husky Siberiano"
          error={fieldErrors.breedPrimary}
        />
        <View className="mb-4 -mt-3">
          <Checkbox
            testID="profile-mixed"
            label="Es mestizo"
            accessibilityLabel="Es mestizo, sin raza concreta"
            checked={isMixedShown(edit)}
            onChange={(next) => setEdit((d) => d && withMixed(d, next))}
          />
        </View>
      </Group>

      <Group testID="profile-group-health" title="Salud y actividad">
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
          value={
            edit.exerciseGoalMinutes === null
              ? ""
              : String(edit.exerciseGoalMinutes)
          }
          onChangeText={(next) =>
            setEdit((d) => {
              if (!d) return d;
              const digits = next.replace(/[^0-9]/g, "");
              return {
                ...d,
                exerciseGoalMinutes: digits === "" ? null : Number(digits),
              };
            })
          }
          placeholder="60"
          error={fieldErrors.exerciseGoalMinutes}
          keyboardType="number-pad"
          maxLength={3}
        />
        {/* The unit belongs next to the field, not inside the placeholder: a
            placeholder disappears the moment the tutor types. */}
        <Text className="mb-5 -mt-3 text-xs text-text-tertiary">
          Minutos al día. El resumen del día compara los paseos con esto.
        </Text>
      </Group>

      <View className="mt-4">
        <Button
          testID="profile-save"
          variant="primary"
          label="Guardar cambios"
          disabled={!dirty}
          successLabel="Guardado"
          errorLabel={
            Object.keys(fieldErrors).length > 0
              ? "Faltan datos por rellenar"
              : "No se ha podido guardar"
          }
          onPress={save}
        />
      </View>

      {/* Two exits, kept apart from the form and from each other: signing out
          is routine and reversible, deleting is neither. */}
      <View className="mt-10 border-t border-border-default pt-8">
        <Button
          testID="profile-signout"
          label="Cerrar sesión"
          onPress={signOut}
        />
        <View className="mt-5">
          <Button
            testID="profile-delete"
            variant="link"
            tone="danger"
            icon={Trash2}
            label={`Borrar a ${name}`}
            onPress={() => {
              setTypedName("");
              setConfirmingDelete(true);
            }}
          />
        </View>
      </View>

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
            <Text
              accessibilityRole="header"
              className="mb-2 text-xl font-bold text-text-primary"
            >
              {`¿Borrar a ${pet.name}?`}
            </Text>
            <Text className="mb-5 text-text-secondary">
              Se borra su ficha y todo lo que hayáis registrado. No hay vuelta
              atrás.
            </Text>
            <TextField
              testID="profile-delete-name"
              label={`Escribe ${pet.name} para confirmarlo`}
              value={typedName}
              onChangeText={setTypedName}
              placeholder={pet.name}
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
                  label="Borrar"
                  accessibilityLabel={`Borrar a ${pet.name} definitivamente`}
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
