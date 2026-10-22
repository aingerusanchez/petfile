import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import {
  Button,
  colors,
  ErrorNote,
  Fab,
  FAB_CLEARANCE,
  GoalBlock,
  Group,
  LoadingScreen,
  Markdown,
  MarkdownHelp,
  LogSkeleton,
  MonthCalendar,
  Screen,
  Sheet,
  Skeleton,
  StoolField,
  StoolMark,
  StoolToggle,
  Text,
  TextField,
  TimePicker,
  TOUCH_TARGET,
  TREATMENT_ICONS,
  useCelebration,
  useToast,
} from "../../components/ui";
import { NOTE_LIMIT } from "../../lib/limit";
import {
  birthdayMilestone,
  markCelebrated,
  wasCelebrated,
} from "../../lib/celebrated";
import {
  birthdayOn,
  daysAgo,
  parseISO,
  formatDayDate,
  formatDayHeadline,
} from "../../lib/dates";
import { type Walked, formatDuration, parseDuration } from "../../lib/duration";
import {
  dayKey,
  eventDetail,
  deleteEvent,
  closeWalk,
  endWithinDay,
  eventsForDay,
  eventsForMonths,
  formatTimeOfDay,
  logEvent,
  marksForMonths,
  marksWindowRows,
  MAX_WALK_MINUTES,
  minutesBetween,
  parseTimeOfDay,
  startWalk,
  updateEvent,
  walkCount,
  walkedMinutes,
  type EventKind,
  type PetEventRow,
} from "../../lib/events";
import { barProgress, barStateAt } from "../../lib/goalbar";
import { getMyPet, type PetRow } from "../../lib/pets";
import {
  describeTreatment,
  treatmentsFor,
  treatmentsOn,
  vaccineDays,
  type PetTreatmentRow,
  type TreatmentKind,
} from "../../lib/treatments";
import { useSettings, type DurationFormat } from "../../lib/settings";
import {
  enqueueStop,
  parsePending,
  serialisePending,
  PENDING_STORAGE_KEY,
  type PendingStop,
} from "../../lib/pending";
import {
  parseRunningWalk,
  serialiseRunningWalk,
  walkOutcome,
  WALK_STORAGE_KEY,
} from "../../lib/walk";
import {
  describeStools,
  readStools,
  writeStools,
  type Stools,
} from "../../lib/stools";

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
    describe: (event) => eventDetail(event, "what"),
  },
  medication: {
    label: "Medicación",
    action: "Añadir medicación",
    editAction: "Editar medicación",
    icon: Pill,
    tone: colors.warning,
    field: { label: "Qué le habéis dado", placeholder: "Apoquel, media" },
    describe: (event) => eventDetail(event, "what"),
  },
  incident: {
    label: "Incidencia",
    action: "Añadir incidencia",
    editAction: "Editar incidencia",
    icon: TriangleAlert,
    tone: colors.error,
    field: { label: "Qué ha pasado", placeholder: "Cojea de la pata derecha" },
    describe: (event) => eventDetail(event, "what"),
  },
};

const ORDER: EventKind[] = ["walk", "meal", "medication", "incident"];

/**
 * How far back the calendar's marks reach, in whole months.
 *
 * One request covers the lot — see `monthsBackBounds`. A year is past any
 * "which day did he have diarrhoea?" anybody asks, and past its edge the
 * marks stop rather than lying, which the calendar says in words.
 */
const MARKED_MONTHS = 12;

/** The same clock time, `by` days away. */
function shiftDays(day: Date, by: number): Date {
  const next = new Date(day);
  next.setDate(next.getDate() + by);
  return next;
}

/** The one free-text specific each kind but the walk keeps in `details`. */

/**
 * The rows of a day that has not loaded: one array for every render.
 *
 * A literal `[]` in the render body is a new object each time, and the effects
 * that read `events` would re-run on every render while the day waits.
 */
const NO_EVENTS: PetEventRow[] = [];
/** What the screen says when the account has no pet to show a day of. */
const NO_PET = "Todavía no hay ninguna mascota";

/**
 * Which tier of the goal a day's minutes have reached, on the bar's own
 * scale: 0 below the goal, 1 at it, 2 at double.
 *
 * **Read off `lib/goalbar.ts` rather than compared against a number worked
 * out here.** The bar, the calendar's miniature of it and the celebration all
 * have to agree about where a tier begins, and two surfaces computing that by
 * different arithmetic is exactly the defect this screen used to carry: a
 * `walked >= goal` beside a bar whose own ground came from `barStateAt`. A
 * wrong answer does not throw — it throws confetti at the wrong moment, or
 * withholds it at the right one.
 */
function tierReached(minutes: number, goalMinutes: number | null): 0 | 1 | 2 {
  const progress = barProgress(minutes, goalMinutes);
  return progress === null ? 0 : barStateAt(progress).tier;
}

/**
 * The tier that earns the confetti, and the only one: the top.
 *
 * **Tier 1 lost it on purpose.** The point of the two tiers is that reaching
 * the goal becomes the everyday — most days clear it — and the everyday is
 * not celebrated. Tier 1 keeps the ground turning Aqua, the label under the
 * bar and the calendar's underline; the party is kept for the day that
 * doubles it, which is the one worth marking on the calendar.
 */
const CELEBRATED_TIER = 2;

/** What the top tier's confetti is made of: the tier's own colour. */
const CELEBRATION_TONE = colors.accentFocus;

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
 * and the everyday accent is the conclusion. The scarce accent is not an action
 * on this bar — it is the tier above that conclusion — and the floating action
 * is still the one thing to do on this screen. Success Green keeps the
 * meaning it has everywhere else — a toast, the confetti — which is a **moment
 * that just happened**, never a state sitting on the screen.
 */
