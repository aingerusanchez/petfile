import { Bug, Scale, ShieldPlus, Syringe, Worm } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Button,
  Chip,
  ChipGroup,
  DateField,
  Group,
  LoadingScreen,
  Screen,
  Sheet,
  Text,
  TextField,
  WeightLine,
  useToast,
} from "../../components/ui";
import { MONTHS_ES, parseISO } from "../../lib/dates";
import { getMyPet, type PetRow } from "../../lib/pets";
import {
  dateKey,
  deleteTreatment,
  dueStatus,
  fromDateKey,
  logTreatment,
  pending,
  proposeNextDue,
  treatmentCadence,
  treatmentLabel,
  treatmentNameExamples,
  treatmentsFor,
  updateTreatment,
  TREATMENT_KINDS,
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
export default function Health() {
  const toast = useToast();

  const [pet, setPet] = useState<PetRow | null>(null);
  const [petError, setPetError] = useState<string | null>(null);
  const [weights, setWeights] = useState<PetWeightRow[] | null>(null);
  const [treatments, setTreatments] = useState<PetTreatmentRow[] | null>(null);
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

    Promise.all([weightsFor(petId), treatmentsFor(petId)]).then(
      ([weighed, treated]) => {
        if (cancelled) return;
        setWeights(weighed.weights);
        setTreatments(treated.treatments);
        // One message for both: a tutor who cannot reach the server cannot
        // reach it twice, and two identical lines read as two faults.
        setDataError(weighed.error ?? treated.error);
      },
    );

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
  const weighedToday = weights?.some((row) => row.measured_on === todayKey);

  return (
    <Screen scroll edges={["top"]}>
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
      <Group title="LO QUE TOCA" testID="health-due" className="mb-6">
        {loading ? (
          <Text className="text-text-tertiary">…</Text>
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
          <Text className="text-text-tertiary">…</Text>
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
              <Text className="mt-1 text-xs text-text-tertiary">
                {latest.note}
              </Text>
            ) : null}
            {weights && weights.length > 1 ? (
              <View className="mt-3">
                <WeightLine weights={weights} />
              </View>
            ) : null}
          </Pressable>
        )}

        <Button
          testID="health-weight-add"
          label={weighedToday ? "Corregir el peso de hoy" : "Apuntar peso"}
          variant="secondary"
          icon={Scale}
          onPress={() => setWeighing("new")}
        />
      </Group>

      <Group title="TRATAMIENTOS" testID="health-treatments" className="mb-6">
        {loading ? (
          <Text className="text-text-tertiary">…</Text>
        ) : treatments && treatments.length > 0 ? (
          <View className="mb-4">
            {treatments.map((row) => (
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
                className="flex-row items-baseline justify-between gap-4 py-3 active:opacity-70"
              >
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-text-primary">
                    {treatmentLabel(row.kind as TreatmentKind)}
                    {row.name ? ` · ${row.name}` : ""}
                  </Text>
                  {row.note ? (
                    <Text className="mt-0.5 text-xs text-text-tertiary">
                      {row.note}
                    </Text>
                  ) : null}
                </View>
                <Text className="shrink-0 text-xs text-text-tertiary">
                  {displayDate(row.administered_on)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="mb-4 text-text-tertiary">
            Aquí van las vacunas, las desparasitaciones y los antiparasitarios.
          </Text>
        )}

        <Button
          testID="health-treatment-add"
          label="Apuntar tratamiento"
          variant="secondary"
          icon={ShieldPlus}
          onPress={() => setTreating("new")}
        />
      </Group>

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
 * A glyph per kind, and it is teaching rather than decoration.
 *
 * **The two dewormings are the pair nobody can tell apart**, which is why the
 * labels carry "(Int.)" and "(Ext.)" at all — so the icons name what each one
 * is *for* rather than what it looks like: a worm for what lives inside, a
 * tick for what lives on the outside. The vaccine keeps the syringe, and the
 * section's own button gives it up for a shield, because an action button
 * wearing one of its three options' marks reads as a shortcut to that option.
 */
const KIND_ICONS = {
  vaccine: Syringe,
  deworming: Worm,
  antiparasitic: Bug,
} as const;

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
        {existing ? "Corregir el peso" : "Apuntar peso"}
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

      <View className="mb-5">
        <TextField
          testID="weight-note"
          label="NOTA"
          value={note}
          onChangeText={setNote}
          placeholder="¿Algo que contar?"
        />
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

function TreatmentSheet({
  petId,
  today,
  existing,
  onClose,
  onSaved,
  onFailed,
}: {
  petId: string;
  today: Date;
  existing: PetTreatmentRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [kind, setKind] = useState<TreatmentKind>(
    (existing?.kind as TreatmentKind) ?? "vaccine",
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [on, setOn] = useState<string | null>(
    existing?.administered_on ?? dateKey(today),
  );
  const [next, setNext] = useState<string | null>(
    existing
      ? existing.next_due_on
      : dateKey(proposeNextDue("vaccine", dateOf(dateKey(today)) ?? today)),
  );
  /**
   * Whether the next date is the tutor's answer or the app's proposal.
   *
   * **The proposal follows the kind and the date until somebody overrules it,
   * and then it stops.** Recomputing after an edit would throw away the vet's
   * actual instruction — the one thing PRODUCT.md says the row must keep — and
   * doing it in an effect would be the derived-state mistake the lint rule
   * catches. It happens in the handlers, where the intent is.
   */
  const [ownsNext, setOwnsNext] = useState(existing !== null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const propose = (forKind: TreatmentKind, iso: string | null) => {
    if (ownsNext) return;
    const from = iso ? dateOf(iso) : null;
    if (from) setNext(dateKey(proposeNextDue(forKind, from)));
  };

  const changed = existing
    ? kind !== existing.kind ||
      name.trim() !== (existing.name ?? "") ||
      on !== existing.administered_on ||
      next !== existing.next_due_on ||
      note.trim() !== (existing.note ?? "")
    : on !== null;

  const save = async () => {
    const administeredOn = on ? dateOf(on) : null;
    if (!administeredOn) {
      setError("¿Qué día se lo disteis?");
      return false;
    }

    const treatment = {
      kind,
      name,
      administeredOn,
      nextDueOn: next ? dateOf(next) : null,
      note,
    };

    const { error: failure } = existing
      ? await updateTreatment(existing.id, petId, treatment)
      : await logTreatment(petId, treatment);

    if (failure) {
      onFailed(failure);
      return false;
    }
    onSaved(existing ? "Tratamiento actualizado" : "Tratamiento apuntado");
    return true;
  };

  return (
    <Sheet onClose={onClose} testID="treatment-sheet">
      <Text
        accessibilityRole="header"
        className="mb-5 font-bold text-lg text-text-primary"
      >
        {existing ? "Editar tratamiento" : "Apuntar tratamiento"}
      </Text>

      <View className="mb-5">
        <ChipGroup label="QUÉ">
          {TREATMENT_KINDS.map((option) => (
            <Chip
              key={option}
              testID={`treatment-kind-${option}`}
              label={treatmentLabel(option)}
              icon={KIND_ICONS[option]}
              selected={kind === option}
              onPress={() => {
                setKind(option);
                propose(option, on);
              }}
            />
          ))}
        </ChipGroup>
      </View>

      <View className="mb-5">
        <TextField
          testID="treatment-name"
          label="NOMBRE"
          value={name}
          onChangeText={setName}
          placeholder={treatmentNameExamples(kind)}
        />
      </View>

      <View className="mb-5">
        <DateField
          testID="treatment-on"
          title="¿Qué día se lo disteis?"
          label="SE LO DIMOS EL"
          value={on}
          onChange={(iso) => {
            setOn(iso);
            setError(null);
            propose(kind, iso);
          }}
          error={error}
          required
        />
      </View>

      <View className="mb-5">
        <DateField
          testID="treatment-next"
          title="¿Cuándo toca la siguiente?"
          label="PRÓXIMA"
          value={next}
          // Forwards, because that is the only direction this date points —
          // and backwards too, because a dose can be overdue.
          reach="any"
          // "Sin fecha" is a real answer here: a one-off is not pending, it is
          // done, and the section above must not invent a reminder for it.
          clearable
          onChange={(iso) => {
            setNext(iso);
            setOwnsNext(true);
          }}
        />
        {/* **Why that date is there, in the kind's own rhythm.** The field
            fills itself and a date that appears out of nowhere invites either
            blind trust or a puzzled correction; "suele tocar cada 3 meses"
            makes the proposal legible enough to accept or to overrule on
            purpose. It says what is usual rather than what is set, so it
            stays true after somebody writes the vet's own date above it. */}
        <Text
          testID="treatment-cadence"
          className="-mt-3 text-xs text-text-tertiary"
        >
          Suele tocar {treatmentCadence(kind)}.
        </Text>
      </View>

      <View className="mb-5">
        <TextField
          testID="treatment-note"
          label="NOTA"
          value={note}
          onChangeText={setNote}
          placeholder="¿Algo que contar?"
        />
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button
            testID="treatment-save"
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
            testID="treatment-delete"
            label="Borrar este tratamiento"
            variant="link"
            tone="danger"
            onPress={async () => {
              const { error: failure } = await deleteTreatment(existing.id);
              if (failure) {
                onFailed(failure);
                return false;
              }
              onSaved("Tratamiento borrado");
              return true;
            }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

/** The local Date an ISO day names. Shared by both sheets. */
function dateOf(iso: string): Date | null {
  return fromDateKey(iso);
}
