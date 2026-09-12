import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  Button,
  Chip,
  colors,
  Markdown,
  PLACEHOLDER_COLOR,
  Screen,
  ScreenHeader,
  Text,
  TOUCH_TARGET,
  TreatmentSkeleton,
  TREATMENT_ICONS,
  TreatmentSheet,
  useToast,
} from "../components/ui";
import { MONTHS_ES, parseISO } from "../lib/dates";
import { getMyPet, type PetRow } from "../lib/pets";
import {
  searchTreatments,
  treatmentLabel,
  treatmentsFor,
  TREATMENT_KINDS,
  type PetTreatmentRow,
  type TreatmentKind,
} from "../lib/treatments";

/**
 * Everything the dog has ever been given, and a way through it.
 *
 * **A year of monthly antiparasitics is what made this a screen.** Salud shows
 * the last few and says how many there are; a puppy's first nine months
 * already put fifteen rows behind that, eleven of them opening with the same
 * three words. A section cannot be scrolled through looking for "the Panacur
 * one" — a screen with a filter and a search can.
 *
 * **The kind filters and the text searches, because they are different
 * questions.** One is "show me the dewormings" and the other is "where does
 * Panacur appear", and answering both with one control would mean answering
 * neither well.
 */
export default function Treatments() {
  const router = useRouter();
  const toast = useToast();

  const [pet, setPet] = useState<PetRow | null>(null);
  const [rows, setRows] = useState<PetTreatmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<TreatmentKind | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<PetTreatmentRow | null>(null);

  const [today] = useState(() => new Date());

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;

    getMyPet().then(async ({ pet: row, error: failure }) => {
      if (cancelled) return;
      if (failure) return setError(failure);
      if (!row) return setError("Todavía no hay ninguna mascota");
      setPet(row);

      const { treatments, error: listError } = await treatmentsFor(row.id);
      if (cancelled) return;
      setRows(treatments);
      setError(listError);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const shown = searchTreatments(rows ?? [], { kind, text });
  const filtering = kind !== null || text.trim().length > 0;

  return (
    <Screen scroll>
      <ScreenHeader
        testID="treatments-title"
        backTestID="treatments-back"
        title="Tratamientos"
        backTo="Salud"
        onBack={() => router.back()}
      />

      {/* **The search is a field, not a chip.** It answers a question the
          filter cannot — a product name, a note, a diagnosis — and a tutor
          who types "giardias" is looking for the visit rather than for a
          category. */}
      <View className="mb-4 flex-row items-center gap-3 rounded-xl border border-border-default bg-surface pr-4 pl-4">
        <Search size={18} color={colors.textTertiary} />
        <TextInput
          testID="treatments-search"
          value={text}
          onChangeText={setText}
          placeholder="Nexgard, giardias…"
          placeholderTextColor={PLACEHOLDER_COLOR}
          accessibilityLabel="Buscar en los tratamientos"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            minHeight: TOUCH_TARGET,
            minWidth: 0,
            textAlignVertical: "center",
          }}
          className="flex-1 font-sans text-text-primary"
        />
      </View>

      {/* "Todos" is a chip like the rest rather than a way of clearing the
          row: a filter you cannot see the current state of is a filter that
          gets left on. */}
      <View className="mb-6 flex-row flex-wrap gap-3">
        <Chip
          testID="treatments-kind-all"
          label="Todos"
          selected={kind === null}
          onPress={() => setKind(null)}
        />
        {TREATMENT_KINDS.map((option) => (
          <Chip
            key={option}
            testID={`treatments-kind-${option}`}
            label={treatmentLabel(option)}
            icon={TREATMENT_ICONS[option]}
            selected={kind === option}
            onPress={() => setKind(option)}
          />
        ))}
      </View>

      {error ? (
        <View className="items-center">
          <Text
            accessibilityLiveRegion="polite"
            className="mb-5 text-center text-error"
          >
            {error}
          </Text>
          <Button
            testID="treatments-retry"
            label="Reintentar"
            onPress={reload}
          />
        </View>
      ) : rows === null ? (
        // **In the shape of the list, not a spinner in the middle of the
        // page.** This is the screen where a wait sits longest — every dose
        // the animal has had, filtered on a server — and a full-screen
        // loader would take away the search field and the chips the tutor
        // just used.
        <TreatmentSkeleton testID="treatments-loading" />
      ) : shown.length === 0 ? (
        <Text testID="treatments-empty" className="text-text-tertiary">
          {filtering
            ? "Nada con esos criterios."
            : "Aquí van las vacunas, las desparasitaciones y los antiparasitarios."}
        </Text>
      ) : (
        <View testID="treatments-list">
          {shown.map((row) => {
            const Glyph = TREATMENT_ICONS[row.kind as TreatmentKind];
            return (
              <Pressable
                key={row.id}
                testID={`treatments-row-${row.id}`}
                onPress={() => setEditing(row)}
                accessibilityRole="button"
                accessibilityLabel={`${treatmentLabel(
                  row.kind as TreatmentKind,
                )}${row.name ? `, ${row.name}` : ""}, el ${displayDate(
                  row.administered_on,
                )}. Editarlo`}
                className="flex-row items-start justify-between gap-3 border-b border-border-default py-4 last:border-b-0 active:opacity-70"
              >
                <View
                  className="shrink-0 pt-0.5"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                >
                  <Glyph size={16} color={colors.textTertiary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-text-primary">
                    {treatmentLabel(row.kind as TreatmentKind)}
                    {row.name ? ` · ${row.name}` : ""}
                  </Text>
                  {row.note ? (
                    <View className="mt-0.5">
                      <Markdown
                        text={row.note}
                        className="text-xs text-text-tertiary"
                        compact
                      />
                    </View>
                  ) : null}
                  {row.next_due_on ? (
                    <Text className="mt-0.5 text-xs text-text-muted">
                      Siguiente: {displayDate(row.next_due_on)}
                    </Text>
                  ) : null}
                </View>
                <Text className="shrink-0 text-xs text-text-tertiary">
                  {displayDate(row.administered_on)}
                </Text>
              </Pressable>
            );
          })}

          {/* The count is the reassurance a filtered list owes: "four of
              fifteen" says the other eleven are still there. */}
          <Text className="mt-4 text-xs text-text-muted">
            {filtering
              ? `${shown.length} de ${rows.length}`
              : `${rows.length} en total`}
          </Text>
        </View>
      )}

      {editing && pet ? (
        <TreatmentSheet
          petId={pet.id}
          today={today}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            toast.show({ variant: "success", message });
            reload();
          }}
          onFailed={(message) =>
            toast.show({ variant: "error", message, persist: true })
          }
        />
      ) : null}
    </Screen>
  );
}

/** "4 de septiembre", and the year when it is not this one. */
function displayDate(iso: string): string {
  const parts = parseISO(iso);
  if (!parts) return iso;
  const month = MONTHS_ES[parts.month - 1].toLowerCase();
  const year =
    parts.year === new Date().getFullYear() ? "" : ` de ${parts.year}`;
  return `${parts.day} de ${month}${year}`;
}