/** The local day a `?day=` parameter names, when it names one. */
function dayFromParam(value: string | string[] | undefined): Date | null {
  const parts = typeof value === "string" ? parseISO(value) : null;
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

export default function Home() {
  const router = useRouter();
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
  /**
   * The day on screen, which another screen may have asked for.
   *
   * **`?day=` exists so Salud can point at an illness.** The incidents are
   * written here and read there, and a list of them that could not lead back
   * to the day each one happened would be a list of dates you then have to go
   * and find.
   *
   * **Applied when it changes, not only at mount — measured on the device.**
   * Reading it in the `useState` initialiser looked right and did nothing at
   * all: this screen is a tab, so it is already mounted when Salud pushes, the
   * initialiser never runs again, and tapping an illness from December landed
   * on today. This is React's own "adjust state when an input changes" shape —
   * during render, against a remembered value — rather than an effect, which
   * is the derived-state mistake `react-hooks/set-state-in-effect` catches.
   *
   * It sets where to open and then lets go: the arrows and the calendar move
   * from there like any other day, and the parameter is not consulted again
   * until it changes.
   */
  const { day: askedFor } = useLocalSearchParams<{ day?: string }>();
  const [day, setDay] = useState(() => dayFromParam(askedFor) ?? new Date());
  const [appliedParam, setAppliedParam] = useState(askedFor);

  if (askedFor !== appliedParam) {
    setAppliedParam(askedFor);
    const asked = dayFromParam(askedFor);
    if (asked) setDay(asked);
  }
  const [picking, setPicking] = useState(false);
  /**
   * The year of entries the calendar draws its marks from, fetched only once
   * it is opened.
   *
   * **Rows, not a summary** — the summary also folds in the treatments, which
   * arrive on their own schedule. See `marksForMonths`.
   *
   * **Null until the window has answered**, and that is load-bearing rather
   * than tidiness: the treatments are usually already in hand when the
   * calendar opens, and an empty array here would have the grid draw every
   * treatment day as "logged, short of the goal" before it had read a single
   * walk. **A failed read leaves it null too** — see `marksWindowRows`.
   */
  const [markedEvents, setMarkedEvents] = useState<PetEventRow[] | null>(null);
  /**
   * Every treatment the pet has had, for the day's TRATAMIENTOS section and
   * the calendar.
   *
   * **The whole history, once, not one request per day.** There are a handful
   * a year and `treatmentsFor` is already the request Salud makes; asking for
   * a day at a time would be a round trip on every tap of ‹ for rows that
   * almost never exist. The day's treatments are filtered from it, and so are
   * the calendar's marks and its vaccine watermarks — one read feeding all
   * three, which is also why they cannot disagree.
   *
   * Null until the first answer, and the section stays absent until then:
   * nothing is drawn for a read that has not come back, and the log below
   * does not wait for it. A failed read draws nothing either, and keeps the
   * rows it had for the calendar: see `readTreatments`.
   */
  const [treatments, setTreatments] = useState<{
    rows: PetTreatmentRow[];
    error: string | null;
  } | null>(null);
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
  const [log, setLog] = useState<{
    day: string;
    /** The `attempt` this read answered, so a stale log can be told apart. */
    attempt: number;
    events: PetEventRow[];
    /**
     * Why this day could not be read, or null when it could.
     *
     * **Part of the log, not a second state beside it.** Whether the log holds
     * real rows for a day is one fact made of the day, the rows and this, and
     * three bugs in a row came from keeping a copy of it in a ref that was
     * updated at some of the places the log was written and not at others.
     * With the error inside the object there is one write, and the guard in
     * the pet effect reads the real thing.
     */
    error: string | null;
  } | null>(null);
  /**
   * Fatal: with no pet there is no day to show.
   *
   * **Only while there is nothing on screen.** A failed *action* is not a
   * failed *navigation*: a walk that cannot be saved offline bumps `attempt`,
   * the refetch includes the pet read, and that fails offline too — about
   * seven seconds later, after the pet read's own retries, which used to
   * replace a diary the tutor was looking at with the connection error. The
   * error takes the screen only where there is no pet already showing, so
   * this holds for every present and future caller of the reload and not just
   * the two error branches that exist today.
   */
  const [petError, setPetError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** The walk this device has open, or null. Read once, then kept in step. */
  const [runningId, setRunningId] = useState<string | null>(null);
  /**
   * The stops this device pressed and could not yet tell the server about.
   *
   * **A stop that fails is not a stop that did not happen.** The tutor
   * pressed, the phone recorded the hour, and what is missing is the upload —
   * so the walk is released and the intent waits here and on disk. Read once
   * at mount beside the running walk, and written by the one branch that
   * queues. See `lib/pending.ts` for why `pressedAt` is the datum that
   * justifies the whole arrangement.
   */
  const [pending, setPending] = useState<PendingStop[]>([]);
  /**
   * The walk the sheet has written to since it was last fetched, by id.
   *
   * **`stop` reads the fetched row, and the fetched row lags a sheet save.**
   * Between the sheet saving a mid-walk note and the reload landing — well
   * under a second, but not zero — `runningWalk.note` is still empty, so a
   * stop inside the minute would read the walk as untouched and delete a row
   * that already holds something the tutor wrote. Saving the sheet on the
   * running row records its id here, and `stop` treats that as touched
   * alongside the row's own fields. Keyed by id rather than a boolean so a
   * new walk starts clean without anything having to reset it, and it is
   * conservative on purpose: a note written and then erased still closes the
   * walk at a minute instead of deleting it.
   */
  const [writtenToId, setWrittenToId] = useState<string | null>(null);
  /**
   * The walk this device has just closed, and the day it was closed on.
   *
   * **The goal bar's animation, and nothing else.** It is set only where the
   * server has said yes, it carries the minutes the close actually added, and
   * it is read by `GoalBlock` — no other part of the screen consults it, and
   * dropping it would cost the bar its motion and nothing more.
   *
   * **The day travels with it** so that a walk closed just before the arrows
   * are pressed cannot animate the day they land on.
   */
  const [closed, setClosed] = useState<{
    id: string;
    minutes: number;
    /** The day before this walk was counted into it: minutes and walks. */
    before: Walked;
    day: string;
  } | null>(null);
  // **Dropped the moment the day in view leaves it**, in React's own "adjust
  // state when an input changes" shape — the one `?day=` uses above — rather
  // than in an effect. Reading the stored day at the call site instead would
  // not be enough: the goal block unmounts behind the skeleton while the new
  // day loads, and comes back with no memory of which closes it has already
  // played, so a walk closed minutes ago would animate again on the way back
  // to its own day, and again on every return after that.
  if (closed !== null && closed.day !== dayKey(day)) setClosed(null);
  const [walkBusy, setWalkBusy] = useState(false);
  /**
   * A tap that arrives while another is still being handled.
   *
   * `walkBusy` is state, so it only closes the door once a render has
   * committed; a train of taps can land before that. A ref flips at once.
   */
  const walkInFlight = useRef(false);
  /**
   * Set by the one reload that follows an action which *failed*, and consumed
   * by the pet effect when it runs.
   *
   * **The distinction three rounds kept missing.** The diary is kept when an
   * action failed: a failed *action* must not take it away. It is not kept
   * when the action succeeded and the reload could not confirm it — the write
   * landed, the screen is waiting on a read that will not answer, and the
   * old rows do not show what was written. Silence is the one thing that
   * state must not offer; a walk that cannot be stopped is a wrong duration
   * in the record. So the keep path is opt-in, from the single place that
   * reloads after a failure (a start that errored), and every other reload —
   * a successful start or stop, a saved sheet, Reintentar — shows the error.
   */
  const keepDiaryOnFailedRead = useRef(false);
  /**
   * How many times a start or a stop has come back with an error. The goal
   * block shakes the control on each bump; a counter because two failures in
   * a row are two shakes.
   */
  const [failed, setFailed] = useState(0);
  /**
   * The press `reload` has not answered yet: one resolver, or nothing.
   *
   * **`Reintentar` runs the button's loading cycle, and the cycle is a
   * promise.** `reload` works by bumping `attempt`, which an effect consumes;
   * the answer therefore has to travel from that effect back to the press,
   * and a ref is the only thing both can reach.
   *
   * **Matched by identity, not by the attempt number.** The obvious key is
   * "the attempt this resolver was created for", and it cannot be written
   * honestly: `setAttempt((n) => n + 1)` is the only bump that is guaranteed
   * to change the value, and it does not report the number it produced.
   * Reading `attempt` from the press's own closure instead would be a copy of
   * state that is correct until a start, a stop or a sheet save bumps it
   * between the last commit and the press — at which point `setAttempt(n + 1)`
   * writes the value that is already there, the effect does not re-run, and
   * the button spins for ever. So the record itself is the key: `reload`
   * stores it and *then* bumps, the effect claims whatever it finds at the
   * top of its run, and only the run that found this very record may answer
   * it. A run already in flight claimed null or an older record and cancels
   * itself the moment `attempt` moves.
   *
   * Three ways it could be left dangling, all closed: a press that supersedes
   * another answers the older one `false` on the spot; a run cancelled by a
   * day change leaves the record in the ref for the run that replaces it; and
   * unmount settles whatever is left — `Button` ignores it, because it checks
   * `alive` before touching state, but a promise nobody can ever settle is
   * not a thing to leave behind.
   */
  const awaitingReload = useRef<{ settle: (loaded: boolean) => void } | null>(
    null,
  );
  /**
   * Hands a waiting press its answer, once, and only from the run that
   * claimed it.
   *
   * `loaded` is what the button shows: the check when the day came back, the
   * alert when it did not.
   */
  const answerReload = useCallback(
    (
      answering: { settle: (loaded: boolean) => void } | null,
      loaded: boolean,
    ) => {
      if (!answering || awaitingReload.current !== answering) return;
      awaitingReload.current = null;
      answering.settle(loaded);
    },
    [],
  );
  useEffect(() => {
    return () => {
      awaitingReload.current?.settle(false);
      awaitingReload.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // **Per key, so one unreadable value does not take the other with it.** A
    // read that fails is a device with no note, which is what a phone that
    // has never started a walk looks like: the block offers Empezar. The same
    // best-effort bargain `start` and `stop` already make.
    const read = (key: string) => AsyncStorage.getItem(key).catch(() => null);
    void Promise.all([read(WALK_STORAGE_KEY), read(PENDING_STORAGE_KEY)]).then(
      ([walk, queue]) => {
        if (cancelled) return;
        const stops = parsePending(queue);
        const running = parseRunningWalk(walk);
        setPending(stops);
        // **A walk the queue already holds is not running.** The release
        // writes the queue and only then clears the note, so a process killed
        // between the two comes back with both on disk — and a walk counted
        // live *and* as pending is counted twice, on the one screen whose
        // whole job is a single total. The queue is the later fact, so it
        // wins.
        setRunningId(
          running !== null && stops.some((stop) => stop.id === running)
            ? null
            : running,
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Taken at the start of the run, so it belongs to this run and to no
    // other: the reload a failed action asked for, and nothing later.
    const afterFailedAction = keepDiaryOnFailedRead.current;
    keepDiaryOnFailedRead.current = false;
    // **Claimed here, synchronously, for the same reason.** `reload` stores
    // its resolver and only then bumps `attempt`, so this run — the first one
    // to start after the press — is the one that owes it an answer. See
    // `awaitingReload`.
    const answering = awaitingReload.current;

    getMyPet().then(async ({ pet: row, error: failure }) => {
      if (cancelled) return;
      if (failure || !row) {
        const unreadable = failure ?? NO_PET;
        setPetError(unreadable);
        // **A failed navigation still has to land somewhere visible.** With no
        // pet the error takes the screen. With one already showing it does
        // not — the gate below — so a day that could not be asked for would
        // leave the log on its skeleton with no message and no way back.
        // Hand it to the log, which is the part that could not be loaded.
        // **Unless an action failed and the log holds real rows for this very
        // day:** then this is a failed *action* reloading what is on screen,
        // and the rows are the best answer there is. Both halves matter. The
        // row check is decided from the log itself, inside the updater, so it
        // cannot disagree with what is on screen; the action check is what
        // stops a *successful* write whose reload failed from keeping rows
        // that do not show it — see `keepDiaryOnFailedRead`.
        setLog((prev) =>
          afterFailedAction && prev && prev.day === dayKey(day) && !prev.error
            ? prev
            : { day: dayKey(day), attempt, events: [], error: unreadable },
        );
        answerReload(answering, false);
        return;
      }

      setPet(row);
      setPetError(null);
      const { events: rows, error: eventError } = await eventsForDay(
        row.id,
        day,
      );
      if (cancelled) return;
      // A failed read of the log does not take the screen down with it: the
      // craft floor's rule is that one component's error must not block the
      // whole interface, and everything above the log comes from the pet.
      setLog({
        day: dayKey(day),
        attempt,
        events: rows ?? [],
        error: eventError,
      });
      // **The day is the pet and its rows**, so a press is answered yes only
      // when both came back. A failed log read is still a failure to the
      // button, because the error it was pressed over is still on screen.
      answerReload(answering, eventError === null);
    });

    return () => {
      cancelled = true;
    };
  }, [day, attempt, answerReload]);

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
    eventsForMonths(pet.id, today, MARKED_MONTHS).then((read) => {
      if (cancelled) return;
      // A failed read leaves this null, not an empty list: the grid then
      // marks nothing and says it could not look, instead of drawing every
      // treatment day over a window nobody read. A reopen is untouched — the
      // previous rows stay until this answer replaces them.
      setMarkedEvents(marksWindowRows(read));
      setMarksError(read.error);
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
      //
      // **Nor while this device has a walk open.** The tutor is holding
      // something half-finished, and moving them off the day it is on loses
      // the row they would tap to stop it.
      if (daysAgo(day, today) === 0 && !runningId) setDay(now);
    });
    return () => sub.remove();
  }, [today, day, runningId]);

  // Hoisted above the early returns, because the birthday effect below is a
  // hook and cannot sit after them. `birthdayOn` takes a null birth date, so
  // this is safe before the pet has loaded.
  const isToday = daysAgo(day, today) === 0;
  const birthdayYears = birthdayOn(day, pet?.birth_date ?? null);
  const petId = pet?.id ?? null;

  /**
   * The treatments, read again every time the diary comes back into focus.
   *
   * **On focus rather than once, because they are written two tabs away.** The
   * diary is a tab, so it is already mounted when somebody records a
   * treatment in Salud, and a read at mount would keep showing the dose as it
   * was — which is the exact defect this feature exists to remove: correct
   * the Milbemax in Salud and the diary would still say the old thing. Salud
   * reads on its own mount for the same reason it never needed this.
   *
   * The result is set from the promise, never in the effect body, so none of
   * this is the cascading render `react-hooks/set-state-in-effect` reports.
   * A failed read draws no section and says nothing about it: the section is
   * absent, not an error line, and the reasons are written where it is drawn.
   * The rows it had stay, because the calendar still marks from them.
   */
  const readTreatments = useCallback(
    async (isCancelled: () => boolean) => {
      if (!petId) return;
      const { treatments: rows, error } = await treatmentsFor(petId);
      if (isCancelled()) return;
      setTreatments((held) => ({
        // A read that failed keeps the rows it had rather than blanking the
        // calendar: a stale mark beats a grid that claims nothing was given.
        // The day's section does not draw while `error` is set.
        rows: error && held ? held.rows : rows,
        error,
      }));
    },
    [petId],
  );
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void readTreatments(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [readTreatments]),
  );

  /**
   * Everything the screen reads, read again.
   *
   * **The treatments come back with the rest of it.** `attempt` drives the
   * pet, the log and the calendar's window, while the treatments hang off
   * focus and the pet's id. A failed treatments read draws nothing, so the
   * screen's Reintentar is the one button that can bring them back without
   * leaving the tab, and it has to re-read them too. Otherwise a tutor whose
   * connection came back would see the log recover and the day's treatments
   * stay missing.
   *
   * It is defined here rather than above because it calls `readTreatments`,
   * which needs the pet's id; nothing between the two uses it.
   *
   * **It resolves when the day has answered**, true when it loaded and false
   * when it did not, because that is what makes `Button` run its loading
   * cycle: the cycle is engaged by a promise and nothing else. Returning
   * `void` is what left both Reintentar mute — offline, seven seconds of a
   * press with nothing to show for it (PRODUCT.md, 2026-10-21). The treatments
   * ride along and are deliberately not part of the answer: a failed
   * treatments read draws nothing at all, so it is not a failure the button
   * can honestly report.
   *
   * **The message is not cleared on the way in.** It used to be, and on the
   * screen-wide error that swapped the whole screen for the full-screen
   * spinner the instant the button was pressed — the button was gone before
   * it could say it was working, and the sentence saying what had happened
   * went with it. The pet read clears it on success and writes it again on
   * failure, which is the only place that knows.
   */
  const reload = useCallback(() => {
    void readTreatments(() => false);
    // The resolver goes in **before** the bump: the effect run that the bump
    // causes claims it on the way past. See `awaitingReload`.
    const superseded = awaitingReload.current;
    const settled = new Promise<boolean>((resolve) => {
      awaitingReload.current = { settle: resolve };
    });
    // A press this one has taken the read away from: nothing will answer it
    // now, and a promise that never settles is a button that spins for ever.
    superseded?.settle(false);
    setAttempt((n) => n + 1);
    return settled;
  }, [readTreatments]);

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

  // Hoisted for the same reason: the walk's hooks below read them, and a hook
  // cannot sit after the early returns. Every one is safe before the pet loads.
  const loading = log === null || log.day !== dayKey(day);
  const events = loading ? NO_EVENTS : log.events;
  /** Not fatal: the header, the goal and the actions all still work. */
  const logError = loading ? null : log.error;
  /**
   * What Salud recorded on this day, which the diary only reads.
   *
   * **`administered_on` is a date, so these have no hour and go after the
   * timed entries.** Inventing a time for them would put the pill at a moment
   * nobody wrote down, and sorting them among the walks would claim an order
   * that was never known.
   */
  const dayTreatments = treatments ? treatmentsOn(treatments.rows, day) : [];
  const walked = walkedMinutes(events);
  /**
   * The same rows, counted: how many walks those minutes came in.
   *
   * Read here beside the total and never apart from it — the measure states
   * both in one sentence, and a count from a different read of the day is a
   * number the bar underneath would not add up to.
   */
  const walks = walkCount(events);
  /**
   * The day's minutes **as the goal block is allowed to state them**, which is
   * null when nobody knows.
   *
   * **A failed read is written into the log as no rows plus an error, and no
   * rows is not zero minutes.** The log's own region has checked `error`
   * before `events.length === 0` since the day it learned to; the measure
   * above it was handed `walked` and counted the same empty array as a fact.
   * It then said "0 min paseados" — in larger type and higher on the
   * screen than the sentence that rule was written for, and on a close whose
   * reload failed it said it directly above a bar painted past the goal.
   * PRODUCT.md: an empty state may never stand in for a failed read, because
   * zero minutes is a claim about the dog's day and an unread log is a claim
   * about the network. **Nothing downstream of rows that could not be read
   * may assert a number.**
   *
   * **Rows that did arrive outrank the error**, which is the failed-action
   * keep: an action that failed over a diary already on screen leaves real
   * rows and a message, and those rows are still the day's minutes.
   *
   * Only the block's own measure takes this. `walked` stays the rows' total
   * everywhere it is arithmetic rather than a statement — the close's
   * `recordedBefore`, the celebration's threshold — and both of those need a
   * running row to reach them, which a day with no rows has not got.
   */
  const measured: Walked | null =
    logError !== null && events.length === 0
      ? null
      : { minutes: walked, walks };
  const goal = pet?.exercise_goal_minutes ?? null;
  /**
   * Whether the day has already had the one celebration it gets.
   *
   * It is the **top** tier, not the goal the tutor typed: see
   * `CELEBRATED_TIER`. Both gates below read it, so a second walk on a day
   * that already doubled stays quiet.
   */
  const celebrated = tierReached(walked, goal) === CELEBRATED_TIER;
  /**
   * Whether the rows on screen answer the *current* request.
   *
   * **A day that matches is not enough.** Starting a walk sets `runningId` and
   * asks for a reload, and until that reload lands the rows are the ones read
   * before the walk existed — the new row is, rightly, not among them. Judging
   * the flag against those rows would call it stale and drop it, a second
   * after the tutor pressed start.
   */
  const fresh = !loading && log.attempt === attempt;

  /**
   * The row this device thinks is running, if it is on the day in view.
   *
   * **Derived, never a second piece of state.** An effect keeping one state in
   * step with another is the defect `react-hooks/set-state-in-effect` exists
   * to report, and the walk's start is already in the row.
   *
   * **A row with a length is not running**, whatever the flag says: the tutor
   * can open the live row and write one in the sheet, which closes the walk
   * without going through the control.
   */
  const runningRow =
    runningId !== null
      ? (events.find((event) => event.id === runningId) ?? null)
      : null;
  const runningWalk =
    runningRow && runningRow.duration_minutes === null ? runningRow : null;
  const walkingSince = runningWalk ? new Date(runningWalk.occurred_at) : null;

  // Three ways a flag stops meaning anything, and all three drop it without
  // writing: the row is gone — deleted on the other phone — or it has been
  // closed by hand, or the walk has been open past the column's ceiling, which
  // is the forgotten stop. Only once the day's rows have actually loaded for
  // this request, or every reload would clear it on the way past, and only on
  // the day the walk belongs to, or paging back a week would clear a walk that
  // is running fine.
  useEffect(() => {
    if (!runningId || !fresh || logError || !isToday) return;
    const row = events.find((event) => event.id === runningId);
    const stale =
      !row ||
      row.duration_minutes !== null ||
      walkOutcome(new Date(row.occurred_at), new Date()).action === "abandon";
    if (!stale) return;
    // **The flag drops whether or not the write does.** Hanging the state
    // change off a resolved `removeItem` meant a rejection left `runningId`
    // standing — and nothing re-runs this effect, because its deps do not
    // change — so the block went on offering a stop for a walk that is gone,
    // on a day the screen will not leave, since the `AppState` pin keys on
    // `runningId`. The write is best-effort, as in `start` and `stop`.
    AsyncStorage.removeItem(WALK_STORAGE_KEY)
      .catch(() => {
        // The row is the fact; the device's note is only a note.
      })
      .finally(() => setRunningId(null));
  }, [runningId, events, fresh, logError, isToday]);

  const start = useCallback(async () => {
    if (!petId || walkInFlight.current) return;
    walkInFlight.current = true;
    setWalkBusy(true);
    try {
      // The write comes first and the state follows it. A block that says "De
      // paseo" over a walk the server never accepted is worse than a tap that
      // visibly did nothing.
      const { id, error } = await startWalk(petId);
      if (error || !id) {
        toast.show({
          variant: "error",
          message: error ?? "No se ha podido empezar el paseo",
        });
        // **And the day is reloaded on the way out.** `withTimeout` abandons
        // the request after twelve seconds; the insert may well have
        // committed on the other side of it. The tutor reads the error and
        // presses start again, and now there are two open walks — the first
        // one invisible until something else happens to trigger a read. It is
        // visible and deletable the moment the log says it exists.
        keepDiaryOnFailedRead.current = true;
        setAttempt((n) => n + 1);
        setFailed((n) => n + 1);
        return;
      }
      // **The device's note is best-effort; the row is the fact.** A storage
      // failure here must not escape, or the row exists and the flag does not
      // and the block offers Empezar over a live walk. The walk runs for this
      // session either way.
      try {
        await AsyncStorage.setItem(WALK_STORAGE_KEY, serialiseRunningWalk(id));
      } catch {
        // Not worth interrupting a walk for.
      }
      setRunningId(id);
      setAttempt((n) => n + 1);
    } finally {
      // **Last, so no committed render shows Empezar enabled over a walk that
      // is already written.** Busy clears in the same batch that sets
      // `runningId`, which is what `onStart` is withheld on.
      walkInFlight.current = false;
      setWalkBusy(false);
    }
  }, [petId, toast]);

  const stop = useCallback(async () => {
    if (!runningWalk || walkInFlight.current) return;
    walkInFlight.current = true;
    setWalkBusy(true);
    try {
      // **One reading of the clock, held.** It is the hour the tutor pressed,
      // and it is what `outcome.minutes` is measured against — so a stop that
      // has to be queued stores that same instant rather than the clock as it
      // reads twelve seconds later, when the request finally gives up. See
      // `pressedAt` in `lib/pending.ts`.
      const pressedAt = new Date();
      const outcome = walkOutcome(new Date(runningWalk.occurred_at), pressedAt);
      // **The rule is "untouched", not "under a minute".** A start and a stop
      // inside the same minute is a mis-tap and the honest record of a
      // mis-tap is nothing — but the live row is in the log as soon as the
      // reload lands, the sheet opens on it, and a note and stool chips can
      // be written into it immediately. Deleting that row would throw away
      // something the tutor typed, silently and with no way back. So a row
      // anybody has written on is closed at one minute instead: the smallest
      // length the column accepts, and honest about a walk that did happen.
      // The fetched row can be a save behind, so `writtenToId` stands in for
      // whatever the sheet has written that the row does not show yet.
      // `details` is `jsonb`, so it arrives as `Json` and needs the same cast
      // `eventDetail` makes.
      const details = runningWalk.details as Record<string, unknown> | null;
      const untouched =
        !runningWalk.note &&
        Object.keys(details ?? {}).length === 0 &&
        writtenToId !== runningWalk.id;
      // **What this stop writes, which is the only thing the bar has to say
      // and now the only thing the queue has to carry.** `outcome.minutes`
      // for a close; one minute for a discard that had been written on, which
      // is closed at a minute rather than deleted for the reason above; and
      // nothing at all for a deleted row or an abandon, which add no minutes
      // — a bar that moved for them would be claiming a walk was saved when
      // none was. **Read once, above the write**: the error branch queues the
      // intent and the success branch draws it, and two readings of `outcome`
      // could come to disagree about which walk was being saved.
      const added =
        outcome.action === "close"
          ? outcome.minutes
          : outcome.action === "discard" && !untouched
            ? 1
            : null;
      const { error } =
        outcome.action === "discard"
          ? untouched
            ? await deleteEvent(runningWalk.id)
            : await closeWalk(runningWalk.id, 1)
          : outcome.action === "close"
            ? await closeWalk(runningWalk.id, outcome.minutes)
            : { error: null };
      if (error) {
        // **The walk was stopped; what is missing is the upload.** It used to
        // stay running so the tutor could press again, and the second press
        // wrote *that* hour — twenty minutes of lift and stairs went into the
        // record as walking. The toast and the shake stay, because the tutor
        // has to know there was no network, and the intent is kept with the
        // hour the phone recorded.
        toast.show({ variant: "error", message: error });
        // The intent is the write that just failed, said again: a close with
        // its minutes, or the delete a clean mis-tap gets. An abandon writes
        // nothing and so cannot arrive here.
        const intent: PendingStop =
          added === null
            ? {
                kind: "delete",
                id: runningWalk.id,
                pressedAt: pressedAt.toISOString(),
              }
            : {
                kind: "close",
                id: runningWalk.id,
                minutes: added,
                pressedAt: pressedAt.toISOString(),
              };
        const queued = enqueueStop(pending, intent);
        setPending(queued);
        // **Released, and its minutes change hands in the same commit.** The
        // live segment goes with `runningId`, and `walked` counts the queue,
        // so the bar is painted at the same width on both sides of this.
        setRunningId(null);
        // **Bumped here, in the run that clears `walkBusy`.** No `await`
        // separates this from the `finally` below, so the shake and the
        // control coming back from its spinner are one commit.
        setFailed((n) => n + 1);
        // **And the day is reloaded on the way out**, as a failed start does:
        // `withTimeout` abandons the request after twelve seconds and the
        // update may well have committed on the other side of it. The diary
        // is kept if that read fails too — a failed *action* is not a failed
        // *navigation*, and the rows on screen are what the day's minutes,
        // pending ones included, are counted from.
        keepDiaryOnFailedRead.current = true;
        setAttempt((n) => n + 1);
        // **Disk below the `set…` calls, for the reason `setClosed` sits
        // below its own `await`:** an `await` ends the window React coalesces
        // updates in, and a render committed in the middle would show the
        // walk released with nothing counting its minutes — the backwards
        // frame, for as long as the storage round trip takes.
        //
        // **The queue goes down before the note is cleared**, so a process
        // killed between the two leaves a walk that is queued and still
        // marked as running, which the mount read resolves, rather than one
        // that is neither. Both writes are best-effort, as everywhere else
        // here: the queue in memory is what this session counts.
        try {
          await AsyncStorage.setItem(
            PENDING_STORAGE_KEY,
            serialisePending(queued),
          );
        } catch {
          // Not worth a second failure on top of the one being reported.
        }
        try {
          await AsyncStorage.removeItem(WALK_STORAGE_KEY);
        } catch {
          // See above.
        }
        return;
      }
      // Best-effort, as in `start`: if the flag outlives the walk, the row has
      // a length (or is gone) by the next load and the staleness effect drops
      // it.
      try {
        await AsyncStorage.removeItem(WALK_STORAGE_KEY);
      } catch {
        // See above.
      }
      // **The row's id goes with the minutes**, because that is what makes
      // the animation fire once per close: two walks of the same length are
      // two animations, and a value check would swallow the second.
      //
      // **Below the `await`, and that is not tidiness.** It has to be set in
      // the same batch as `setAttempt`, because the gate the animation waits
      // on is "the rows answer the current request" and bumping `attempt` is
      // what shuts it. An `await` ends the window React coalesces updates in,
      // so recording the close above the storage write let a render commit
      // between the two: `attempt` not yet bumped, the gate open, and the
      // animation computed from the total from *before* this walk — which
      // then marks itself played and swallows the real one. **Measured**: on
      // the web the storage write resolves in a microtask and the batch held,
      // which is why every test passed over it; standing a 50 ms tick in for
      // the native module's round trip reproduced it exactly, with the close
      // firing at 59 of 60 minutes and drawing the previous walk's stretch
      // instead of the one that reached the goal.
      if (added !== null) {
        setClosed({
          id: runningWalk.id,
          minutes: added,
          // **The day before this walk joined it**, which is what lets the
          // bar draw the close without waiting for the reload: `walked` and
          // `walks` both count closed walks, and the one being announced is
          // not among them yet. The block cannot work this out for itself —
          // by the time it sees the close, whether its own total already
          // contains this walk depends on a request still in flight.
          before: { minutes: walked, walks },
          day: dayKey(day),
        });
      }
      setRunningId(null);
      setAttempt((n) => n + 1);

      // The same threshold the sheet's `onSaved` crosses, with simpler
      // arithmetic: a running walk contributes null to `walked`, so there is
      // no old value to take out before the new one goes in. `isToday` is what
      // stops a walk closed after midnight throwing confetti over a day nobody
      // is looking at.
      //
      // **The threshold is the top tier now, and it is read off the bar's own
      // scale.** A walk that merely reaches the goal turns the bar Aqua and
      // says so under it, and that is all it gets: see `CELEBRATED_TIER`.
      if (
        outcome.action === "close" &&
        isToday &&
        !celebrated &&
        tierReached(walked + outcome.minutes, goal) === CELEBRATED_TIER
      ) {
        celebrate(CELEBRATION_TONE);
      }
    } finally {
      walkInFlight.current = false;
      setWalkBusy(false);
    }
  }, [
    runningWalk,
    writtenToId,
    toast,
    celebrate,
    isToday,
    goal,
    celebrated,
    pending,
    walked,
    walks,
    day,
  ]);

  if (petError && !pet) {
    return (
      <Screen center edges={["top"]}>
        <ErrorNote testID="home-pet-note" message={petError} />
        {/* **The result label is short and says only that the press did not
            work**, because the sentence above it already says why — and it is
            rewritten by the very read this button is waiting on, so by the
            time the alert shows, the reason on screen is the current one. */}
        <Button
          testID="home-retry"
          label="Reintentar"
          errorLabel="Sigue sin cargar"
          onPress={reload}
        />
      </Screen>
    );
  }

  // Only the pet is fatal to the whole screen: without it there is no day to
  // show. The log has its own waiting state below, inside the shape it will
  // fill, so the header a tutor just used stays under their thumb.
  if (!pet) return <LoadingScreen />;

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

  /**
   * Whether the sheet is open on the walk this device has running.
   *
   * Worked out once, because three things have to agree on it: how the sheet
   * reads the row's lone time (`timeMeans`), whether it lets the times be
   * changed (`running`), and whether a save counts as a write to the walk
   * `stop` is about to judge (`writtenToId`).
   */
  const editingRunning =
    editing !== null &&
    editing.event !== null &&
    editing.event.id === runningWalk?.id;

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
          day's "2h 30m en 3 paseos" over a header that already says "Ayer"
          is the same lie the log used to tell, in fewer words and larger
          type. */}
      {loading ? (
        <View testID="home-goal-skeleton" className="mb-8">
          <View className="mb-2">
            <Skeleton width="58%" height={16} />
          </View>
          {goal !== null ? <Skeleton width="100%" height={4} /> : null}
        </View>
      ) : (
        <GoalBlock
          testID="home-goal"
          walked={measured}
          goalMinutes={goal}
          durationFormat={settings.durationFormat}
          walkingSince={walkingSince}
          // **The stop spans the gap between the write and the reload.**
          // `walkingSince` is read from the row, so it is null until the day
          // refetch answers — a gap bounded by the request timeout, not by a
          // frame. Withholding both controls there takes the most-pressed
          // thing on the screen away the instant it is pressed, over a
          // measure still showing the old number, which reads as "it didn't
          // work" — the exact impression writing before the state changes
          // exists to avoid. For a reader it is worse: the label turning into
          // "Terminar paseo" is the only confirmation the start landed, and
          // removing the control drops focus and says nothing. So it renders
          // disabled across the gap. `stop` early-returns without a row, so
          // offering it before one arrives is safe; `isToday` is what keeps a
          // day reached with the arrows free of it, and a walk running past
          // midnight keeps its stop through `walkingSince`.
          busy={walkBusy || (isToday && runningId !== null && !walkingSince)}
          onStart={isToday && !runningId ? start : undefined}
          onStop={
            walkingSince || (isToday && runningId !== null) ? stop : undefined
          }
          // **The close animates on the tap, and the gate that made it wait
          // is gone.** It used to be held until `fresh` — "the rows on screen
          // answer the current request" — because the animation was computed
          // by *subtracting* the closed minutes from a total that might or
          // might not already contain them, so it needed the reload to know
          // which. Those 400 ms of waiting were the hole the tutor filmed:
          // the live segment unmounts on the tap and the bar spent the gap
          // telling the truth of a minute ago. The close now carries the
          // total it started from, so both ends of the fill are known the
          // moment the server says yes and nothing has to be waited for. The
          // day it belongs to is still checked, and that is settled above:
          // `closed` is dropped as the day in view leaves it.
          justClosed={
            closed
              ? {
                  id: closed.id,
                  minutes: closed.minutes,
                  before: closed.before,
                }
              : null
          }
          failed={failed}
        />
      )}

      {/* **TRATAMIENTOS: context for reading the day, not an entry in it.**
          A day with less activity than usual only connects to the vaccine that
          left the dog drowsy if both are on screen at once — so this sits
          between the day's measure (the goal block above) and the day's
          stream (the log below), where it is read before the entries it
          explains, rather than appended after them where it is read last, if
          at all. The log reads forwards and everything in it has an hour; an
          hourless row inside it was always a guest, and it is the reason the
          section is a sibling and not a foot.

          **A section of its own, so it owns its own states.** Nothing is
          drawn while the treatments are still unread, and nothing on a day
          that has none: absent, not empty — an empty section would announce
          a heading over a blank. They are one read held for every day, so
          this is only ever a wait on the first visit. The log below neither
          waits for it nor knows about it. The rows are read-only and lead out
          of the screen (the chevron says so): see `TreatmentEntry`.

          **A failed read draws nothing here: no heading, no line, no button.**
          The read is the pet's whole history and the day only filters it, so
          a failure is about the list, not about this day. A message in this
          section would read as "for this day", and it would follow the tutor
          across every day they paged to — including the ~96% that have
          nothing here at all. The log already says what matters: a treatments
          read fails when the connection is gone, and then the events read
          failed too, so the log shows its own error with its own Reintentar
          directly below, and that Reintentar re-reads these as well. Nothing
          needs a button of its own for recovery either: the read runs on tab
          focus, so leaving for Salud and coming back retries it.

          The residual is accepted, not hidden. Events landing while the
          treatments read fails — a server hiccup rather than an outage — on
          one of the roughly sixteen days a year that have a treatment, show
          nothing and say nothing until the next focus. */}
      {dayTreatments.length > 0 && !treatments?.error ? (
        <Group testID="home-treatments" title="Tratamientos">
          {dayTreatments.map((row) => (
            <TreatmentEntry
              key={row.id}
              row={row}
              onPress={() => router.push(`/health?treatment=${row.id}`)}
            />
          ))}
        </Group>
      ) : null}

      {/* **The log waits for the events and for nothing else.** The treatments
          are a second request on their own schedule, bounded by the same
          twelve-second timeout as everything else, and putting them in front
          of the first paint meant a day whose entries landed in 300ms could
          sit in its skeleton for twelve seconds — and, worse, an events
          failure would wait behind them instead of offering its Reintentar.
          The rows paint as they arrive.

          The waiting state fills the slots the rows will fill: see
          `LogSkeleton`. The title is the real word, because it is true before
          the rows land. */}
      {loading ? (
        <Group testID="home-log-skeleton" title="Registro">
          <LogSkeleton />
        </Group>
      ) : logError ? (
        <Group testID="home-log-error">
          <ErrorNote testID="home-log-note" message={logError} />
          <View className="mb-5">
            <Button
              testID="home-log-retry"
              label="Reintentar"
              // See the screen's own Reintentar above: the reason is the line
              // of text directly over this button.
              errorLabel="Sigue sin cargar"
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
              running={event.id === runningWalk?.id}
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
            // The window's events and the treatments inside it, and nothing
            // at all until the window has answered: `marksForMonths` owns
            // both halves of that rule and is tested on them.
            marks={marksForMonths(
              markedEvents,
              treatments?.rows ?? [],
              today,
              MARKED_MONTHS,
            )}
            vaccines={vaccineDays(treatments?.rows ?? [])}
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
            // sides and cannot cross anything. `!celebrated` is what keeps a
            // second walk on an already-doubled day quiet.
            //
            // **Only on the day you are in.** Backfilling a forgotten
            // Tuesday is bookkeeping, and a week of catch-up entries firing
            // a week of confetti would be a party for paperwork. The cost is
            // a walk logged after midnight, which lands on "Ayer" and gets
            // nothing; that is the narrower mistake of the two.
            const crossed =
              isToday &&
              !celebrated &&
              tierReached(
                walked -
                  (editing.event?.duration_minutes ?? 0) +
                  (walkMinutes ?? 0),
                goal,
              ) === CELEBRATED_TIER;

            // A save on the running walk is a write the fetched row does not
            // show yet: see `writtenToId`.
            if (editingRunning && editing.event) {
              setWrittenToId(editing.event.id);
            }
            setEditing(null);
            setAttempt((n) => n + 1);
            if (crossed) celebrate(CELEBRATION_TONE);
          }}
          onFailed={(message) => toast.show({ variant: "error", message })}
          petId={pet.id}
          timeMeans={editingRunning ? "start" : "end"}
          running={editingRunning}
        />
      ) : null}
    </Screen>
  );
}

