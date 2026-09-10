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
  Group,
  LoadingScreen,
  Screen,
  Text,
  TextField,
  pressed,
  useToast,
  TOUCH_TARGET,
} from "../../components/ui";
import { MONTHS_ES } from "../../lib/dates";
import {
  eventsForDay,
  formatTimeOfDay,
  logEvent,
  parseTimeOfDay,
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
    icon: LucideIcon;
    /** The one kind-specific field. Absent for a kind that needs none. */
    field?: { label: string; placeholder: string; numeric?: boolean };
    /** The detail line under an entry in the list. */
    describe: (event: PetEventRow) => string | null;
  }
> = {
  walk: {
    label: "Paseo",
    action: "Añadir paseo",
    icon: Footprints,
    // The unit is in the label, not only in the placeholder: a placeholder
    // disappears the moment the tutor types, taking the "min" with it.
    field: { label: "Duración (min)", placeholder: "30", numeric: true },
    describe: (event) =>
      event.duration_minutes ? `${event.duration_minutes} min` : null,
  },
  meal: {
    label: "Comida",
    action: "Añadir comida",
    icon: UtensilsCrossed,
    field: { label: "Qué ha comido", placeholder: "Pienso" },
    describe: (event) => detail(event, "what"),
  },
  medication: {
    label: "Medicación",
    action: "Añadir medicación",
    icon: Pill,
    field: { label: "Qué le habéis dado", placeholder: "Apoquel, media" },
    describe: (event) => detail(event, "what"),
  },
  incident: {
    label: "Incidencia",
    action: "Añadir incidencia",
    icon: TriangleAlert,
    field: { label: "Qué ha pasado", placeholder: "Cojea de la pata derecha" },
    describe: (event) => detail(event, "what"),
  },
};

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

/**
 * The day view: what happened today, and the fastest way to add to it.
 *
 * This is the screen the product exists for. PRODUCT.md's insight is that
 * logging is **retrospective** — a walk occupies the tutor's hands, so the
 * entry happens after getting home — which shapes two decisions here. The four
 * kinds are each one tap away rather than behind a chooser, and the time field
 * opens on the current time so confirming it is the common case and changing
 * two digits is the retrospective one.
 *
 * **The goal bar is not the accent.** Progress toward a target is state, not an
 * action, and the accent means "act here" (The One Accent Rule). It reads in
 * Steel Frost while the day is short and turns Success Green when the goal is
 * met, which is the only moment worth colouring.
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
  const [adding, setAdding] = useState<EventKind | null>(null);
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
    <Screen scroll edges={["top"]}>
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
              className={`h-1 ${met ? "bg-success" : "bg-border-strong"}`}
            />
          </View>
        </View>
      ) : null}

      <View className="mb-8 flex-row flex-wrap gap-3">
        {(Object.keys(KINDS) as EventKind[]).map((kind) => (
          <Button
            key={kind}
            testID={`home-add-${kind}`}
            icon={KINDS[kind].icon}
            label={KINDS[kind].label}
            accessibilityLabel={KINDS[kind].action}
            onPress={() => setAdding(kind)}
          />
        ))}
      </View>

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
            <View
              key={event.id}
              testID={`home-entry-${event.id}`}
              className="mb-5 flex-row items-start gap-3"
            >
              <Text className="w-12 text-text-tertiary">
                {formatTimeOfDay(new Date(event.occurred_at))}
              </Text>
              <View className="flex-1">
                <Text className="font-semibold text-text-primary">
                  {KINDS[event.kind as EventKind]?.label ?? event.kind}
                </Text>
                {KINDS[event.kind as EventKind]?.describe(event) ? (
                  <Text className="text-text-secondary">
                    {KINDS[event.kind as EventKind].describe(event)}
                  </Text>
                ) : null}
                {event.note ? (
                  <Text className="text-xs text-text-tertiary">
                    {event.note}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </Group>
      )}

      {adding ? (
        <EntrySheet
          kind={adding}
          day={day}
          petName={pet.name}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
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
 * The sheet that adds one entry.
 *
 * Local to this screen rather than in `components/ui`: it is not a primitive,
 * it is this screen's form. It becomes shared the day a second surface needs
 * it — the health tab will need its own, for weights and treatments, and
 * whether that is this sheet with two more kinds or a different one is a
 * decision for when it exists rather than now.
 */
function EntrySheet({
  kind,
  day,
  petId,
  petName,
  onClose,
  onSaved,
  onFailed,
}: {
  kind: EventKind;
  day: Date;
  petId: string;
  petName: string;
  onClose: () => void;
  onSaved: () => void;
  onFailed: (message: string) => void;
}) {
  const spec = KINDS[kind];
  const [time, setTime] = useState(() => formatTimeOfDay(new Date()));
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);

  const save = useCallback(async () => {
    const occurredAt = parseTimeOfDay(time, day);
    if (!occurredAt) {
      setTimeError("Escríbela como 09:15");
      return false;
    }
    setTimeError(null);

    const minutes = spec.field?.numeric
      ? Number(value.replace(/\D/g, ""))
      : null;
    const { error } = await logEvent(petId, {
      kind,
      occurredAt,
      durationMinutes: minutes || null,
      note: note || null,
      details:
        spec.field && !spec.field.numeric && value.trim()
          ? { what: value.trim() }
          : {},
    });

    if (error) {
      onFailed(error);
      return false;
    }

    onSaved();
    return true;
  }, [time, day, spec, value, note, petId, kind, onFailed, onSaved]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="entry-scrim"
        onPress={onClose}
        className="flex-1 justify-end bg-base/80"
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="rounded-xl border border-border-default bg-surface p-5"
        >
          <Text
            accessibilityRole="header"
            className="mb-5 text-xl font-bold text-text-primary"
          >
            {spec.action}
          </Text>

          <TextField
            testID="entry-time"
            label="Hora"
            value={time}
            onChangeText={setTime}
            placeholder="09:15"
            error={timeError}
            keyboardType="number-pad"
            maxLength={5}
          />

          {spec.field ? (
            <TextField
              testID="entry-value"
              label={spec.field.label}
              value={value}
              onChangeText={setValue}
              placeholder={spec.field.placeholder}
              keyboardType={spec.field.numeric ? "number-pad" : "default"}
              maxLength={spec.field.numeric ? 4 : 80}
            />
          ) : null}

          <TextField
            testID="entry-note"
            label="Nota"
            value={note}
            onChangeText={setNote}
            placeholder={`Algo que recordar de ${petName}`}
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
                label="Guardar"
                successLabel="Apuntado"
                errorLabel="No se ha podido guardar"
                onPress={save}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
