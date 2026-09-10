import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Pill,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Button,
  colors,
  Fab,
  FAB_CLEARANCE,
  Group,
  LoadingScreen,
  MonthCalendar,
  Screen,
  Sheet,
  Text,
  TextField,
  TOUCH_TARGET,
  useToast,
} from "../../components/ui";
import { daysAgo, formatDayDate, formatDayHeadline } from "../../lib/dates";
import { formatDuration, parseDuration } from "../../lib/duration";
import {
  deleteEvent,
  eventsForDay,
  eventsForMonth,
  formatTimeOfDay,
  logEvent,
  MAX_WALK_MINUTES,
  minutesBetween,
  parseTimeOfDay,
  shiftMinutes,
  updateEvent,
  walkedMinutes,
  type DaySummary,
  type EventKind,
  type PetEventRow,
} from "../../lib/events";
import { getMyPet, type PetRow } from "../../lib/pets";
import { useSettings, type DurationFormat } from "../../lib/settings";

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
    /**
     * The detail line under an entry in the list.
     *
     * Takes the duration format because this is the *reading* side: a walk's
     * length is written the way the tutor asked for in Ajustes. The fields
     * that take a duration are unaffected — `parseDuration` accepts both.
     */
    describe: (event: PetEventRow, format: DurationFormat) => string | null;
  }