/**
 * A treatment in the day's TRATAMIENTOS section: read here, written in Salud.
 *
 * **Three lines, each its own: the name, the kind, the next date.** One line
 * of "Desparasitación (Int.) · próxima 12 ene 2027" wrapped on the phone and
 * left "2027" alone on a second line — the one number the tutor reads the row
 * for. The kind stays, because more treatment types are coming and dropping
 * information to fix a wrap is the wrong trade; and `text-wrap: balance` is no
 * way out, since the native CSS compiler discards it (it works in the browser
 * and does nothing on the device). A deliberate break is the only fix that
 * holds on both, and it is the same on every row, so a column of them reads as
 * a column.
 *
 * **No hour, so the left column is the kind's glyph alone.** `administered_on`
 * is a date and nobody wrote a time down; a clock reading here would be
 * invented, which is a lie in a product whose promise is that the record is
 * true. The glyph is the kind's own from Salud's history, so the row reads as
 * the same thing in both places.
 *
 * **The glyph wears amber, the colour of the ring this day carries on the
 * calendar.** The calendar folds treatments into its medication mark, and the
 * log's rule since v0.8 is that a calendar hue is worn by the row that put it
 * there. It is not the scarce accent — that is spent on three things this
 * does not touch — and no meaning rests on the colour: the row names its kind.
 *
 * **A chevron, because tapping it leaves.** The timed rows open a sheet over
 * the diary; this one opens Salud on the treatment's own sheet, and it is the
 * only place a correction can be made, so the row says it is a door rather
 * than a form.
 */
