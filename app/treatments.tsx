import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  Button,
  Chip,
  colors,
  ErrorNote,
  Markdown,
  PLACEHOLDER_COLOR,
  Screen,
  ScreenHeader,
  Text,
  TOUCH_TARGET,
  TREATMENT_ICONS,
  TreatmentSheet,
  TreatmentSkeleton,
  useToast,
} from "../components/ui";
import { MONTHS_ES, parseISO } from "../lib/dates";
import { useActivePet } from "../lib/pet";
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

  const { activePetId, loading: activePetLoading } = useActivePet();
  const [pet, setPet] = useState<PetRow | null>(null);
  /**
   * The treatments, **and the pet they are of**.
   *
   * **The pet and its rows arrive in two reads**, `pet` first, so for one
   * request after the pet changes the sheet's `petId` is the dog the tutor
   * chose and the row it opens on is the one they left — and
   * `updateTreatment` writes `pet_id` along with the rest, so saving it
   * would move that dose to the other dog. Found by reading rather than on a
   * device, and unlikely here (the screen is a push over the tabs, where the
   * switcher is not), but the same state that makes it impossible costs
   * three lines. `rows` below is derived against `pet`, `null` — the
   * skeleton — until this pet's own are here; a reload after a save is the
   * same pet and keeps what it has.
   */
  const [read, setRead] = useState<{
    petId: string;
    rows: PetTreatmentRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<TreatmentKind | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<PetTreatmentRow | null>(null);

  const [today] = useState(() => new Date());

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  const rows = read && pet && read.petId === pet.id ? read.rows : null;

  // **It waits while the stored choice is still being read**, and resolves on
  // a non-null id at once: `null` is "the disk has not answered" while
  // `loading` is up and "nobody chose" once it is down, and only the second
  // may fall back to the oldest pet (see `lib/pet.tsx`). **`getMyPet`, not the
  // list** — no switcher here, and the failure keeps saying «leer la ficha».
  // **`cancelled` keeps the answers in order** now that the pet is a
  // dependency: the slower of two reads must not paint the dog the tutor left.
  useEffect(() => {
    if (activePetLoading && activePetId === null) return;

    let cancelled = false;

    getMyPet(activePetId).then(async ({ pet: row, error: failure }) => {
      if (cancelled) return;
      if (failure) return setError(failure);
      if (!row) return setError("Todavía no hay ninguna mascota");
      // **Cleared when the pet lands, not when its list does.** `error` takes
      // the whole screen, and the only thing that used to clear it was the
      // press on Reintentar; a pet change re-runs this effect without going
      // near `reload`, so the answer that arrived would have sat behind the
      // old sentence for a whole round trip. `rows` is derived against
      // `pet.id` just above, so what shows in that gap is this screen's
      // skeleton and not the other dog's doses. The same line and the same
      // reason as `app/(tabs)/health.tsx` — unreachable from today's
      // navigation in both, since the switcher is a tab away and this is a
      // push over it, and written anyway so the one decision is not taken
      // both ways in one branch.
      setError(null);
      setPet(row);

      const { treatments, error: listError } = await treatmentsFor(row.id);
      if (cancelled) return;
      setRead({ petId: row.id, rows: treatments });
      setError(listError);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, activePetId, activePetLoading]);

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
          <ErrorNote message={error} />
          <Button
            testID="treatments-retry"
            label="Reintentar"
            loadingLabel="Reconectando…"
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
          onFailed={(message) => toast.show({ variant: "error", message })}
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
