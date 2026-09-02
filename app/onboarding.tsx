import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth";
import { createPet, type PetDraft } from "../lib/pets";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color="#A5F2F3" />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  async function submit() {
    setBusy(true);
    setError(null);
    const { petId, error: failure } = await createPet(draft);
    setBusy(false);

    if (petId) {
      router.replace("/(tabs)");
      return;
    }
    setError(failure);
  }

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="px-6 py-12">
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