function TreatmentEntry({
  row,
  onPress,
}: {
  row: PetTreatmentRow;
  onPress: () => void;
}) {
  const { title, kind, next } = describeTreatment(row);
  const Glyph = TREATMENT_ICONS[row.kind as TreatmentKind];

  return (
    <Pressable
      testID={`home-treatment-${row.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, kind, next].filter(Boolean).join(", ")}
      accessibilityHint="Ábrelo en Salud para corregirlo o borrarlo"
      style={{ minHeight: TOUCH_TARGET }}
      className="mb-5 flex-row items-start gap-3 active:opacity-70"
    >
      <View
        className="shrink-0 pt-0.5"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {Glyph ? (
          <Glyph size={18} strokeWidth={2} color={colors.warning} />
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold text-text-primary">{title}</Text>
        {kind ? <Text className="text-text-secondary">{kind}</Text> : null}
        {next ? <Text className="text-text-secondary">{next}</Text> : null}
      </View>
      <View
        className="shrink-0 self-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </Pressable>
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
  running = false,
}: {
  event: PetEventRow;
  onPress: () => void;
  /** The walk this device has open: no length yet, and it is still going. */
  running?: boolean;
}) {
  const { settings } = useSettings();
  const spec = KINDS[event.kind as EventKind];
  // The reading side, so both formats are the tutor's. The sheet below keeps
  // 24-hour times, because that is the only form a number pad can express.
  const time = formatTimeOfDay(
    new Date(event.occurred_at),
    settings.timeFormat,
  );
  // **A running walk says "En marcha" and nothing else.** The goal block owns
  // the clock and ticks it on its own; a second counter here would only
  // refresh when this screen re-rendered, and the two would disagree.
  const described = running
    ? "En marcha"
    : spec?.describe(event, settings.durationFormat);
  const stools = readStools(event.details);
  const Icon = spec?.icon;

  return (
    <Pressable
      testID={`home-entry-${event.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        spec?.label ?? event.kind,
        time,
        described,
        describeStools(stools),
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Ábrelo para corregirlo o borrarlo"
      style={{ minHeight: TOUCH_TARGET }}
      className="mb-5 flex-row items-start gap-3 active:opacity-70"
    >
      {/* **Sized to its content, not to a number.** A fixed 80dp was measured
          wrong in both directions: 27dp of slack for "09:00" and too narrow
          for "12:05 p.m." at font_scale 1.3, where five characters already
          take 53dp. Sizing to the content grows with the font scale for free.
          **It only keeps the titles aligned because the figures are
          tabular.** "24-hour times are all five characters" was the original
          justification and it is true of the count and false of the width:
          Outfit's digits are proportional, so "09:40", with no narrow 1 in
          it, was the widest of three measured on the device and pushed its
          title right. `tabular-nums` gives every digit one width, so every
          24-hour time is one width as well as one length. The cost is a
          character of rag in 12-hour mode, between "9:15 a.m." and
          "12:05 p.m.", which is cheaper than a clipped time. */}
      <View className="shrink-0 items-start gap-1">
        <Text
          className={running ? "text-accent" : "text-text-tertiary"}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {time}
        </Text>
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
            color={
              running ? colors.accent : (spec?.tone ?? colors.textTertiary)
            }
          />
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-text-primary">
          {spec?.label ?? event.kind}
        </Text>
        {described ? (
          // **A running walk's state takes the accent**, like the time and the
          // glyph beside it: all three say the same thing, and one of them
          // reading in the column's ordinary tone made it look like the row's
          // content rather than its status.
          <Text className={running ? "text-accent" : "text-text-secondary"}>
            {described}
          </Text>
        ) : null}
        {event.note ? (
          // **The note renders its Markdown.** A tutor writing "**Cojea** de
          // la pata derecha" after a vet visit gets the emphasis they meant;
          // one who writes a plain sentence gets a plain sentence back, which
          // is the whole bargain of writing Markdown by hand.
          <Markdown
            text={event.note}
            className="text-xs text-text-tertiary"
            compact
          />
        ) : null}
      </View>

      {/* **Right of the row, where the eye ends up rather than starts.** The
          walk's own facts read first; this is what it left behind. One mark
          per stool — the count is what a glance wants during a food
          transition, and the shape is what makes two days comparable without
          reading anything. The row's accessible name already says all of it
          in words, so these are decoration to a reader. */}
      {stools.length > 0 ? (
        <View className="shrink-0 flex-row items-start gap-1 pt-0.5">
          {stools.map((stool, index) => (
            <View
              key={`${index}-${stool}`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
            >
              <StoolMark value={stool} size={20} color={colors.textTertiary} />
            </View>
          ))}
        </View>
      ) : null}
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
 * **DESDE and HASTA are the facts; DURACIÓN is a reading of them.** Editing
 * either time recomputes the duration, and the duration is never typed: it
 * used to write back into a time — typed, or by a -15 / +15 pair of buttons —
 * and that coupling is where a running walk's real start was overwritten
 * twice, so the field only shows. It is still saved, and a row that has a
 * length and no second time (a walk across midnight, a stored one with only a
 * HASTA) carries it through `save` untouched.
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
  timeMeans = "end",
  running = false,
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
  /**
   * What a walk's lone `occurred_at` means when there is no duration.
   *
   * **Default `"end"`, which is what every stored row meant before the
   * timer.** "I got back at 20:15 and did not write a length" is the fastest
   * valid entry there is, and the sheet has always read it that way. A walk in
   * progress has exactly the same shape and the opposite meaning, so the day
   * view — which is the only thing that knows — says so.
   */
  timeMeans?: "start" | "end";
  /**
   * This is the walk the device has running, so its times are not editable.
   *
   * **A separate flag from `timeMeans`, though the day view derives both from
   * the same test.** `timeMeans` says how to *read* a lone time and is about
   * the row's shape; this says what may be *changed*, and the two could part
   * ways — a walk read as "start" is not necessarily one to lock. While it
   * holds, DESDE, HASTA and their clock faces are disabled, because the start
   * is a measurement the timer took and not something to be corrected under a
   * walk still in progress. The note and the stools are the reason the row is
   * opened mid-walk, and stay as they are. The cost, accepted: pressing start
   * five minutes late cannot be fixed until the walk is stopped.
   */
  running?: boolean;
}) {
  const spec = KINDS[kind];
  const isWalk = kind === "walk";
  const { settings } = useSettings();
  const durationFormat = settings.durationFormat;

  const occurred = event ? new Date(event.occurred_at) : null;
  const storedMinutes = event?.duration_minutes ?? null;

  /**
   * The two time fields as the sheet opens, read back from the row.
   *
   * **This used to be called the anchor, and `at` used to always be it.** For
   * every kind but the walk it still is — one time, and nothing to derive it
   * from. A stored walk keeps its start in `occurred_at`, so reopening one
   * adds the duration back on to recover the HASTA it was entered from; when
   * that end lands on the next day there is no HASTA this form can hold and
   * DESDE carries the walk on its own. A walk in progress is that same shape
   * with no duration yet, which is what `timeMeans` is for.
   *
   * One source for the three places that need it: `at`, `from`, and `opened`.
   */
  const [initial] = useState(() => {
    const now = new Date();
    if (!occurred) return { at: formatTimeOfDay(now), from: "" };
    if (storedMinutes) {
      const end = endWithinDay(occurred, storedMinutes);
      // A walk that crossed midnight has no HASTA this form can hold, so the
      // duration carries it — `startWithinDay`'s rule, in the other direction.
      return {
        at: end ? formatTimeOfDay(end) : "",
        from: formatTimeOfDay(occurred),
      };
    }
    return timeMeans === "start"
      ? { at: "", from: formatTimeOfDay(occurred) }
      : { at: formatTimeOfDay(occurred), from: "" };
  });

  const [at, setAt] = useState(initial.at);
  /** A walk's start. Empty means nobody wrote it down. */
  const [from, setFrom] = useState(initial.from);
  /** What the duration field shows while it is being typed into. */
  const [durationText, setDurationText] = useState(() =>
    storedMinutes ? formatDuration(storedMinutes, durationFormat) : "",
  );
  const [value, setValue] = useState(
    () => (event && eventDetail(event, "what")) || "",
  );
  const [note, setNote] = useState(() => event?.note ?? "");
  const [atError, setAtError] = useState<string | null>(null);
  const [fromError, setFromError] = useState<string | null>(null);
  const [stools, setStools] = useState<Stools>(() =>
    readStools(event?.details),
  );
  const [stoolsOpen, setStoolsOpen] = useState(false);

  /**
   * What the entry looked like when the sheet opened, for the dirty check.
   *
   * A `useState` initialiser rather than a ref, because this is read during
   * render and a ref read there is the defect `react-hooks/refs` exists to
   * catch. It never changes: the sheet is remounted for each entry.
   */
  const [opened] = useState(() => ({
    at: initial.at,
    from: initial.from,
    // The duration is compared too, although it only ever follows the two
    // times: it is part of what `save` writes, and a crossed walk's HASTA is
    // empty, so there the duration is the one fact the times do not carry.
    duration: storedMinutes
      ? formatDuration(storedMinutes, durationFormat)
      : "",
    value: (event && eventDetail(event, "what")) || "",
    note: event?.note ?? "",
    stools: readStools(event?.details).join(","),
  }));
  const [durationError, setDurationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /**
   * **Only an edit can be unchanged.** The profile's blocks disable their save
   * until something differs from the row, and correcting an entry is the same
   * situation: reopening a walk and pressing Guardar with nothing touched is a
   * write with nothing in it.
   *
   * A *new* entry is not. It has no stored version to differ from, and an
   * untouched walk is a complete record on purpose — nothing but the time you
   * got back is a documented, valid entry, and the fastest one there is. So
   * the rule applies where it means something and nowhere else.
   */
  const dirty =
    !event ||
    at !== opened.at ||
    from !== opened.from ||
    durationText !== opened.duration ||
    value !== opened.value ||
    note !== opened.note ||
    stools.join(",") !== opened.stools;

  /** Recomputes the duration shown from the two times. Never writes into one. */
  const showDuration = useCallback(
    (fromText: string, atText: string) => {
      // **A time that does not parse is not a reason to throw the duration
      // away**: not a time *yet* is mid-typing, not an error. It is also the
      // only rule that survives a real keyboard. Deleting "10:48" on Android
      // fires one change per key, so the field passes through "10:" and "1" on
      // its way to empty, and clearing on each of those wiped a duration the
      // final empty string was then careful to preserve. The web hid it
      // completely: `fill("")` is a single event.
      //
      // **An *empty* DESDE next to a HASTA is the one exception, and it is
      // not mid-typing.** The duration is only ever a reading of the two
      // times now, so with one of them gone and HASTA standing alone there is
      // nothing left to read it from. The case this closes is narrow and
      // real: clear DESDE, then type a *new* HASTA, and the length left
      // behind is one that was measured from a start no longer on the form —
      // stale against the time it now sits next to, and unclearable, because
      // the field cannot be typed into. The other way round — DESDE and no
      // HASTA — keeps the duration, because that is the walk across midnight,
      // where the length is the fact.
      //
      // **A HASTA before its DESDE is mid-typing too**, and the same rule
      // covers it: `minutesBetween` says null for a pair in that order, and
      // clearing on it would throw away a crossed walk's stored length the
      // moment the tutor typed the real 00:10 end next to its 23:40 start.
      // `save` refuses the pair on DESDE's own field, where it can be seen
      // and corrected; the last good reading stays in place until two times
      // that make sense replace it.
      const start = fromText.trim() ? parseTimeOfDay(fromText, day) : null;
      const end = parseTimeOfDay(atText, day);
      if (end && !fromText.trim()) {
        setDurationText("");
        return;
      }
      if (!start || !end) return;
      const total = minutesBetween(start, end);
      if (total === null) return;
      setDurationText(formatDuration(total, durationFormat));
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

  const save = useCallback(async () => {
    const end = parseTimeOfDay(at, day);
    const start = isWalk && from.trim() ? parseTimeOfDay(from, day) : null;

    // **HASTA is required unless DESDE can stand in for it.** A walk needs two
    // times, or one time and a length; everything else still needs the hour it
    // happened at. Emptiness is the test, not parseability: only an *empty*
    // HASTA can be stood in for, so a typed one that does not parse is refused
    // rather than dropped in silence.
    if (!end && (at.trim() || !(isWalk && from.trim()))) {
      setAtError("Escríbela como 09:15");
      return false;
    }
    if (end && end.getTime() > Date.now() + 60_000) {
      setAtError(
        isWalk ? "¿Todavía no habéis vuelto?" : "¿Todavía no ha pasado?",
      );
      return false;
    }
    setAtError(null);

    if (isWalk && from.trim() && !start) {
      setFromError("Escríbela como 09:15");
      return false;
    }
    // With no HASTA the start is what `occurred_at` becomes, so it gets the
    // same future check HASTA does, and on its own field: a message about one
    // field does not belong in a toast. With both times present HASTA is
    // later than DESDE and has already been checked above.
    if (start && start.getTime() > Date.now() + 60_000) {
      setFromError("¿Todavía no habéis salido?");
      return false;
    }
    setFromError(null);

    let occurredAt = end as Date;
    let walkMinutes: number | null = null;

    if (isWalk && start && end) {
      walkMinutes = minutesBetween(start, end);
      if (walkMinutes === null) {
        // Still refused, and deliberately: a HASTA typed before its DESDE is a
        // mistyped digit far more often than a walk across midnight. What the
        // app now records is a crossing it *measured*, where it holds both
        // instants and guesses nothing.
        setFromError("Tiene que ser antes de la hora de vuelta");
        return false;
      }
      occurredAt = start;
    } else if (isWalk) {
      const typed = parseDuration(durationText);
      // A duration out of range is refused here rather than dropped. The
      // field is no longer typed into, so what arrives is the stored length
      // or a reading of two times — valid by construction — and these checks
      // are the guard that keeps `save` from depending on that: filing a walk
      // under a length nobody could have meant is worse than refusing it.
      if (durationText.trim() && (typed === null || typed <= 0)) {
        setDurationError("Escríbela como 45 min o 1h 30m");
        return false;
      }
      if (typed !== null && typed > MAX_WALK_MINUTES) {
        setDurationError("Como mucho 24 horas");
        return false;
      }
      walkMinutes = typed;
      // A walk known only by its start: `occurred_at` is that start, and the
      // length is the fact. This is the walk in progress, and the walk that
      // crossed midnight, which are the same row.
      if (start) occurredAt = start;
    }

    const payload = {
      kind,
      occurredAt,
      durationMinutes: walkMinutes,
      note: note || null,
      details: {
        ...(spec.field && value.trim() ? { what: value.trim() } : {}),
        // Absent rather than empty on a walk with none — see `writeStools`.
        ...(isWalk ? writeStools(stools) : {}),
      },
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
    stools,
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
                  trailing={
                    <TimePicker
                      testID="entry-from-picker"
                      label="Desde"
                      value={from}
                      // **The dial is the other way into the same field**, so
                      // it goes through the same handler the keyboard does.
                      // Writing the time straight in left the duration
                      // reading whatever the previous pair came to: a stored
                      // 10:00–10:45 walk whose HASTA was moved to 11:00 on
                      // the clock face still said 45 min while `save` stored
                      // 60 — and the field is read-only, so that was a wrong
                      // number the tutor could see and not correct.
                      onChange={editFrom}
                      disabled={running}
                    />
                  }
                  label="Desde"
                  value={from}
                  onChangeText={editFrom}
                  onBlur={() => tidyTime(from, setFrom)}
                  placeholder="09:15 o 915"
                  error={fromError}
                  keyboardType="number-pad"
                  maxLength={5}
                  disabled={running}
                />
              </View>
              <View className="flex-1">
                <TextField
                  testID="entry-to"
                  trailing={
                    <TimePicker
                      testID="entry-to-picker"
                      label="Hasta"
                      value={at}
                      // Through `editAt` for the reason DESDE's dial is — see
                      // above.
                      onChange={editAt}
                      disabled={running}
                    />
                  }
                  label="Hasta"
                  value={at}
                  onChangeText={editAt}
                  onBlur={() => tidyTime(at, setAt)}
                  placeholder="09:45 o 945"
                  error={atError}
                  keyboardType="number-pad"
                  maxLength={5}
                  disabled={running}
                />
              </View>
            </View>

            {/* **A reading, not a field.** The two times above are what the
                tutor types and this is what they come to, so it is not
                editable and says nothing to type. On a finished walk it
                stays in the primary tone on purpose: a value drawn like a
                disabled control invites the tutor to fight it.

                **On a walk in progress it joins the lock.** DESDE and HASTA
                go tertiary there, and the one field that is *always* locked
                reading as the most editable of the three said the opposite
                of what is true. Locked is a property of the moment, so the
                three take it together. It takes only the width its value
                needs. */}
            <View className="mb-5" style={{ width: 140 }}>
              <TextField
                testID="entry-duration"
                label="Duración"
                value={durationText}
                editable={false}
                disabled={running}
                placeholder="—"
                error={durationError}
                className=""
              />
            </View>
          </>
        ) : (
          <TextField
            testID="entry-time"
            trailing={
              <TimePicker
                testID="entry-time-picker"
                label="Hora"
                value={at}
                // `editAt`, not `setAt`, although a non-walk has no duration
                // to recompute — `from` is always empty here, so the extra
                // call writes the empty string the field already holds. One
                // handler for both ways into the field is the rule; two is
                // how the walk's dial drifted from its keyboard.
                onChange={editAt}
              />
            }
            label="Hora"
            value={at}
            onChangeText={editAt}
            onBlur={() => tidyTime(at, setAt)}
            placeholder="09:15 o 915"
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

        {/* **The kaka button rides in the note's own row**, because typing
            "💩" into the note is the habit it replaces — and it costs the
            walk no vertical space at all until somebody asks for it. Only the
            walk has one: the other three kinds are a moment, not an outing. */}
        <View className="flex-row items-end gap-3">
          <View className="min-w-0 flex-1">
            <TextField
              testID="entry-note"
              multiline
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder="¿Algo que contar?"
              limit={NOTE_LIMIT}
              corner={<MarkdownHelp testID="entry-note-help" />}
            />
          </View>
          {isWalk ? (
            <View className="mb-5">
              <StoolToggle
                open={stoolsOpen}
                onToggle={() => setStoolsOpen((was) => !was)}
              />
            </View>
          ) : null}
        </View>

        {isWalk ? (
          <StoolField open={stoolsOpen} value={stools} onChange={setStools} />
        ) : null}

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
              // Nothing to save says so rather than inviting a pointless
              // write — the profile's rule, and it only reaches an edit.
              disabled={!dirty}
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
