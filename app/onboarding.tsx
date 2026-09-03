import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../lib/auth";
import { createPet, getMyPet, type PetDraft } from "../lib/pets";

const ACTIVITY: PetDraft["activityLevel"][] = ["low", "moderate", "high"];
const ACTIVITY_LABEL: Record<PetDraft["activityLevel"], string> = {
  low: "Bajo",
  moderate: "Moderado",
  high: "Alto",
};

export default function Onboarding() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<PetDraft>({
    name: "",
    sex: null,
    breedPrimary: null,
    isMixed: false,
    birthDate: null,
    birthDateApproximate: false,
    spayedNeutered: null,
    activityLevel: "moderate",
  });
  // spayedNeutered is a true boolean | null tri-state where null is itself a
  // legitimate answer ("no lo sé"), so the draft's initial null can't double
  // as "untouched" — this flag is what keeps no chip pre-selected until the
  // user actually picks one.
  const [neuteredTouched, setNeuteredTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasPet, setHasPet] = useState<boolean | null>(null);
  const [petCheckError, setPetCheckError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setPetCheckError(null);
    setHasPet(null);
    setAttempt((n) => n + 1);
  }, []);

  // Onboarding is reachable directly (deep link, back navigation), so it needs
  // the same has-pet check `app/index.tsx` does — otherwise a user who already
  // has a pet gets the creation form again and can make a duplicate.
  useEffect(() => {
    if (!session) {
      setHasPet(null);
      setPetCheckError(null);
      return;
    }

    let cancelled = false;
    getMyPet()
      .then(({ pet, error: failure }) => {
        if (cancelled) return;
        if (failure) {
          setPetCheckError(failure);
          return;
        }
        setHasPet(pet !== null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPetCheckError(
          err instanceof Error
            ? err.message
            : "No se pudo comprobar tu mascota",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  // A failed check must not fall through to the form (that would risk a
  // duplicate pet) or leave the spinner spinning forever.
  if (petCheckError) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-6">
        <Text className="mb-4 text-center text-error">{petCheckError}</Text>
        <Pressable
          testID="onboarding-retry"
          onPress={retry}
          className="rounded-xl border border-border-strong px-6 py-3"
        >
          <Text className="text-text-secondary">Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || (session && hasPet === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color="#A5F2F3" />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (hasPet) return <Redirect href="/(tabs)" />;

  // A write failure must always surface an error and re-enable the button.
  // Without the catch, a throw (e.g. the RPC returning no row) left `busy`
  // stuck on forever: no error, no retry, and the typed-in draft lost.
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { petId, error: failure } = await createPet(draft);
      if (petId) {
        router.replace("/(tabs)");
        return;
      }
      setError(failure);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ha ocurrido un error inesperado",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-base"
      contentContainerClassName="px-6 py-12"
    >
      <Text className="mb-8 text-3xl font-bold text-text-primary">
        ¿Quién vive contigo?
      </Text>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Nombre
      </Text>
      <TextInput
        testID="onboarding-name"
        value={draft.name}
        onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
        placeholder="Loki"
        placeholderTextColor="#64748B"
        className="mb-5 rounded-xl border border-border-default bg-surface px-4 py-3 text-text-primary"
      />

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Sexo
      </Text>
      <View className="mb-5 flex-row gap-3">
        {(["male", "female"] as const).map((sex) => (
          <Pressable
            key={sex}
            testID={`onboarding-sex-${sex}`}
            onPress={() => setDraft((d) => ({ ...d, sex }))}
            className={`flex-1 items-center rounded-xl border py-3 ${
              draft.sex === sex
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">
              {sex === "male" ? "♂ Macho" : "♀ Hembra"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Raza
      </Text>
      <TextInput
        testID="onboarding-breed"
        value={draft.breedPrimary ?? ""}
        onChangeText={(value) =>
          setDraft((d) => ({ ...d, breedPrimary: value || null }))
        }
        placeholder="Husky Siberiano"
        placeholderTextColor="#64748B"
        className="mb-5 rounded-xl border border-border-default bg-surface px-4 py-3 text-text-primary"
      />

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        ¿Es mestizo?
      </Text>
      <View className="mb-5 flex-row gap-3">
        {(
          [
            { value: false, label: "No" },
            { value: true, label: "Sí" },
          ] as const
        ).map(({ value, label }) => (
          <Pressable
            key={String(value)}
            testID={`onboarding-mixed-${value ? "yes" : "no"}`}
            onPress={() => setDraft((d) => ({ ...d, isMixed: value }))}
            className={`flex-1 items-center rounded-xl border py-3 ${
              draft.isMixed === value
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Fecha de nacimiento
      </Text>
      <TextInput
        testID="onboarding-birthdate"
        value={draft.birthDate ?? ""}
        onChangeText={(value) =>
          setDraft((d) => ({ ...d, birthDate: value || null }))
        }
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#64748B"
        className="mb-5 rounded-xl border border-border-default bg-surface px-4 py-3 text-text-primary"
      />

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        ¿Fecha aproximada?
      </Text>
      <View className="mb-5 flex-row gap-3">
        {(
          [
            { value: false, label: "No" },
            { value: true, label: "Sí" },
          ] as const
        ).map(({ value, label }) => (
          <Pressable
            key={String(value)}
            testID={`onboarding-birthdate-approx-${value ? "yes" : "no"}`}
            onPress={() =>
              setDraft((d) => ({ ...d, birthDateApproximate: value }))
            }
            className={`flex-1 items-center rounded-xl border py-3 ${
              draft.birthDateApproximate === value
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        ¿Esterilizado?
      </Text>
      <View className="mb-5 flex-row gap-3">
        {(
          [
            { value: true, label: "Sí", testId: "yes" },
            { value: false, label: "No", testId: "no" },
            { value: null, label: "No sé", testId: "unknown" },
          ] as const
        ).map(({ value, label, testId }) => (
          <Pressable
            key={testId}
            testID={`onboarding-neutered-${testId}`}
            onPress={() => {
              setNeuteredTouched(true);
              setDraft((d) => ({ ...d, spayedNeutered: value }));
            }}
            className={`flex-1 items-center rounded-xl border py-3 ${
              neuteredTouched && draft.spayedNeutered === value
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
        Nivel de actividad
      </Text>
      <View className="mb-8 flex-row gap-3">
        {ACTIVITY.map((level) => (
          <Pressable
            key={level}
            testID={`onboarding-activity-${level}`}
            onPress={() => setDraft((d) => ({ ...d, activityLevel: level }))}
            className={`flex-1 items-center rounded-xl border py-3 ${
              draft.activityLevel === level
                ? "border-accent-primary bg-elevated"
                : "border-border-default bg-surface"
            }`}
          >
            <Text className="text-text-primary">{ACTIVITY_LABEL[level]}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Text testID="onboarding-error" className="mb-3 text-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="onboarding-submit"
        disabled={busy}
        onPress={submit}
        className="items-center rounded-xl bg-accent-primary py-4"
      >
        <Text className="font-semibold text-on-accent">
          {busy ? "Guardando..." : "Guardar"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
