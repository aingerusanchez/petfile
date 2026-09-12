import { useRouter } from "expo-router";
import { Maximize2, Scale, ShieldPlus } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Button,
  colors,
  DateField,
  Fab,
  Group,
  LoadingScreen,
  Markdown,
  MarkdownHelp,
  Screen,
  Sheet,
  Skeleton,
  Text,
  TextField,
  TREATMENT_ICONS,
  TreatmentSkeleton,
  TreatmentSheet,
  useToast,
  VetCard,
  WeightLine,
} from "../../components/ui";
import { MONTHS_ES, parseISO } from "../../lib/dates";
import {
  dayKey,
  eventDetail,
  incidentsFor,
  type PetEventRow,
} from "../../lib/events";
import { getMyPet, type PetRow } from "../../lib/pets";
import { readVet, vetColumn, VET_KINDS } from "../../lib/vets";
import {
  dueStatus,
  fromDateKey,
  pending,
  treatmentLabel,
  treatmentsFor,
  type PetTreatmentRow,
  type TreatmentKind,
} from "../../lib/treatments";
import {
  deleteWeight,
  formatChange,
  formatWeight,
  measuredKey,
  parseWeight,
  saveWeight,
  weightChange,
  weightInput,
  weightsFor,
  type PetWeightRow,
} from "../../lib/weights";

/**
 * The file the app's name promises: what the animal weighs, and what he is due.
 *
 * **One scrolling screen with sections, not sub-navigation.** Two tutors and
 * one dog produce a handful of rows a year; splitting that into tabs would be
 * inventing a hierarchy to hide an emptiness. The order answers the question
 * the tab is opened with — *is there anything pending?* — before it answers
 * any other.
 *
 * **What is written here is written here; what happened today is the diary's.**
 * An incident is logged on the day it happened, on the day view, because that
 * is where the tutor already is. This screen owns the two kinds of fact the
 * app computes from: a weight, which becomes a line, and a treatment, which
 * becomes a date.
 */
/**
 * How many of the history the section shows before handing over to the screen.
 *
 * **Five, because the sixth is where a month of antiparasitics starts.** The
 * section's job is saying what has been happening lately; the moment it starts
 * being a list somebody scrolls, it has become the wrong place for it.
 */
const HISTORY_PREVIEW = 5;

