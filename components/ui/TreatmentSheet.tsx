import { useState } from "react";
import { View } from "react-native";
import { MONTHS_ES, parseISO } from "../../lib/dates";
import {
  canonicalVaccine,
  dateKey,
  deleteTreatment,
  fromDateKey,
  logTreatment,
  proposeNextDue,
  searchVaccines,
  treatmentCadence,
  treatmentLabel,
  treatmentNameExamples,
  updateTreatment,
  vaccineNote,
  TREATMENT_KINDS,
  type PetTreatmentRow,
  type TreatmentKind,
} from "../../lib/treatments";
import { Button } from "./Button";
import { Chip, ChipGroup } from "./Chip";
import { DateField } from "./DateField";
import { MarkdownHelp } from "./MarkdownHelp";
import { Sheet } from "./Sheet";
import { SuggestField } from "./SuggestField";
import { Text } from "./Text";
import { TextField } from "./TextField";
import { TREATMENT_ICONS } from "./treatmentIcons";

/**
 * The form a treatment is written and corrected in.
 *
 * **It lives here rather than in the screen because two screens open it.**
 * Salud writes the next one; the history corrects an old one, and a form that
 * only one of them could reach would mean either duplicating it or making the
 * history read-only — which is the wrong answer for a list whose whole job is
 * being scrolled through looking for the row with the typo in it.
 */
export function TreatmentSheet({
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
  /**
   * Whether the next date is on screen at all.
   *
   * **Two adjacent date fields is one date field too many.** They looked
   * identical, sat one above the other, and the date being typed was the one
   * the vet just said — which is the *first* field, not the second. The tutor
   * who designed this form filled in the wrong one more than once, and the
   * fix is not a clearer label: it is one date to fill.
   *
   * So the proposal is a sentence, and the field appears only when somebody
   * disagrees with it. An existing row that already carries a date of its own
   * opens with it showing, because hiding a stored value behind a link is how
   * a value gets forgotten.
   */
  const [changingNext, setChangingNext] = useState(
    existing !== null && existing.next_due_on !== null,
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const propose = (forKind: TreatmentKind, iso: string | null) => {
    if (ownsNext) return;
    const from = iso ? dateOf(iso) : null;
    if (from) setNext(dateKey(proposeNextDue(forKind, from)));
  };

  // Stored in the list's own spelling when it is on the list, exactly as
  // written when it is not: the combobox accepts anything, and "rabia" and
  // "Rabia " must still be one schedule.
  const savedName =
    (kind === "vaccine" ? canonicalVaccine(name) : null) ?? name.trim();

  const changed = existing
    ? kind !== existing.kind ||
      savedName !== (existing.name ?? "") ||
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
      name: savedName,
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
              icon={TREATMENT_ICONS[option]}
              selected={kind === option}
              onPress={() => {
                setKind(option);
                propose(option, on);
              }}
            />
          ))}
        </ChipGroup>
      </View>

      {/* **The vaccines suggest; the dewormings do not.** Here the name is
          the schedule key, so the curated spelling has to be the easy one —
          but a list of vaccines is never complete, and a combobox is what
          offers a list without refusing what is off it. Six of them outgrew a
          row of chips; the two dewormings keep a plain field, because there
          the name is whichever product the vet handed over. */}
      {kind === "vaccine" ? (
        <>
          <SuggestField
            testID="treatment-name"
            label="CUÁL"
            value={name || null}
            onChange={(next) => setName(next ?? "")}
            search={searchVaccines}
            suggestionPrefix="treatment-vaccine"
            placeholder="Polivalente, Rabia…"
            maxLength={40}
          />
          {vaccineNote(canonicalVaccine(name) ?? "") ? (
            <Text
              testID="treatment-vaccine-note"
              className="-mt-3 mb-5 text-xs text-text-tertiary"
            >
              {vaccineNote(canonicalVaccine(name) ?? "")}
            </Text>
          ) : null}
        </>
      ) : (
        <View className="mb-5">
          <TextField
            testID="treatment-name"
            label="NOMBRE"
            value={name}
            onChangeText={setName}
            placeholder={treatmentNameExamples(kind)}
          />
        </View>
      )}

      <View className="mb-5">
        <DateField
          testID="treatment-on"
          title="¿Qué día se lo disteis?"
          label="FECHA"
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

      {/* **The next dose is a sentence until somebody disagrees with it.**
          The app knows the rhythm of all three kinds, so on an ordinary visit
          there is nothing here to decide — and the one thing PRODUCT.md says
          the row must keep, the vet's own instruction, is still one tap away
          and still stored as confirmed rather than recomputed. */}
      <View className="mb-5">
        {changingNext ? (
          <>
            <DateField
              testID="treatment-next"
              title="¿Cuándo toca la siguiente?"
              label="PRÓXIMA"
              value={next}
              // Forwards, because that is the only direction this date points
              // — and backwards too, because a dose can be overdue.
              reach="any"
              // "Sin fecha" is a real answer here: a one-off is not pending,
              // it is done, and the section above must not invent a reminder.
              clearable
              onChange={(iso) => {
                setNext(iso);
                setOwnsNext(true);
              }}
            />
            <Text className="-mt-3 text-xs text-text-tertiary">
              Suele tocar {treatmentCadence(kind)}.
            </Text>
          </>
        ) : (
          // **One row, aligned at the top, not a paragraph with a word loose
          // at the end of it.** Baseline-aligned and wrapping, the link landed
          // wherever the sentence happened to break — too close to read as a
          // second column and out of line to read as part of the sentence. The
          // sentence takes the width it needs and the control sits at the
          // right edge, which is where every other "and here is what you can
          // do about it" in this app sits.
          <View className="flex-row items-start justify-between gap-4">
            <Text
              testID="treatment-cadence"
              className="min-w-0 flex-1 pt-3 text-text-tertiary"
            >
              {next
                ? `La siguiente tocará el ${displayDate(next)}`
                : "Sin siguiente"}
              , {treatmentCadence(kind)}.
            </Text>
            <View className="shrink-0">
              <Button
                testID="treatment-next-change"
                label="Editar"
                variant="link"
                onPress={() => setChangingNext(true)}
              />
            </View>
          </View>
        )}
      </View>

      <TextField
        testID="treatment-note"
        multiline
        label="NOTA"
        value={note}
        onChangeText={setNote}
        placeholder="¿Algo que contar?"
        corner={<MarkdownHelp testID="treatment-note-help" />}
      />

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

/** The local Date an ISO day names. */
function dateOf(iso: string): Date | null {
  return fromDateKey(iso);
}

/** "4 de diciembre", and the year when it is not this one. */
function displayDate(iso: string): string {
  const parts = parseISO(iso);
  if (!parts) return iso;
  const month = MONTHS_ES[parts.month - 1].toLowerCase();
  const year =
    parts.year === new Date().getFullYear() ? "" : ` de ${parts.year}`;
  return `${parts.day} de ${month}${year}`;
}
