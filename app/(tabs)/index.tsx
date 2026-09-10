import {
  Footprints,
  Pill,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import {
  Button,
  Fab,
  FAB_CLEARANCE,
  Group,
  LoadingScreen,
  Screen,
  Text,
  TextField,
  colors,
  pressed,
  useToast,
  TOUCH_TARGET,
} from "../../components/ui";
import { MONTHS_ES } from "../../lib/dates";
import {
  deleteEvent,
  eventsForDay,
  formatTimeOfDay,
  logEvent,
  minutesBetween,
  parseTimeOfDay,
  shiftMinutes,
  updateEvent,
  walkedMinutes,
  type EventKind,
  type PetEventRow,
} from "../../lib/events";
import { getMyPet, type PetRow } from "../../lib/pets";

/**
 * What each kind asks for beyond a time and a note.
 *
 * One sheet serves all four because they are one shape with one variable
 * field: something happened, at a time, and here is the one thing worth
 * saying about it. Four separate forms would be four places for the time
 * field to drift.
 */
const KINDS: Record<
  EventKind,
  {
    label: string;
    action: string;
    editAction: string;
    icon: LucideIcon;
    /**
     * The one free-text field this kind asks for. The walk has none: it asks
     * for a time range instead, which the sheet renders on its own.
     */
    field?: { label: string; placeholder: string };
    /** The detail line under an entry in the list. */
    describe: (event: PetEventRow) => string | null;
  }
> = {
  walk: {
    label: "Paseo",
    action: "Añadir paseo",
    editAction: "Editar paseo",
    icon: Footprints,
    describe: (event) =>
      event.duration_minutes ? `${event.duration_minutes} min` : null,
  },
  meal: {
    label: "Comida",
    action: "Añadir comida",
    editAction: "Editar comida",
    icon: UtensilsCrossed,
    field: { label: "Qué ha comido", placeholder: "Pienso" },
    describe: (event) => detail(event, "what"),
  },
  medication: {
    label: "Medicación",
    action: "Añadir medicación",
    editAction: "Editar medicación",
    icon: Pill,
    field: { label: "Qué le habéis dado", placeholder: "Apoquel, media" },
    describe: (event) => detail(event, "what"),
  },
  incident: {
    label: "Incidencia",
    action: "Añadir incidencia",
    editAction: "Editar incidencia",
    icon: TriangleAlert,
    field: { label: "Qué ha pasado", placeholder: "Cojea de la pata derecha" },
    describe: (event) => detail(event, "what"),
  },
};

const ORDER: EventKind[] = ["walk", "meal", "medication", "incident"];

/** How much a tap on -15 or +15 moves a walk's duration. */
const STEP_MINUTES = 15;

/** The one free-text specific each kind but the walk keeps in `details`. */
function detail(event: PetEventRow, key: string): string | null {
  const details = event.details as Record<string, unknown> | null;
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function formatDay(day: Date): string {
  const weekdays = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return `${weekdays[day.getDay()]}, ${day.getDate()} de ${MONTHS_ES[day.getMonth()].toLowerCase()}`;
}

/** What the sheet is open for: a new entry of a kind, or an existing one. */
type Editing = { kind: EventKind; event: PetEventRow | null };

/**
 * The day view: what happened today, and the fastest way to add to it.
 *
 * This is the screen the product exists for. PRODUCT.md's insight is that
 * logging is **retrospective** — a walk occupies the tutor's hands, so the
 * entry happens after getting home — which shapes the whole screen. The four
 * kinds are one tap from the thumb rather than behind a chooser, the time
 * field opens on the current time so confirming it is the common case, and
 * **every entry is a correction waiting to happen**: tapping a row reopens it.
 *
 * **The goal bar reads in Aqua Glaciar, and turns Success Green when the goal
 * is met.** It was Steel Frost on the reasoning that progress is state rather
 * than an action, and the accent means "act here" (The One Accent Rule) — but
 * on the device a 4px hairline in a border colour did not read as a measure of
 * anything. Aqua Glaciar is the secondary accent, already the colour of links
 * and the required marker, so it stays clear of Ice Blue Glacial: the primary
 * accent still means "this is the one thing to do here", and on this screen
 * the one thing is the floating action.
 */
export default function Home() {
  const toast = useToast();
  const [day] = useState(() => new Date());
  const [pet, setPet] = useState<PetRow | null>(null);
  const [events, setEvents] = useState<PetEventRow[] | null>(null);
  /** Fatal: with no pet there is no day to show. */
  const [petError, setPetError] = useState<string | null>(null);
  /** Not fatal: the header, the goal and the actions all still work. */
  const [logError, setLogError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyPet().then(async ({ pet: row, error: failure }) => {
      if (cancelled) return;
      if (failure) return setPetError(failure);
      if (!row) return setPetError("Todavía no hay ninguna mascota");

      setPet(row);
      const { events: rows, error: eventError } = await eventsForDay(
        row.id,
        day,
      );
      if (cancelled) return;
      // A failed read of the log does not take the screen down with it: the
      // craft floor's rule is that one component's error must not block the
      // whole interface, and everything above the log comes from the pet.
      setLogError(eventError);
      setEvents(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [day, attempt]);

  const reload = useCallback(() => {
    setPetError(null);
    setLogError(null);
    setAttempt((n) => n + 1);
  }, []);

  if (petError) {
    return (
      <Screen center edges={["top"]}>
        <Text
          accessibilityLiveRegion="polite"
          className="mb-5 text-center text-error"
        >
          {petError}
        </Text>
        <Button testID="home-retry" label="Reintentar" onPress={reload} />
      </Screen>
    );
  }

  if (!pet || !events) return <LoadingScreen />;

  const walked = walkedMinutes(events);
  const goal = pet.exercise_goal_minutes;
  const met = goal !== null && walked >= goal;

  return (
    <Screen
      scroll
      edges={["top"]}
      overlay={(position) => (
        <Fab
          testID="home-add"
          position={position}
          label="Añadir un registro"
          actions={ORDER.map((kind) => ({
            key: kind,
            testID: `home-add-${kind}`,
            label: KINDS[kind].label,
            icon: KINDS[kind].icon,
            onPress: () => setEditing({ kind, event: null }),
          }))}
        />
      )}
    >
      <Text
        testID="home-title"
        accessibilityRole="header"
        className="text-2xl text-text-primary"
      >
        Hoy
      </Text>
      <Text testID="home-date" className="mb-8 text-text-tertiary">
        {formatDay(day)}
      </Text>

      {goal !== null ? (
        <View testID="home-goal" className="mb-8">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="font-semibold text-text-primary">
              {`${walked} de ${goal} min paseados`}
            </Text>
            {met ? (
              <Text className="text-xs font-semibold text-success">
                Objetivo cumplido
              </Text>
            ) : null}
          </View>
          {/* A bar, not a ring: the question is "how much of the day's target
              is done", which is one dimension. */}
          <View className="h-1 overflow-hidden rounded-xl bg-surface">
            <View
              testID="home-goal-bar"
              style={{
                width: `${Math.min(100, goal === 0 ? 0 : (walked / goal) * 100)}%`,
              }}
              className={`h-1 ${met ? "bg-success" : "bg-accent-secondary"}`}
            />
          </View>
        </View>
      ) : null}

      {logError ? (
        <Group testID="home-log-error">
          <Text accessibilityLiveRegion="polite" className="mb-5 text-error">
            {logError}
          </Text>
          <View className="mb-5">
            <Button
              testID="home-log-retry"
              label="Reintentar"
              onPress={reload}
            />
          </View>
        </Group>
      ) : events.length === 0 ? (
        <Group testID="home-empty">
          <Text className="mb-2 font-semibold text-text-primary">
            Todavía no hay nada de hoy
          </Text>
          <Text className="mb-5 text-text-tertiary">
            {`Cuando salgáis a pasear o ${pet.name} coma, apúntalo aquí y no se pierde.`}
          </Text>
        </Group>
      ) : (
        <Group testID="home-log" title="Registro de hoy">
          {events.map((event) => (
            <Entry
              key={event.id}
              event={event}
              onPress={() =>
                setEditing({ kind: event.kind as EventKind, event })
              }
            />
          ))}
        </Group>
      )}

      {/* Room for the floating action to sit over nothing. Without it the last
          entry of a full day hides under the button that added it. */}
      <View style={{ height: FAB_CLEARANCE }} />

      {editing ? (
        <EntrySheet
          kind={editing.kind}
          event={editing.event}
          day={day}
          petName={pet.name}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setAttempt((n) => n + 1);
          }}
          onFailed={(message) =>
            toast.show({ variant: "error", message, persist: true })
          }
          petId={pet.id}
        />
      ) : null}
    </Screen>
  );
}

/**
 * One line of the day, and the way back into it.
 *
 * **The kind is drawn as well as named**, under the time, with the same icon
 * the action that created it carries. Four kinds in one list read as one
 * undifferentiated column when only a word separates them, and the glance this
 * screen is built for is a glance rather than a read.
 *
 * The whole row is the target, because the row is what the tutor is thinking
 * about. It opens the sheet it was created from — which is also where its
 * delete lives: a delete in the list is a mis-tap waiting for a scroll.
 */
function Entry({
  event,
  onPress,
}: {
  event: PetEventRow;
  onPress: () => void;
}) {
  const spec = KINDS[event.kind as EventKind];
  const time = formatTimeOfDay(new Date(event.occurred_at));
  const described = spec?.describe(event);
  const Icon = spec?.icon;

  return (
    <Pressable
      testID={`home-entry-${event.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[spec?.label ?? event.kind, time, described]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Ábrelo para corregirlo o borrarlo"
      style={(state) => [{ minHeight: TOUCH_TARGET }, pressed(state)]}
      className="mb-5 flex-row items-start gap-3"
    >
      <View className="w-12 items-start gap-1">
        <Text className="text-text-tertiary">{time}</Text>
        {Icon ? (
          // The same tone as the time above it: they are one column, read as
          // one thing. Mist Grey measured 3.96:1 here — enough for a
          // non-text indicator, but visibly fainter than the time it pairs
          // with, which made the pair read as two weights.
          <Icon size={18} strokeWidth={2} color={colors.textTertiary} />
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-text-primary">
          {spec?.label ?? event.kind}
        </Text>
        {described ? (
          <Text className="text-text-secondary">{described}</Text>
        ) : null}
        {event.note ? (
          <Text className="text-xs text-text-tertiary">{event.note}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The sheet that adds one entry, or corrects one.
 *
 * Local to this screen rather than in `components/ui`: it is not a primitive,
 * it is this screen's form. It becomes shared the day a second surface needs
 * it — the health tab will need its own, for weights and treatments, and
 * whether that is this sheet with two more kinds or a different one is a
 * decision for when it exists rather than now.
 *
 * **Adding and correcting are the same form.** An edit reopens the sheet the
 * entry was created from, prefilled, and the heading says "Editar paseo" —
 * the button still says what pressing it does, because "Editar" on a control
 * that saves describes the sheet rather than the press.
 *
 * **A walk is asked for as a range; every other kind as a moment.** A tutor
 * knows when they left and when they got back, not how many minutes that was.
 * But the fastest walk to log is the one with nothing to say about it, so the
 * duration also has **-15 / +15**: tap Paseo, tap +15 three times, save.
 * DESDE and HASTA remain the data — the steppers write into HASTA, exactly as
 * typing a duration does, because the start is the one thing the tutor is sure
 * of and must never shift under them.
 *
 * The start opens on the current time and the other two open empty. Nothing is
 * proposed: a prefilled thirty minutes would be a fabricated walk one careless
 * tap away, and a walk with no duration is a valid entry — it still happened.
 *
 * **Delete lives here, not in the list**, and asks once in place. A row in a
 * scrolling list is a mis-tap waiting to happen; a modal on top of a modal is
 * worse on Android than the question it would ask.
 */
function EntrySheet({
  kind,
  event,
  day,
  petId,
  petName,
  onClose,
  onSaved,
  onFailed,
}: {
  kind: EventKind;
  /** The entry being corrected, or null when this is a new one. */
  event: PetEventRow | null;
  day: Date;
  petId: string;
  petName: string;
  onClose: () => void;
  onSaved: () => void;
  onFailed: (message: string) => void;
}) {
  const spec = KINDS[kind];
  const isWalk = kind === "walk";

  const occurred = event ? new Date(event.occurred_at) : null;
  const storedMinutes = event?.duration_minutes ?? null;

  /** The moment it happened — the walk's start, everything else's only time. */
  const [start, setStart] = useState(() =>
    formatTimeOfDay(occurred ?? new Date()),
  );
  const [end, setEnd] = useState(() =>
    occurred && storedMinutes
      ? formatTimeOfDay(shiftMinutes(occurred, storedMinutes))
      : "",
  );
  const [duration, setDuration] = useState(() =>
    storedMinutes ? String(storedMinutes) : "",
  );
  const [value, setValue] = useState(
    () => (event && detail(event, "what")) || "",
  );
  const [note, setNote] = useState(() => event?.note ?? "");
  const [startError, setStartError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** Recomputes the derived field. Never writes back to a time. */
  const deriveDuration = useCallback(
    (startText: string, endText: string) => {
      if (!endText.trim()) return setDuration("");
      const from = parseTimeOfDay(startText, day);
      const to = parseTimeOfDay(endText, day);
      if (!from || !to) return;
      const minutes = minutesBetween(from, to);
      setDuration(minutes === null ? "" : String(minutes));
    },
    [day],
  );

  const editStart = useCallback(
    (text: string) => {
      setStart(text);
      deriveDuration(text, end);
    },
    [deriveDuration, end],
  );

  const editEnd = useCallback(
    (text: string) => {
      setEnd(text);
      deriveDuration(start, text);
    },
    [deriveDuration, start],
  );

  /** The one direction that writes into a time, and it writes into the end. */
  const setMinutes = useCallback(
    (minutes: number | null) => {
      if (minutes === null || minutes <= 0) {
        setDuration("");
        setEnd("");
        return;
      }
      setDuration(String(minutes));
      const from = parseTimeOfDay(start, day);
      if (from) setEnd(formatTimeOfDay(shiftMinutes(from, minutes)));
    },
    [start, day],
  );

  const editDuration = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, "");
      setMinutes(digits ? Number(digits) : null);
    },
    [setMinutes],
  );

  const minutes = Number(duration) || 0;

  const save = useCallback(async () => {
    const occurredAt = parseTimeOfDay(start, day);
    if (!occurredAt) {
      setStartError("Escríbela como 09:15");
      return false;
    }
    setStartError(null);

    let walkMinutes: number | null = null;
    if (isWalk && end.trim()) {
      const to = parseTimeOfDay(end, day);
      if (!to) {
        setEndError("Escríbela como 09:15");
        return false;
      }
      if (to.getTime() > Date.now() + 60_000) {
        setEndError("¿Todavía no habéis vuelto?");
        return false;
      }
      walkMinutes = minutesBetween(occurredAt, to);
      if (walkMinutes === null) {
        setEndError("Tiene que ser más tarde que la hora de salida");
        return false;
      }
    }
    setEndError(null);

    const payload = {
      kind,
      occurredAt,
      durationMinutes: walkMinutes,
      note: note || null,
      details: spec.field && value.trim() ? { what: value.trim() } : {},
    };

    const { error } = event
      ? await updateEvent(event.id, payload)
      : await logEvent(petId, payload);

    if (error) {
      onFailed(error);
      return false;
    }

    onSaved();
    return true;
  }, [
    start,
    end,
    day,
    isWalk,
    spec,
    value,
    note,
    petId,
    kind,
    event,
    onFailed,
    onSaved,
  ]);

  const remove = useCallback(async () => {
    if (!event) return false;
    const { error } = await deleteEvent(event.id);
    if (error) {
      onFailed(error);
      return false;
    }
    onSaved();
    return true;
  }, [event, onFailed, onSaved]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="entry-scrim"
        onPress={onClose}
        className="flex-1 justify-end bg-base/80"
      >
        <Pressable
          onPress={(pressEvent) => pressEvent.stopPropagation()}
          className="rounded-xl border border-border-default bg-surface p-5"
        >
          <Text
            testID="entry-title"
            accessibilityRole="header"
            className="mb-5 text-xl font-bold text-text-primary"
          >
            {event ? spec.editAction : spec.action}
          </Text>

          {isWalk ? (
            <>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField
                    testID="entry-from"
                    label="Desde"
                    value={start}
                    onChangeText={editStart}
                    placeholder="09:15"
                    error={startError}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View className="flex-1">
                  <TextField
                    testID="entry-to"
                    label="Hasta"
                    value={end}
                    onChangeText={editEnd}
                    placeholder="09:45"
                    error={endError}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </View>

              {/* The duration is the field most walks are actually about, so
                  it gets the steppers — and only the width its value needs. */}
              <View className="mb-5 flex-row items-end gap-3">
                <View style={{ width: 128 }}>
                  <TextField
                    testID="entry-duration"
                    label="Duración"
                    value={duration}
                    onChangeText={editDuration}
                    placeholder="30"
                    suffix="min."
                    suffixLabel="en minutos"
                    keyboardType="number-pad"
                    maxLength={4}
                    className=""
                  />
                </View>
                <Step
                  testID="entry-duration-minus"
                  label={`-${STEP_MINUTES}`}
                  accessibilityLabel={`Quitar ${STEP_MINUTES} minutos`}
                  disabled={minutes <= STEP_MINUTES}
                  onPress={() => setMinutes(minutes - STEP_MINUTES)}
                />
                <Step
                  testID="entry-duration-plus"
                  label={`+${STEP_MINUTES}`}
                  accessibilityLabel={`Añadir ${STEP_MINUTES} minutos`}
                  onPress={() => setMinutes(minutes + STEP_MINUTES)}
                />
              </View>
            </>
          ) : (
            <TextField
              testID="entry-time"
              label="Hora"
              value={start}
              onChangeText={editStart}
              placeholder="09:15"
              error={startError}
              keyboardType="number-pad"
              maxLength={5}
            />
          )}

          {spec.field ? (
            <TextField
              testID="entry-value"
              label={spec.field.label}
              value={value}
              onChangeText={setValue}
              placeholder={spec.field.placeholder}
              maxLength={80}
            />
          ) : null}

          <TextField
            testID="entry-note"
            label="Nota"
            value={note}
            onChangeText={setNote}
            placeholder="¿Algo que contar?"
            maxLength={200}
          />

          <View className="mt-2 flex-row gap-3">
            <Pressable
              testID="entry-cancel"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              style={(state) => [{ minHeight: TOUCH_TARGET }, pressed(state)]}
              className="flex-1 items-center justify-center rounded-xl border border-border-strong py-4"
            >
              <Text className="text-text-secondary">Cancelar</Text>
            </Pressable>
            <View className="flex-1">
              <Button
                testID="entry-save"
                variant="primary"
                label={event ? "Guardar cambios" : "Guardar"}
                successLabel="Apuntado"
                errorLabel="No se ha podido guardar"
                onPress={save}
              />
            </View>
          </View>

          {event ? (
            <View className="mt-6 border-t border-border-default pt-4">
              {confirmingDelete ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-text-secondary">¿Lo borro?</Text>
                  <View className="flex-row items-center gap-5">
                    <Button
                      testID="entry-delete-cancel"
                      variant="link"
                      label="No"
                      accessibilityLabel="No borrarlo"
                      onPress={() => setConfirmingDelete(false)}
                    />
                    <Button
                      testID="entry-delete-confirm"
                      variant="link"
                      tone="danger"
                      label="Sí, bórralo"
                      successLabel="Borrado"
                      errorLabel="No se ha podido borrar"
                      onPress={remove}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  testID="entry-delete"
                  variant="link"
                  tone="danger"
                  label="Borrar este registro"
                  onPress={() => setConfirmingDelete(true)}
                />
              )}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A fixed increment for the field beside it. Text, not an icon: it is a number. */
function Step({
  testID,
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  testID: string;
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={(state) => [
        { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET },
        pressed(state),
      ]}
      className="items-center justify-center rounded-xl border border-border-strong pl-3 pr-3"
    >
      <Text
        // `text-tertiary` when disabled, not `text-muted`: the same choice the
        // disabled button made, and 6.64:1 rather than 3.58:1 on this fill.
        className={
          disabled ? "text-text-tertiary" : "font-semibold text-text-secondary"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
