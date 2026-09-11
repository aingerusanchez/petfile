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
import { AppState, Pressable, View } from "react-native";
import {
  Button,
  colors,
  Fab,
  FAB_CLEARANCE,
  Group,
  LoadingScreen,
  LogSkeleton,
  MonthCalendar,
  Screen,
  Sheet,
  Skeleton,
  Text,
  TextField,
  TOUCH_TARGET,
  useCelebration,
  useToast,
} from "../../components/ui";
import {
  birthdayMilestone,
  markCelebrated,
  wasCelebrated,
} from "../../lib/celebrated";
import {
  birthdayOn,
  daysAgo,
  formatDayDate,
  formatDayHeadline,
} from "../../lib/dates";
import { formatDuration, parseDuration } from "../../lib/duration";
import {
  deleteEvent,
  dayKey,
  eventsForDay,
  eventsForMonths,
  formatTimeOfDay,
  logEvent,
  MAX_WALK_MINUTES,
  minutesBetween,
  parseTimeOfDay,
  shiftMinutes,
  startWithinDay,
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
     * The icon's colour in the log, where the calendar marks that day in the
     * same one. Absent for the two everyday kinds, which stay in the
     * column's own tone — see `Entry`.
     */
    tone?: string;
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
    tone: colors.warning,
    field: { label: "Qué le habéis dado", placeholder: "Apoquel, media" },
    describe: (event) => detail(event, "what"),
  },
  incident: {
    label: "Incidencia",
    action: "Añadir incidencia",
    editAction: "Editar incidencia",
    icon: TriangleAlert,
    tone: colors.error,
    field: { label: "Qué ha pasado", placeholder: "Cojea de la pata derecha" },
    describe: (event) => detail(event, "what"),
  },
};

const ORDER: EventKind[] = ["walk", "meal", "medication", "incident"];

/** How much a tap on -15 or +15 moves a walk's duration. */
const STEP_MINUTES = 15;

/**
 * How far back the calendar's marks reach, in whole months.
 *
 * One request covers the lot — see `monthsBackBounds`. A year is past any
 * "which day did he have diarrhoea?" anybody asks, and past its edge the
 * marks stop rather than lying, which the calendar says in words.
 */
const MARKED_MONTHS = 12;

/**
 * The clock time `total` minutes before `at` — or "" when that leaves the day.
 *
 * DESDE holds a time of day with no date, so a start on the previous day comes
 * back as that same clock time on the day on screen, which is *after* the end.
 * Rather than write a time that means the wrong thing, the field goes empty
 * and the duration carries the walk on its own. See `applyMinutes`.
 */
function startOnDay(atText: string, day: Date, total: number): string {
  const end = parseTimeOfDay(atText, day);
  if (!end) return "";
  const start = startWithinDay(end, total);
  return start ? formatTimeOfDay(start) : "";
}

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
 * **The goal bar fills in a light neutral, and turns Aqua Glaciar when the
 * goal is met.** Three versions got here. Steel Frost was first, on the
 * reasoning that progress is state rather than an action — but a 4px hairline
 * in a border colour measured 1.64:1 against its own track and did not read as
 * a measure of anything. Then it was Aqua Glaciar filling and Success Green on
 * completion, which read well and put green on eighteen days of a month in the
 * calendar's miniature of it: enough to become the calendar's background
 * colour rather than its exception.
 *
 * So the two states are the same **weight** and differ only in **hue** — Mist
 * Light 11.48:1 and Aqua Glaciar 10.03:1 on the bar's Fjord Slate track — and
 * the hue is the whole message: the measure is neutral while it is being read,
 * and the secondary accent is the conclusion. Ice Blue Glacial stays out of it,
 * so the primary accent still means "this is the one thing to do here", and on
 * this screen the one thing is the floating action. Success Green keeps the
 * meaning it has everywhere else — a toast, the confetti — which is a **moment
 * that just happened**, never a state sitting on the screen.
 */