export default function Health() {
  const router = useRouter();
  const toast = useToast();

  const [pet, setPet] = useState<PetRow | null>(null);
  const [petError, setPetError] = useState<string | null>(null);
  const [weights, setWeights] = useState<PetWeightRow[] | null>(null);
  const [treatments, setTreatments] = useState<PetTreatmentRow[] | null>(null);
  const [incidents, setIncidents] = useState<PetEventRow[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [weighing, setWeighing] = useState<PetWeightRow | "new" | null>(null);
  const [treating, setTreating] = useState<PetTreatmentRow | "new" | null>(
    null,
  );

  /**
   * Today, read once per mount.
   *
   * The day view re-reads it on every foreground because its whole header is
   * that value; here it only decides whether a due date has passed, and a
   * treatment that falls due while the phone is in a pocket can be one
   * reopening late.
   */
  const [today] = useState(() => new Date());

  const reload = useCallback(() => {
    setPetError(null);
    setDataError(null);
    setAttempt((count) => count + 1);
  }, []);

  const petId = pet?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    getMyPet().then(({ pet: row, error: failure }) => {
      if (cancelled) return;
      if (failure) return setPetError(failure);
      if (!row) return setPetError("Todavía no hay ninguna mascota");
      setPet(row);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!petId) return;
    let cancelled = false;

    Promise.all([
      weightsFor(petId),
      treatmentsFor(petId),
      incidentsFor(petId),
    ]).then(([weighed, treated, incident]) => {
      if (cancelled) return;
      setWeights(weighed.weights);
      setTreatments(treated.treatments);
      setIncidents(incident.events);
      // One message for both: a tutor who cannot reach the server cannot
      // reach it twice, and two identical lines read as two faults.
      setDataError(weighed.error ?? treated.error);
    });

    return () => {
      cancelled = true;
    };
  }, [petId, attempt]);

  if (petError) {
    return (
      <Screen center edges={["top"]}>
        <Text
          accessibilityLiveRegion="polite"
          className="mb-5 text-center text-error"
        >
          {petError}
        </Text>
        <Button testID="health-retry" label="Reintentar" onPress={reload} />
      </Screen>
    );
  }

  if (!pet) return <LoadingScreen />;

  const loading = weights === null || treatments === null;
  const due = pending(treatments ?? []);
  const latest = weights?.[0] ?? null;
  const change = weightChange(weights ?? []);
  const todayKey = measuredKey(today);
  const todayRow = weights?.find((row) => row.measured_on === todayKey) ?? null;

  return (
    <Screen
      scroll
      edges={["top"]}
      // **Adding moved out of the sections and under the thumb.** Each section
      // had its own button, which put the one thing a tutor comes here to do
      // at the bottom of a block they had to scroll to — and, worse, made the
      // sections look like forms. The diary settled this shape already: the
      // sections read, the floating action writes.
      overlay={(position) => (
        <Fab
          testID="health-add"
          position={position}
          label="Apuntar en salud"
          actions={[
            {
              key: "weight",
              testID: "health-add-weight",
              label: "Peso",
              icon: Scale,
              onPress: () => setWeighing(todayRow ?? "new"),
            },
            {
              key: "treatment",
              testID: "health-add-treatment",
              label: "Tratamiento",
              icon: ShieldPlus,
              onPress: () => setTreating("new"),
            },
          ]}
        />
      )}
    >
      <Text
        testID="health-title"
        accessibilityRole="header"
        className="mb-6 font-bold text-2xl text-text-primary"
      >
        Salud
      </Text>

      {dataError ? (
        <Text
          testID="health-error"
          accessibilityLiveRegion="polite"
          className="mb-5 text-error"
        >
          {dataError}
        </Text>
      ) : null}

      {/* **What is pending comes first, and most of the year it is nothing.**
          The tab is opened to find out whether something is owed; making that
          answer the first thing on the screen is the whole reason the section
          exists, and an empty one is good news that has to be said out loud
          rather than a gap. */}
      <Group title="PRÓXIMOS TRATAMIENTOS" testID="health-due" className="mb-6">
        {loading ? (
          <TreatmentSkeleton rows={2} />
        ) : due.length === 0 ? (
          <Text className="text-text-tertiary">
            Nada pendiente. Al apuntar una vacuna o una desparasitación, su
            próxima fecha aparece aquí.
          </Text>
        ) : (
          due.map((row) => <DueRow key={row.id} row={row} today={today} />)
        )}
      </Group>

      <Group title="PESO" testID="health-weight" className="mb-6">
        {loading ? (
          <View className="gap-3 pb-4">
            <Skeleton width="46%" height={26} />
            <Skeleton width="30%" height={11} />
            <Skeleton width="100%" height={72} />
          </View>
        ) : latest === null ? (
          <Text className="mb-4 text-text-tertiary">
            Todavía no le habéis pesado. El primer peso es el que da sentido a
            todos los demás.
          </Text>
        ) : (
          <Pressable
            testID="health-weight-latest"
            onPress={() => setWeighing(latest)}
            accessibilityRole="button"
            accessibilityLabel={`${formatWeight(latest.grams)} el ${displayDate(
              latest.measured_on,
            )}. Corregirlo`}
            className="mb-4 active:opacity-70"
          >
            <View className="flex-row items-baseline gap-3">
              <Text className="font-bold text-2xl text-text-primary">
                {formatWeight(latest.grams)}
              </Text>
              {change ? (
                <Text className="text-text-tertiary">
                  {formatChange(change.grams)} desde el{" "}
                  {displayDate(change.since)}
                </Text>
              ) : null}
            </View>
            <Text className="mt-1 text-xs text-text-muted">
              {displayDate(latest.measured_on)}
            </Text>
            {/* A field somebody can write into and never read back is a trap.
                The note belongs to the weight, so it appears with it. */}
            {latest.note ? (
              <View className="mt-1">
                <Markdown
                  text={latest.note}
                  className="text-xs text-text-tertiary"
                  compact
                />
              </View>
            ) : null}
          </Pressable>
        )}

        {/* **The chart is its own control, and a sibling of the number above
            it.** Two intentions — correct this weighing, open every weighing
            — and they were one Pressable inside another for as long as it
            took a test to click the first and land on the second. A button
            inside a button is also the nesting the sheets were just cured of;
            on the web it is invalid markup, and on the device it is a tap
            that goes somewhere nobody aimed. */}
        {!loading && weights && weights.length > 1 ? (
          <Pressable
            testID="health-weight-chart"
            onPress={() => router.push("/weights")}
            accessibilityRole="button"
            accessibilityLabel={`Ver los ${weights.length} pesajes`}
            className="mb-4 active:opacity-70"
          >
            {/* 16 for the mark and 6 either side of it: the month label
                stops where the mark starts rather than under it. */}
            <WeightLine weights={weights} endInset={28} />
            {/* The mark that says the line is a door. Bottom right, where a
                chart's own furniture ends. */}
            <View
              style={{ position: "absolute", right: 0, bottom: 0 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
            >
              <Maximize2 size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        ) : null}
      </Group>

      <Group
        title="HISTORIAL DE TRATAMIENTOS"
        testID="health-treatments"
        className="mb-6"
      >
        {loading ? (
          <TreatmentSkeleton rows={3} />
        ) : treatments && treatments.length > 0 ? (
          <View className="mb-4">
            {treatments.slice(0, HISTORY_PREVIEW).map((row) => (
              <Pressable
                key={row.id}
                testID={`health-treatment-${row.id}`}
                onPress={() => setTreating(row)}
                accessibilityRole="button"
                accessibilityLabel={`${treatmentLabel(
                  row.kind as TreatmentKind,
                )}${row.name ? `, ${row.name}` : ""}, el ${displayDate(
                  row.administered_on,
                )}. Editarlo`}
                className="flex-row items-start justify-between gap-3 py-3 active:opacity-70"
              >
                {/* **The glyph leads the row, not just the chip.** A year of
                    monthly antiparasitics is fifteen rows that all start with
                    the same three words; the icon is what lets an eye find
                    the vaccine among them without reading. Decoration to a
                    reader — the row's name already says the kind. */}
                <View
                  className="shrink-0 pt-0.5"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                >
                  {(() => {
                    const Glyph = TREATMENT_ICONS[row.kind as TreatmentKind];
                    return <Glyph size={16} color={colors.textTertiary} />;
                  })()}
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
                </View>
                <Text className="shrink-0 text-xs text-text-tertiary">
                  {displayDate(row.administered_on)}
                </Text>
              </Pressable>
            ))}

            {/* **The way through, and it says how far there is to go.** Eleven
                monthly antiparasitics behind a section is not a list, it is a
                wall; the count is what turns "there is more" into a reason to
                tap. */}
            {treatments.length > HISTORY_PREVIEW ? (
              <View className="mt-2 items-start">
                <Button
                  testID="health-treatments-all"
                  label={`Ver más`}
                  variant="link"
                  onPress={() => router.push("/treatments")}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <Text className="mb-4 text-text-tertiary">
            Aquí van las vacunas, las desparasitaciones y los antiparasitarios.
          </Text>
        )}
      </Group>

      {/* **Read here, written in the diary.** An incident happens at a time on
          a day and is logged where the tutor already is; but "¿cuándo fue lo
          del oído?" is a health question, and walking a calendar backwards is
          not an answer to it. Each one leads to its own day, which is where
          the medication that went with it lives — four rows at 11:31 that are
          really one episode, until the data model learns to say so. */}
      {incidents.length > 0 ? (
        <Group title="ENFERMEDADES" testID="health-incidents" className="mb-6">
          {incidents.map((event) => (
            <Pressable
              key={event.id}
              testID={`health-incident-${event.id}`}
              onPress={() =>
                router.push(`/?day=${dayKey(new Date(event.occurred_at))}`)
              }
              accessibilityRole="button"
              accessibilityLabel={`${
                eventDetail(event, "what") ?? "Incidencia"
              }, el ${displayDate(
                dayKey(new Date(event.occurred_at)),
              )}. Ver ese día`}
              className="flex-row items-start justify-between gap-3 py-3 active:opacity-70"
            >
              <View className="min-w-0 flex-1">
                {/* **The name of the illness first, then whatever was written
                    about it.** The note tends to hold the vet's protocol —
                    three medicines and the hours between them — and a section
                    that opened with that was answering "what was the
                    treatment" to somebody asking "what did he have". The
                    entry already carries the answer: "Qué ha pasado" is the
                    incident's own field in the diary. */}
                <Text className="font-semibold text-text-primary">
                  {eventDetail(event, "what") ?? "Incidencia"}
                </Text>
                {event.note ? (
                  <View className="mt-0.5">
                    <Markdown
                      text={event.note}
                      className="text-xs text-text-tertiary"
                      compact
                      // Three, because the vet's whole protocol is a perfectly
                      // good thing to write in a note and a bad thing to
                      // render five lines of in a section that summarises. The
                      // rest is one tap away, on the day it happened.
                      lines={3}
                    />
                  </View>
                ) : null}
              </View>
              <Text className="shrink-0 text-xs text-text-tertiary">
                {displayDate(dayKey(new Date(event.occurred_at)))}
              </Text>
            </Pressable>
          ))}
        </Group>
      ) : null}

      {/* **The two clinics, always on the screen.** They are a property of
          the animal rather than a record that accumulates, so they are not
          behind the floating action: there are exactly two, they are known in
          advance, and the emergency one is read by somebody who is
          frightened. A card that has to be discovered before it can be filled
          is a card that is empty on the night it matters. */}
      {VET_KINDS.map((kind) => (
        <VetCard
          key={kind}
          kind={kind}
          petId={pet.id}
          petName={pet.name}
          vet={readVet(pet[vetColumn(kind)])}
          onSaved={(message) => {
            toast.show({ variant: "success", message });
            reload();
          }}
          onFailed={(message) =>
            toast.show({ variant: "error", message, persist: true })
          }
        />
      ))}

      {weighing ? (
        <WeightSheet
          petId={pet.id}
          today={today}
          existing={weighing === "new" ? null : weighing}
          onClose={() => setWeighing(null)}
          onSaved={(message) => {
            setWeighing(null);
            toast.show({ variant: "success", message });
            reload();
          }}
          onFailed={(message) =>
            toast.show({ variant: "error", message, persist: true })
          }
        />
      ) : null}

      {treating ? (
        <TreatmentSheet
          petId={pet.id}
          today={today}
          existing={treating === "new" ? null : treating}
          onClose={() => setTreating(null)}
          onSaved={(message) => {
            setTreating(null);
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

/**
 * "4 de septiembre", and "4 de septiembre de 2025" when it is another year.
 *
 * The words rather than `DD/MM/AAAA`, which is the form the app *collects*
 * dates in because a number pad is what a keyboard offers. Read back, a
 * vaccine given "el 12 de junio" is a memory and "12/06/2026" is a receipt —
 * and the year is the half that matters here, so it appears exactly when it
 * is not the obvious one.
 */
function displayDate(iso: string): string {
  const parts = parseISO(iso);
  if (!parts) return iso;
  // Lowercase, the way Spanish writes a month inside a sentence — and the
  // way the day view already writes it two tabs away.
  const month = MONTHS_ES[parts.month - 1].toLowerCase();
  const year =
    parts.year === new Date().getFullYear() ? "" : ` de ${parts.year}`;
  return `${parts.day} de ${month}${year}`;
}

/**
 * One pending treatment, and how late it is.
 *
 * **Red only when the date has passed.** Overdue is the app's one meaning for
 * Error Red — something is wrong with the animal's care — and "in nine days"
 * is not wrong, it is a reminder. Soon carries the amber the calendar already
 * uses for medication, which is the same idea: a day that needs attention.
 */
function DueRow({ row, today }: { row: PetTreatmentRow; today: Date }) {
  const status = row.next_due_on ? dueStatus(row.next_due_on, today) : null;
  const tone =
    status === "overdue"
      ? "text-error"
      : status === "soon"
        ? "text-warning"
        : "text-text-tertiary";

  return (
    <View
      testID={`health-due-${row.id}`}
      className="flex-row items-baseline justify-between gap-4 py-2"
    >
      <Text className="min-w-0 flex-1 text-text-primary">
        {treatmentLabel(row.kind as TreatmentKind)}
        {row.name ? ` · ${row.name}` : ""}
      </Text>
      <Text className={`shrink-0 text-xs ${tone}`}>
        {status === "overdue" ? "Venció el " : ""}
        {displayDate(row.next_due_on ?? "")}
      </Text>
    </View>
  );
}

function WeightSheet({
  petId,
  today,
  existing,
  onClose,
  onSaved,
  onFailed,
}: {
  petId: string;
  today: Date;
  existing: PetWeightRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [on, setOn] = useState<string | null>(
    existing?.measured_on ?? measuredKey(today),
  );
  const [value, setValue] = useState(
    existing ? weightInput(existing.grams) : "",
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const grams = parseWeight(value);
  // Nothing to save until there is a weight — and on an existing one, until it
  // differs from what is stored, which is the profile's own rule.
  const changed = existing
    ? grams !== existing.grams ||
      on !== existing.measured_on ||
      note.trim() !== (existing.note ?? "")
    : grams !== null;

  const save = async () => {
    const day = on ? fromDateKey(on) : null;
    if (grams === null || !day) {
      setError("¿Cuánto pesa?");
      return false;
    }

    const { error: failure } = await saveWeight(petId, {
      measuredOn: day,
      grams,
      note,
    });
    if (failure) {
      onFailed(failure);
      return false;
    }
    onSaved("Peso apuntado");
    return true;
  };

  return (
    <Sheet onClose={onClose} testID="weight-sheet">
      <Text
        accessibilityRole="header"
        className="mb-5 font-bold text-lg text-text-primary"
      >
        {existing ? "Corregir el peso" : "Anotar peso"}
      </Text>

      <View className="mb-5">
        <DateField
          testID="weight-day"
          title="¿Qué día le pesasteis?"
          label="DÍA"
          value={on}
          onChange={setOn}
        />
      </View>

      <View className="mb-5">
        <TextField
          testID="weight-value"
          label="PESO"
          suffix="kg"
          suffixLabel="kilos"
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="12,4"
          error={error}
          required
        />
      </View>

      {/* The vocabulary of a field, beside the field: a three-line textarea
          leaves exactly enough room for it in the column alongside. */}
      <View className="mb-5 flex-row items-end gap-3">
        <View className="min-w-0 flex-1">
          <TextField
            testID="weight-note"
            multiline
            label="NOTA"
            value={note}
            onChangeText={setNote}
            placeholder="¿Algo que contar?"
            className="mb-0"
          />
        </View>
        <MarkdownHelp testID="weight-note-help" />
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button
            testID="weight-save"
            variant="primary"
            label="Guardar"
            successLabel="Apuntado"
            errorLabel="No se ha podido guardar"
            disabled={!changed}
            onPress={save}
          />
        </View>
      </View>

      {existing ? (
        <View className="mt-3 items-center">
          <Button
            testID="weight-delete"
            label="Borrar este peso"
            variant="link"
            tone="danger"
            onPress={async () => {
              const { error: failure } = await deleteWeight(existing.id);
              if (failure) {
                onFailed(failure);
                return false;
              }
              onSaved("Peso borrado");
              return true;
            }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