> = {
  walk: {
    label: "Paseo",
    action: "Añadir paseo",
    editAction: "Editar paseo",
    icon: Footprints,
    describe: (event, format) =>
      event.duration_minutes
        ? formatDuration(event.duration_minutes, format)
        : null,
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

/** The same clock time, `by` days away. */
function shiftDays(day: Date, by: number): Date {
  const next = new Date(day);
  next.setDate(next.getDate() + by);
  return next;
}

/** The one free-text specific each kind but the walk keeps in `details`. */
function detail(event: PetEventRow, key: string): string | null {
  const details = event.details as Record<string, unknown> | null;
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : null;
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
  const { settings } = useSettings();
  /**
   * The day on screen, and the boundary it cannot pass.
   *
   * `today` is captured once: a session that crosses midnight keeps calling
   * the day it started on "Hoy", which is wrong for about as long as it takes
   * to notice and is cheaper than a ticking clock.
   */
  const [today] = useState(() => new Date());
  const [day, setDay] = useState(() => new Date());
  const [picking, setPicking] = useState(false);
  /** One month of marks for the calendar, fetched only once it is opened. */
  const [marks, setMarks] = useState<Map<string, DaySummary>>(new Map());
  const [marksMonth, setMarksMonth] = useState(() => new Date());
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

  // Lazily, and only while the calendar is open: a month of rows is cheap but
  // it is not free, and most visits to the diary never open it.
  useEffect(() => {
    if (!picking || !pet) return;
    let cancelled = false;
    eventsForMonth(pet.id, marksMonth).then(({ days }) => {
      // A failed month read costs the marks, not the picker: the calendar
      // still navigates, it just stops saying what happened.
      if (!cancelled) setMarks(days);
    });
    return () => {
      cancelled = true;
    };
  }, [picking, pet, marksMonth, attempt]);

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
  const isToday = daysAgo(day, today) === 0;
  const headline = formatDayHeadline(day, today);

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
      {/* **The header is the control.** It was a title; navigating between
          days is the one thing this screen could not do, and the date is
          where a person reaches for it. Two lines still, so the rhythm holds:
          the headline names the day the way somebody would say it, the line
          below gives the date. */}
      <View className="mb-8 flex-row items-center justify-between">
        <DayStep
          testID="home-prev-day"
          icon={ChevronLeft}
          label="Día anterior"
          onPress={() => setDay((d) => shiftDays(d, -1))}
        />

        <Pressable
          testID="home-day"
          onPress={() => {
            setMarksMonth(day);
            setPicking(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${headline}, ${formatDayDate(day)}. Elegir otro día`}
          style={{ minHeight: TOUCH_TARGET }}
          className="flex-1 items-center justify-center active:opacity-70"
        >
          <Text
            testID="home-title"
            accessibilityRole="header"
            className="text-2xl text-text-primary"
          >
            {headline}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text testID="home-date" className="text-text-tertiary">
              {formatDayDate(day)}
            </Text>
            <CalendarDays size={14} color={colors.textMuted} />
          </View>
        </Pressable>

        {/* No future: there is nothing to log about a day that has not
            happened, so the forward step stops at today rather than offering
            an empty screen. */}
        <DayStep
          testID="home-next-day"
          icon={ChevronRight}
          label="Día siguiente"
          disabled={isToday}
          onPress={() => setDay((d) => shiftDays(d, 1))}
        />
      </View>

      {goal !== null ? (
        <View testID="home-goal" className="mb-8">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="font-semibold text-text-primary">
              {`${formatDuration(walked, settings.durationFormat)} de ${formatDuration(goal, settings.durationFormat)} paseados`}
            </Text>
            {met ? (
              <Text className="font-semibold text-xs text-success">
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
          {/* A past day is not still going, so it cannot say "todavía". */}
          <Text className="mb-2 font-semibold text-text-primary">
            {isToday
              ? "Todavía no hay nada registrado"
              : "Ese día no se apuntó nada"}
          </Text>
          <Text className="mb-5 text-text-tertiary">
            {isToday
              ? `Cuando salgáis a pasear o ${pet.name} coma, apúntalo aquí y no se pierde.`
              : "Puedes apuntarlo ahora: se guarda en ese día, no en hoy."}
          </Text>
        </Group>
      ) : (
        <Group
          testID="home-log"
          // "de hoy" only when it is: the header already names the day, and a
          // title reading "hoy" over Tuesday's entries contradicts it.
          title={isToday ? "Registro de hoy" : "Registro"}
        >
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

      {picking ? (
        <Sheet
          anchor="top"
          onClose={() => setPicking(false)}
          testID="home-calendar"
          scrimTestID="home-calendar-scrim"
        >
          <MonthCalendar
            marks={marks}
            goalMinutes={goal}
            value={day}
            maxDate={today}
            goalLabel={
              goal === null
                ? null
                : formatDuration(goal, settings.durationFormat)
            }
            onMonthChange={setMarksMonth}
            onSelect={(picked) => {
              setDay(picked);
              setPicking(false);
            }}
          />
        </Sheet>
      ) : null}

      {editing ? (
        <EntrySheet
          kind={editing.kind}
          event={editing.event}
          day={day}
          dayLabel={isToday ? null : `${headline}, ${formatDayDate(day)}`}
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
  const { settings } = useSettings();
  const spec = KINDS[event.kind as EventKind];
  // The reading side, so both formats are the tutor's. The sheet below keeps
  // 24-hour times, because that is the only form a number pad can express.
  const time = formatTimeOfDay(
    new Date(event.occurred_at),
    settings.timeFormat,
  );
  const described = spec?.describe(event, settings.durationFormat);
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
      style={{ minHeight: TOUCH_TARGET }}
      className="mb-5 flex-row items-start gap-3 active:opacity-70"
    >
      {/* **Sized to its content, not to a number.** A fixed 80dp was measured
          wrong in both directions: 27dp of slack for "09:00" and too narrow
          for "12:05 p.m." at font_scale 1.3, where five characters already
          take 53dp. Sizing to the content keeps every row in one format
          aligned — 24-hour times are all five characters — and grows with the
          font scale for free. The cost is a character of rag in 12-hour mode,
          between "9:15 a.m." and "12:05 p.m.", which is cheaper than a
          clipped time. */}
      <View className="shrink-0 items-start gap-1">
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
 * **The time that is prefilled is the one the tutor is standing in: HASTA.**
 * The entry happens after getting home, so "now" is when the walk *ended*, not
 * when it began — the first version had it the other way round and was quietly
 * asking the tutor to correct the one field it had filled in. So HASTA opens on
 * the current time and DESDE opens empty.
 *
 * **DESDE and HASTA are the facts; DURACIÓN is derived.** Editing either time
 * recomputes the duration. The duration stays editable, and **it works
 * backwards from HASTA**: typing it, or tapping -15 / +15, moves DESDE. That
 * is the mirror of the earlier rule and follows from the same premise — the
 * field the tutor is sure of must never shift under them, and now that is the
 * end.
 *
 * Nothing else is proposed. A prefilled thirty minutes would be a fabricated
 * walk one careless tap away, and **a walk with only an end time is a valid
 * entry**: it still happened, and `occurred_at` takes the end, which is the
 * only time anybody wrote down.
 *
 * **Delete lives here, not in the list**, and asks once in place. A row in a
 * scrolling list is a mis-tap waiting to happen; a modal on top of a modal is
 * worse on Android than the question it would ask.
 */
function EntrySheet({
  kind,
  event,
  day,
  dayLabel,
  petId,
  onClose,
  onSaved,
  onFailed,
}: {
  kind: EventKind;
  /** The entry being corrected, or null when this is a new one. */
  event: PetEventRow | null;
  day: Date;
  /**
   * Which day this writes to, when it is not today.
   *
   * Said out loud rather than assumed: the same sheet, opened from a day three
   * back, saves three days back — and a form that looks identical whichever
   * day it lands on is a form that will land on the wrong one. No validation
   * changed for this: every time check compares an instant against the real
   * now, so any hour of a past day is already in the past and today's future
   * is still refused.
   */
  dayLabel: string | null;
  petId: string;
  onClose: () => void;
  onSaved: () => void;
  onFailed: (message: string) => void;
}) {
  const spec = KINDS[kind];
  const isWalk = kind === "walk";
  const { settings } = useSettings();
  const durationFormat = settings.durationFormat;

  const occurred = event ? new Date(event.occurred_at) : null;
  const storedMinutes = event?.duration_minutes ?? null;

  /**
   * The anchor: a walk's HASTA, and every other kind's only time.
   *
   * A stored walk keeps its start in `occurred_at`, so reopening one adds the
   * duration back on to recover the end it was entered from.
   */
  const [at, setAt] = useState(() =>
    formatTimeOfDay(
      occurred && storedMinutes
        ? shiftMinutes(occurred, storedMinutes)
        : (occurred ?? new Date()),
    ),
  );
  /** A walk's start. Empty means nobody wrote it down. */
  const [from, setFrom] = useState(() =>
    occurred && storedMinutes ? formatTimeOfDay(occurred) : "",
  );
  /** What the duration field shows while it is being typed into. */
  const [durationText, setDurationText] = useState(() =>
    storedMinutes ? formatDuration(storedMinutes, durationFormat) : "",
  );
  const [value, setValue] = useState(
    () => (event && detail(event, "what")) || "",
  );
  const [note, setNote] = useState(() => event?.note ?? "");
  const [atError, setAtError] = useState<string | null>(null);
  const [fromError, setFromError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const parsedAt = parseTimeOfDay(at, day);
  const parsedFrom = from.trim() ? parseTimeOfDay(from, day) : null;
  const minutes =
    parsedFrom && parsedAt ? (minutesBetween(parsedFrom, parsedAt) ?? 0) : 0;

  /** Recomputes the display of the derived field. Never writes into a time. */
  const showDuration = useCallback(
    (fromText: string, atText: string) => {
      const start = fromText.trim() ? parseTimeOfDay(fromText, day) : null;
      const end = parseTimeOfDay(atText, day);
      if (!start || !end) return setDurationText("");
      const total = minutesBetween(start, end);
      setDurationText(
        total === null ? "" : formatDuration(total, durationFormat),
      );
    },
    [day, durationFormat],
  );

  const editAt = useCallback(
    (text: string) => {
      setAt(text);
      showDuration(from, text);
    },
    [showDuration, from],
  );

  const editFrom = useCallback(
    (text: string) => {
      setFrom(text);
      showDuration(text, at);
    },
    [showDuration, at],
  );

  /**
   * Tidies a time once focus leaves: "900" becomes "09:00".
   *
   * **On blur, and only on blur.** The number pad has no colon, so the field
   * has to take `900` — and inserting the colon as the digits arrive does not
   * work: a focused `TextInput` on Android ignores a value JS rewrites, so
   * `9000` stayed `9000` on the device while the browser showed `90:00`. This
   * is the correction the platform does honour.
   */
  const tidyTime = useCallback(
    (text: string, set: (value: string) => void) => {
      const parsed = parseTimeOfDay(text, day);
      if (parsed) set(formatTimeOfDay(parsed));
    },
    [day],
  );

  /**
   * The one direction that writes into a time, and it counts backwards from
   * the end — which is the time the tutor actually knows.
   *
   * **A duration longer than a day is refused here, not on save.** Counting
   * back from the end would put DESDE on a previous day and render it as a
   * plausible time of day, so the entry would look ordinary and be nonsense;
   * `logEvent` would then reject it into a toast, which is the wrong place for
   * a message about one field. Nothing moves and the field says why.
   */
  const applyMinutes = useCallback(
    (total: number) => {
      if (total <= 0) {
        setDurationError(null);
        setFrom("");
        setDurationText("");
        return;
      }
      if (total > MAX_WALK_MINUTES) {
        setDurationError("Como mucho 24 horas");
        return;
      }
      setDurationError(null);
      setDurationText(formatDuration(total, durationFormat));
      const end = parseTimeOfDay(at, day);
      if (end) setFrom(formatTimeOfDay(shiftMinutes(end, -total)));
    },
    [at, day, durationFormat],
  );

  /**
   * Typing is left alone until it parses, and tidied on blur: reformatting on
   * every keystroke would fight the typist, which is what a controlled field
   * that normalises too eagerly always does.
   */
  const editDuration = useCallback(
    (text: string) => {
      setDurationText(text);
      if (!text.trim()) {
        setDurationError(null);
        setFrom("");
        return;
      }
      const total = parseDuration(text);
      // Not a duration *yet* — mid-typing — is not an error to report.
      if (total === null || total <= 0) return;
      if (total > MAX_WALK_MINUTES) {
        setDurationError("Como mucho 24 horas");
        return;
      }
      setDurationError(null);
      const end = parseTimeOfDay(at, day);
      if (end) setFrom(formatTimeOfDay(shiftMinutes(end, -total)));
    },
    [at, day],
  );

  /** Blurring discards a refused duration: the times are the truth. */
  const tidyDuration = useCallback(() => {
    setDurationError(null);
    showDuration(from, at);
  }, [showDuration, from, at]);

  const save = useCallback(async () => {
    const end = parseTimeOfDay(at, day);
    if (!end) {
      setAtError("Escríbela como 09:15");
      return false;
    }
    if (end.getTime() > Date.now() + 60_000) {
      setAtError(
        isWalk ? "¿Todavía no habéis vuelto?" : "¿Todavía no ha pasado?",
      );
      return false;
    }
    setAtError(null);

    let occurredAt = end;
    let walkMinutes: number | null = null;

    if (isWalk && from.trim()) {
      const start = parseTimeOfDay(from, day);
      if (!start) {
        setFromError("Escríbela como 09:15");
        return false;
      }
      walkMinutes = minutesBetween(start, end);
      if (walkMinutes === null) {
        setFromError("Tiene que ser antes de la hora de vuelta");
        return false;
      }
      occurredAt = start;
    }
    setFromError(null);

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
    at,
    from,
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
    <Sheet onClose={onClose} scrimTestID="entry-scrim">
      <>
        <Text
          testID="entry-title"
          accessibilityRole="header"
          className="mb-5 font-bold text-xl text-text-primary"
        >
          {event ? spec.editAction : spec.action}
        </Text>
        {dayLabel ? (
          <Text testID="entry-day" className="-mt-3 mb-5 text-text-tertiary">
            {dayLabel}
          </Text>
        ) : null}

        {isWalk ? (
          <>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  testID="entry-from"
                  label="Desde"
                  value={from}
                  onChangeText={editFrom}
                  onBlur={() => tidyTime(from, setFrom)}
                  placeholder="09:15"
                  error={fromError}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
              <View className="flex-1">
                <TextField
                  testID="entry-to"
                  label="Hasta"
                  value={at}
                  onChangeText={editAt}
                  onBlur={() => tidyTime(at, setAt)}
                  placeholder="09:45"
                  error={atError}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>

            {/* The steppers sit hard right, nearest the thumb, and the field
                  takes only the width its value needs. They used to sit beside
                  it and the unit landed underneath them. */}
            <View className="mb-5 flex-row items-end justify-between">
              <View style={{ width: 140 }}>
                <TextField
                  testID="entry-duration"
                  label="Duración"
                  value={durationText}
                  onChangeText={editDuration}
                  onBlur={tidyDuration}
                  placeholder="30 min"
                  // A number pad, even though the field shows "1h 30m":
                  // bare minutes always parse, so nothing here needs a
                  // letter, and raising the alphabetic keyboard for a
                  // digits-first task is the defect AGENTS.md names. The
                  // readable form is what the field gives back, not what it
                  // demands.
                  error={durationError}
                  keyboardType="number-pad"
                  maxLength={10}
                  className=""
                />
              </View>
              <View className="flex-row gap-3">
                <Step
                  testID="entry-duration-minus"
                  label={`-${STEP_MINUTES}`}
                  accessibilityLabel={`Quitar ${STEP_MINUTES} minutos`}
                  disabled={minutes <= STEP_MINUTES}
                  onPress={() => applyMinutes(minutes - STEP_MINUTES)}
                />
                <Step
                  testID="entry-duration-plus"
                  label={`+${STEP_MINUTES}`}
                  accessibilityLabel={`Añadir ${STEP_MINUTES} minutos`}
                  disabled={minutes + STEP_MINUTES > MAX_WALK_MINUTES}
                  onPress={() => applyMinutes(minutes + STEP_MINUTES)}
                />
              </View>
            </View>
          </>
        ) : (
          <TextField
            testID="entry-time"
            label="Hora"
            value={at}
            onChangeText={editAt}
            onBlur={() => tidyTime(at, setAt)}
            placeholder="09:15"
            error={atError}
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
            style={{ minHeight: TOUCH_TARGET }}
            className="flex-1 items-center justify-center rounded-xl border border-border-strong py-4 active:opacity-70"
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
      </>
    </Sheet>
  );
}

/**
 * One day back or forward.
 *
 * Icon-only, so the name is spoken rather than shown — and disabled rather
 * than hidden on today: a control that disappears takes its own explanation
 * with it, and "there is no tomorrow yet" is worth leaving visible.
 */
function DayStep({
  testID,
  icon: Icon,
  label,
  disabled = false,
  onPress,
}: {
  testID: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
      className="items-center justify-center rounded-xl active:opacity-70"
    >
      <Icon
        size={24}
        strokeWidth={2.5}
        color={disabled ? colors.textMuted : colors.textSecondary}
      />
    </Pressable>
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
      style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
      className="items-center justify-center rounded-xl border border-border-strong pr-3 pl-3 active:opacity-70"
    >
      {/* `text-tertiary` when disabled, not `text-muted`: the same choice the
          disabled button made, and 6.64:1 rather than 3.58:1 on this fill. */}
      <Text
        className={
          disabled ? "text-text-tertiary" : "font-semibold text-text-secondary"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