export default function Home() {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const { settings } = useSettings();
  /**
   * The day on screen, and the boundary it cannot pass.
   *
   * **Re-read whenever the app comes back to the foreground**, because it used
   * to be captured once and that is not "wrong until somebody notices" — it is
   * wrong with no way out. `today` caps the forward arrow and the calendar's
   * `maxDate`, so a session opened at 22:00 and reopened at 00:10 called
   * yesterday "Hoy" and could not reach the real day at all without killing
   * the app. The goal confetti would not fire either, on the one walk of the
   * night that earned it.
   *
   * A foreground check rather than a ticking clock: a phone asleep in a pocket
   * does not need a timer, and the moment that matters is the one where
   * somebody picks it up.
   */
  const [today, setToday] = useState(() => new Date());
  const [day, setDay] = useState(() => new Date());
  const [picking, setPicking] = useState(false);
  /** One month of marks for the calendar, fetched only once it is opened. */
  const [marks, setMarks] = useState<Map<string, DaySummary>>(new Map());
  const [marksError, setMarksError] = useState<string | null>(null);
  const [pet, setPet] = useState<PetRow | null>(null);
  /**
   * The log, **and the day it belongs to**.
   *
   * Carrying the key is what lets the screen know its rows are stale without
   * a second flag: `log.day !== dayKey(day)` is derived, and derived is what
   * `react-hooks/set-state-in-effect` asks for. Before this the rows simply
   * stayed put while the header changed, so tapping ‹ showed "Ayer" over
   * today's four entries for as long as the network took — a tutor checking
   * "did he walk yesterday?" got a confident yes.
   */
  const [log, setLog] = useState<{ day: string; events: PetEventRow[] } | null>(
    null,
  );
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
      setLog({ day: dayKey(day), events: rows ?? [] });
    });

    return () => {
      cancelled = true;
    };
  }, [day, attempt]);

  /**
   * Lazily, and only while the calendar is open: most visits to the diary
   * never open it.
   *
   * **A window rather than the month on screen**, because the library's
   * header arrows move the month without telling anybody — see
   * `monthsBackBounds`. A year of one dog's entries is one cheap request, and
   * it means paging back says what happened instead of asserting that nothing
   * did.
   *
   * A failed read is kept and said out loud: an empty map and a clean grid are
   * indistinguishable, and a calendar quietly reporting a month of nothing is
   * worse than one admitting it could not look.
   */
  useEffect(() => {
    if (!picking || !pet) return;
    let cancelled = false;
    // The reset lands with the result rather than before the request: a
    // synchronous setState in an effect body is the cascading render
    // `react-hooks/set-state-in-effect` exists to stop.
    eventsForMonths(pet.id, today, MARKED_MONTHS).then(({ days, error }) => {
      if (cancelled) return;
      setMarks(days);
      setMarksError(error);
    });
    return () => {
      cancelled = true;
    };
  }, [picking, pet, today, attempt]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const now = new Date();
      // Only when the date actually turned: a `setToday` on every foreground
      // would refetch the day for nothing.
      if (daysAgo(now, today) === 0) return;
      setToday(now);
      // **The day on screen follows only if it was the old today.** Somebody
      // who left the app reading Tuesday comes back to Tuesday; dragging them
      // to the new day would lose their place to fix a boundary they were not
      // standing on.
      if (daysAgo(day, today) === 0) setDay(now);
    });
    return () => sub.remove();
  }, [today, day]);

  const reload = useCallback(() => {
    setPetError(null);
    setLogError(null);
    setAttempt((n) => n + 1);
  }, []);

  // Hoisted above the early returns, because the birthday effect below is a
  // hook and cannot sit after them. `birthdayOn` takes a null birth date, so
  // this is safe before the pet has loaded.
  const isToday = daysAgo(day, today) === 0;
  const birthdayYears = birthdayOn(day, pet?.birth_date ?? null);
  const petId = pet?.id ?? null;

  /**
   * **The birthday gets the confetti, once a year, on the day itself.**
   *
   * The same rule the goal's confetti follows: it fires on a threshold being
   * crossed, and a year is a threshold. Navigating back to a past birthday is
   * bookkeeping and gets nothing, which is why this asks for `isToday`; and
   * the year it has already fired for is remembered on the device, so opening
   * the app twice on the same birthday is not two parties.
   *
   * Year 0 is the day the animal was born, which the header names but does
   * not celebrate — there is no year to have crossed yet.
   */
  useEffect(() => {
    if (!petId || !isToday || birthdayYears === null || birthdayYears < 1) {
      return;
    }
    const milestone = birthdayMilestone(petId, day.getFullYear());
    let cancelled = false;
    wasCelebrated(milestone).then((already) => {
      if (cancelled || already) return;
      void markCelebrated(milestone);
      celebrate();
    });
    return () => {
      cancelled = true;
    };
  }, [petId, isToday, birthdayYears, day, celebrate]);

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

  // Only the pet is fatal to the whole screen: without it there is no day to
  // show. The log has its own waiting state below, inside the shape it will
  // fill, so the header a tutor just used stays under their thumb.
  if (!pet) return <LoadingScreen />;

  const loading = log === null || log.day !== dayKey(day);
  const events = loading ? [] : log.events;
  const walked = walkedMinutes(events);
  const goal = pet.exercise_goal_minutes;
  const met = goal !== null && walked >= goal;
  /**
   * **The birthday takes the headline over "Hoy" or the weekday.**
   *
   * Once a year the day has a name worth more than the one it would otherwise
   * carry, and nothing is lost: the line underneath still gives the date, and
   * the log's own title still says whether it is today. On the day the animal
   * was actually born there is no birthday yet, so it says that instead.
   */
  const headline =
    birthdayYears === null
      ? formatDayHeadline(day, today)
      : birthdayYears === 0
        ? `${pet.name} nació este día`
        : `Cumpleaños de ${pet.name}`;
  /**
   * **The emoji is ornament, so it is shown and not spoken.**
   *
   * Same split the onboarding headline and the activity hint already make: a
   * reader announcing "tarta de cumpleaños, cara de fiesta" describes the
   * decoration instead of the day. It also sidesteps The No-Glyph Rule rather
   * than breaking it — the rule bans a character standing in for an *icon*,
   * and nothing here depends on these two: strip them and the headline still
   * says everything.
   */
  const headlineShown =
    birthdayYears !== null && birthdayYears > 0
      ? `🎂 ${headline} 🎉`
      : headline;

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
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`${headline}, ${formatDayDate(day)}. Elegir otro día`}
          style={{ minHeight: TOUCH_TARGET }}
          className="flex-1 items-center justify-center active:opacity-70"
        >
          {/* **The ornament is in the string, not beside it.** A separate
              icon plus its gap took the phrase past the width between the two
              arrows and broke the exact line it decorated; inside the text it
              is just two more characters, and `text-balance` gets to split
              the whole thing evenly rather than leaving one word alone on the
              second line.

              **Two lines is the ceiling, measured in pixels rather than
              characters.** "Cumpleaños de Silver Odinsonn" is a real name and
              a real two-liner, and a longer one truncates at the end of the
              second line instead of reaching a third — which is the right
              limit, because a character cap would cut the same name on a
              phone where it fitted. `text-balance` is dropped by the native
              compiler (see AvatarEditor), so on the device the split is
              whatever the line breaker does; on the web it is even. */}
          <Text
            testID="home-title"
            accessibilityRole="header"
            accessibilityLabel={headline}
            numberOfLines={2}
            className="text-center text-2xl text-balance text-text-primary"
          >
            {headlineShown}
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

      {/* **The measure waits in its own shape too.** Leaving the previous
          day's "2h 30m de 3h paseados" over a header that already says "Ayer"
          is the same lie the log used to tell, in fewer words and larger
          type. */}
      {goal !== null && loading ? (
        <View testID="home-goal-skeleton" className="mb-8">
          <View className="mb-2">
            <Skeleton width="58%" height={16} />
          </View>
          <Skeleton width="100%" height={4} />
        </View>
      ) : null}

      {goal !== null && !loading ? (
        <View testID="home-goal" className="mb-8">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="font-semibold text-text-primary">
              {`${formatDuration(walked, settings.durationFormat)} de ${formatDuration(goal, settings.durationFormat)} paseados`}
            </Text>
            {met ? (
              <Text className="font-semibold text-xs text-accent-secondary">
                Objetivo conseguido
              </Text>
            ) : null}
          </View>
          {/* A bar, not a ring: the question is "how much of the day's target
              is done", which is one dimension. */}
          {/* `h-[4px]`, not `h-1`. The calendar draws this same bar in
              miniature and sizes it in literal pixels; `h-1` is 0.25rem,
              which native resolves at 14px/rem to 3.38dp — measured, against
              the calendar's 4.00. Two surfaces quoting one element cannot
              round differently. */}
          <View className="h-[4px] overflow-hidden rounded-xl bg-surface">
            <View
              testID="home-goal-bar"
              style={{
                width: `${Math.min(100, goal === 0 ? 0 : (walked / goal) * 100)}%`,
              }}
              className={`h-[4px] ${met ? "bg-accent-secondary" : "bg-text-secondary"}`}
            />
          </View>
        </View>
      ) : null}

      {/* The log's own waiting state, in the slots the rows will fill: see
          `LogSkeleton`. The title is the real word, because it is true before
          the rows land. */}
      {loading ? (
        <Group testID="home-log-skeleton" title="Registro">
          <LogSkeleton />
        </Group>
      ) : logError ? (
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
          {/* A past day is not still going, so it cannot say "todavía" — and
              on a birthday the emptiest moment of the day is the one worth
              saying something warm in. */}
          <Text className="mb-2 font-semibold text-text-primary">
            {birthdayYears !== null && birthdayYears > 0
              ? `${pet.name} cumple ${birthdayYears} ${birthdayYears === 1 ? "año" : "años"}`
              : isToday
                ? "Todavía no hay nada registrado"
                : "Ese día no se apuntó nada"}
          </Text>
          <Text className="mb-5 text-balance text-text-tertiary">
            {birthdayYears !== null && birthdayYears > 0
              ? isToday
                ? "Nada registrado aún. ¿Un paseo por la playa 🏖️ o montaña ⛰️ para celebrarlo?"
                : "No hay registros de este día."
              : isToday
                ? `Cuando salgáis a pasear o ${pet.name} coma, apúntalo aquí y lo recordaré.`
                : "Aún puedes registrar actividades para este día."}
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
            birthDate={pet.birth_date}
            error={marksError}
            onSelect={(picked) => {
              setDay(picked);
              setPicking(false);
            }}
            onToday={() => {
              setDay(today);
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
          onSaved={(walkMinutes) => {
            // **The goal is a threshold, and this is the entry that crossed
            // it.** Now that the bar no longer flashes green, the moment it
            // is reached has nothing to mark it, and a bar quietly changing
            // hue is not a moment. So the confetti — which used to fire once
            // in an account's life, on registering the animal — fires again
            // here, at most once a day.
            //
            // The arithmetic is exact rather than a re-sum: `walked` already
            // counts the entry being edited, so its old minutes come out
            // before the new ones go in. A non-walk contributes null on both
            // sides and cannot cross anything. `!met` is what keeps a second
            // walk on an already-finished day quiet.
            //
            // **Only on the day you are in.** Backfilling a forgotten
            // Tuesday is bookkeeping, and a week of catch-up entries firing
            // a week of confetti would be a party for paperwork. The cost is
            // a walk logged after midnight, which lands on "Ayer" and gets
            // nothing; that is the narrower mistake of the two.
            const crossed =
              isToday &&
              goal !== null &&
              goal > 0 &&
              !met &&
              walked -
                (editing.event?.duration_minutes ?? 0) +
                (walkMinutes ?? 0) >=
                goal;

            setEditing(null);
            setAttempt((n) => n + 1);
            if (crossed) celebrate();
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
          // **The two rare kinds wear the colour the calendar marks them in.**
          // Nothing tied a red dot on the 9th to the row that put it there:
          // the calendar spoke in dots and rings, the log in glyphs and words,
          // and the only shared mark was the goal bar. The mark cannot carry a
          // 6px glyph, so colour is the channel that fits — amber is
          // medication and red is an incident on both surfaces, and the
          // legend's words are the row's own label.
          //
          // A walk and a meal stay in the column's tone. They are as common
          // here as they are on the calendar, where they get no hue either,
          // and four coloured rows would leave the two that matter competing.
          // The icon is decorative in the accessibility tree — the row names
          // its kind in text — so no meaning rests on the colour alone.
          <Icon
            size={18}
            strokeWidth={2}
            color={spec?.tone ?? colors.textTertiary}
          />
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
  /** Reports the walk's minutes, so the day can tell whether it just won. */
  onSaved: (walkMinutes: number | null) => void;
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
  // With no DESDE the duration is the fact rather than a derivation of it, so
  // the steppers count from the field instead of from the two times.
  const minutes =
    parsedFrom && parsedAt
      ? (minutesBetween(parsedFrom, parsedAt) ?? 0)
      : (parseDuration(durationText) ?? 0);

  /** Recomputes the display of the derived field. Never writes into a time. */
  const showDuration = useCallback(
    (fromText: string, atText: string) => {
      // **A DESDE that does not parse is not a reason to throw the duration
      // away** — the same rule the duration field already applies to itself:
      // not a time *yet* is mid-typing, not an error. It is also the only
      // rule that survives a real keyboard. Deleting "10:48" on Android fires
      // one change per key, so the field passes through "10:" and "1" on its
      // way to empty, and clearing on each of those wiped a duration that the
      // final empty string was then careful to preserve. The web hid it
      // completely: `fill("")` is a single event.
      //
      // With nothing in DESDE the duration is the fact rather than a reading
      // of two times, which is what lets a walk be an end plus a length —
      // see `applyMinutes`.
      const start = fromText.trim() ? parseTimeOfDay(fromText, day) : null;
      const end = parseTimeOfDay(atText, day);
      if (!start || !end) return;
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
   *
   * ---
   *
   * **A start that reaches back past midnight is not written into DESDE.**
   *
   * `from` is a time of day with no date: `formatTimeOfDay` keeps only HH:MM,
   * and `parseTimeOfDay(from, day)` puts it back on the day on screen. So a
   * start computed on the *previous* day came back as that clock time today —
   * after the end rather than before it. Stepping +15 three times on a walk
   * ending at 00:20 gave "45 min" with DESDE at 23:35, and then blurring
   * emptied the duration while Guardar blamed DESDE for a value the tutor had
   * never typed.
   *
   * The answer is not to make DESDE hold a date. It is that **a walk is
   * allowed to be an end plus a length**: the tutor knows they got home at
   * 00:20 and were out about forty-five minutes, which is a complete fact, and
   * `pet_events.duration_minutes` is a real column rather than something
   * derived from the two times. So when the start falls outside the day, the
   * duration stays and DESDE goes empty — the field is optional and says so —
   * and `save` takes the length from the duration field instead.
   *
   * It also serves the case PRODUCT.md wanted anyway: "unos cuarenta minutos"
   * is a real memory of a walk, and now it can be logged without inventing a
   * start time to go with it.
   *
   * What is still refused is a start the tutor **typed** after its end. That
   * is a different decision, recorded in DESIGN.md: a mistyped digit is
   * likelier than a walk across midnight, and guessing would file the entry
   * under a day nobody chose.
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
      setFrom(startOnDay(at, day, total));
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
      setFrom(startOnDay(at, day, total));
    },
    [at, day],
  );

  /**
   * Blurring discards a refused duration.
   *
   * **With DESDE there are two times to fall back on, and without it there are
   * not** — so the empty-start case has to tidy the field on its own rather
   * than re-derive it, or a refused "99h" would sit there with its error
   * cleared and be dropped in silence at save time. A valid value is kept and
   * normalised; anything else goes.
   */
  const tidyDuration = useCallback(() => {
    setDurationError(null);
    if (from.trim()) {
      showDuration(from, at);
      return;
    }
    const total = parseDuration(durationText);
    setDurationText(
      total !== null && total > 0 && total <= MAX_WALK_MINUTES
        ? formatDuration(total, durationFormat)
        : "",
    );
  }, [showDuration, from, at, durationText, durationFormat]);

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

    // A walk known only by its end and its length. Either the tutor never
    // wrote a start, or the one the steppers computed fell on the previous day
    // and could not be shown as a time — see `applyMinutes`.
    if (isWalk && !from.trim()) {
      const typed = parseDuration(durationText);
      // A duration out of range is refused here rather than dropped. **This
      // is the Android path and the web target cannot reach it**: clicking a
      // button there blurs the input first, so `tidyDuration` has already
      // thrown the value away by the time this runs, which is why there is no
      // e2e test for it. Tapping a Pressable on Android does not blur, so the
      // refused value arrives here — and saving the walk while quietly
      // discarding the only number the tutor typed is the worst of the three
      // options.
      if (durationText.trim() && (typed === null || typed <= 0)) {
        setDurationError("Escríbela como 45 min o 1h 30m");
        return false;
      }
      if (typed !== null && typed > MAX_WALK_MINUTES) {
        setDurationError("Como mucho 24 horas");
        return false;
      }
      walkMinutes = typed;
    }

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

    onSaved(walkMinutes);
    return true;
  }, [
    at,
    from,
    durationText,
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
    // A deletion never celebrates, whatever it does to the total.
    onSaved(null);
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
