# Walk timer — design

Status: agreed 2026-10-15. Round 1 of three friction points raised after several
weeks of real use; the other two (weather per day, medication read from Salud)
are separate specs.

Written in English to match PRODUCT.md, DESIGN.md and AGENTS.md. The app's own
copy stays Spanish.

## Why

Logging is retrospective by design (PRODUCT.md, Operating Context), and that is
still right. But the one fact a retrospective entry cannot recover is the hour
the walk started: by the time the tutor is home, 09:00 is a guess.

The workaround in use today proves both the need and the shape of the answer:
the walk is created in the street with a real start and a **provisional** end
one minute later, annotated mid-walk when the dog poops, and corrected to the
real end on getting home. The app should do that without the fiction of the
provisional minute.

## The decision that makes this cheap

**No schema change.** `pet_events.duration_minutes` is already nullable, and
`occurred_at` already means the start whenever a start is known
(`app/(tabs)/index.tsx` save path: with DESDE filled, `occurredAt = start`).
A walk in progress is therefore a row the table can already hold: a start, and
no length yet. `0006_events_weights_treatments.sql` calls such an entry
complete and valid in its own words.

The entry sheet, however, requires HASTA unconditionally, which is what makes
a midnight crossing unsaveable. Lifting that requirement is the one structural
change, and it falls out as the mirror of the rule `startWithinDay` already
encodes. The resulting invariant:

**A walk needs two times, or one time and a length.**

| DESDE | HASTA | Duration | `occurred_at` | `duration_minutes` |
| ----- | ----- | -------- | ------------- | ------------------ |
| yes   | yes   | derived  | start         | `minutesBetween`   |
| no    | yes   | typed    | end           | typed              |
| yes   | no    | typed    | start         | typed              |
| no    | yes   | —        | end           | `null`             |
| yes   | no    | —        | start         | `null`             |
| no    | no    | —        | refused       | —                  |

**Two of these rows became unreachable from the UI in round 2**
(`docs/plans/2026-10-16-walk-timer-round-2.md`, 2026-10-16). The duration field
is now read-only, so nothing can type one: the rows that say "typed" are
reachable only for lengths already stored, and the shape PRODUCT.md calls "we
got home at nine and were out about forty-five minutes" can no longer be
entered. `save` still honours all six — the table describes what the column
accepts, and leaving it intact is what keeps the change reversible — but a
builder reading this should not go looking for the control that fills them.

The last row with a start and no length **is** the walk in progress. There is no
special case, no flag in `details`, and no new screen: tapping the live row
opens the entry sheet that already exists, with its stool chips, which is what
serves the mid-walk annotation.

### Where "in progress" lives

On the device, not in Postgres. It is a fact about the app, not about the walk —
once the walk ends it never mattered. `lib/settings.tsx` already keeps
device-scoped state in AsyncStorage for the same reason.

Accepted cost: on the other tutor's phone the walk renders as an ordinary row
with no duration, and they cannot stop it. Revisit when pet sharing exists;
reading and editing a walk in progress across tutors is a feature of that work,
not of this one.

## The screen

The goal block is the only place on the day view that already talks about
walks, so it gains the control by **changing state**, not by growing one.
Nothing floats; the floating action and its menu are untouched.

| State          | Text                      | Bar                                | Control |
| -------------- | ------------------------- | ---------------------------------- | ------- |
| Idle, goal set | `34 min de 3h paseados`   | Mist, or Aqua when met             | start   |
| Idle, no goal  | `34 min paseados`         | absent                             | start   |
| Walking        | `De paseo · 18 min`, Aqua | Mist, plus the in-progress segment | stop    |
| Past day       | unchanged                 | unchanged                          | none    |
| Loading        | unchanged skeleton        | unchanged skeleton                 | none    |

**The no-goal state is new and is not optional.** `exercise_goal_minutes` is
nullable (`0001_initial_schema.sql`) and the whole block is gated on
`goal !== null`, so a pet whose tutor skipped the activity question — a field
PRODUCT.md marks optional and deferrable — has no block at all today. The block
now always renders; the goal and the bar are what come and go.

### The bar while walking

The bar keeps **Mist**. DESIGN.md's rule for this element is that it is neutral
while being read and Aqua as the conclusion, so a third meaning on the same
fill would cost the one it already carries. The state change is carried by the
text turning Aqua.

The minutes of the walk in progress are **not** stored, so the Mist fill still
measures only what is recorded, and the walk in progress is drawn as a
distinct, dimmer segment at the head of it. That segment is the only thing that
animates: it breathes, opacity only, the same vocabulary as `Skeleton` — **but
slower**, because an animation that runs for an hour has to be calmer than one
that runs for a second. Start at 2400ms against `Skeleton`'s 900 and settle it
on the device. Under "remove animations" it holds at the dim end, the line
`Skeleton` and `Celebration` already draw.

A left-to-right shimmer was considered and rejected: this app's only loading
idiom is a pulse, and a traverse would say "loading" on a bar that is not.

When the goal was already met before the walk started, the bar is full and
Aqua and there is no room for the segment; the counter in the text carries the
walk on its own.

### Which time a lone time means

A walk row with `occurred_at` and no duration is **ambiguous**: before this
feature it could only mean "the tutor logged the hour they got back and no
length", which the entry sheet reads into HASTA and which its own comments call
the fastest valid entry there is. After this feature a row of that exact shape
is also what a walk in progress looks like, where the time is the **start**.

Nothing in the row distinguishes them, and neither a column nor a key in
`details` is worth buying for it. So the day view tells the sheet: it opens the
walk it knows is running with the time meaning a start, and every other walk
unchanged. The sheet's default stays what it is today.

The residue, stated rather than hidden: a walk **abandoned** past 1440 minutes
loses the flag, so reopening it shows its start time under HASTA. That row is
already incomplete and has to be edited either way, and inventing a stored
marker to make a 24-hour-old mistake read better is the worse trade.

### The live row

The log is ascending, so the walk in progress is the **last** row, in its own
hour — not pinned to the top. Its time and glyph take Aqua and the detail line
reads `En marcha` where a duration would go. Tapping it opens the
entry sheet.

**It carries no counter, and this corrects what this spec first said.** The
first draft put the elapsed minutes in the row as well. `GoalBlock` owns its
own clock and ticking it does not re-render the day view, so the block could
read "De paseo · 1h" beside a row reading "En marcha · 0 min" — two clocks
contradicting each other on one screen, in a feature whose entire job is
elapsed time. Keeping them in step would cost a re-render of the whole log
every thirty seconds for a number already on screen two centimetres away. One
counter, and the block owns it.

### Copy

Visible text is the household voice; the accessibility label always says what
the control does, the split the birthday headline already makes.

**The icon carries the verb and the noun stays fixed:** a play glyph plus
`Paseo`, a stop glyph plus `Paseo`. Chosen over the warmer `¡Vamos de paseo!` /
`¡A casa!` for two reasons, and the second is the one that decided it:

- The label does not change width across the state change, so the block cannot
  shift under a thumb that is already reaching for it.
- `34 min de 3h paseados` plus `¡Vamos de paseo!` is 37 characters at 14dp in
  ~327dp of usable line and does not fit; with the glyph form the control sits
  beside the text in both states and the question of moving it below the bar
  goes away. Still measured at `font_scale` 1.3 before it is called done.

The warmth leaves this control, which is the trade. It is the right one here:
this is the most-pressed thing on the screen's most-used block, and a control
pressed twice a day earns its keep by being unmistakable rather than charming.

Accessibility labels: `Empezar paseo` / `Terminar paseo` — never the bare noun,
which is what the glyph is for.

**`Paseo` also labels the floating action's own walk entry** (`KINDS.walk.label`),
so the word appears twice on this screen for two different acts: starting a
timed walk, and logging one that already happened. Left as is deliberately —
the two never share a surface (one sits in the goal block behind a play glyph,
the other only exists inside an opened menu) and the accessibility labels
already differ. Worth re-reading on the device; worth renaming only if it reads
wrong there.

## Rules a builder must not invent

- The in-progress flag is never written to Postgres, as a column or as a key in
  `details`.
- STOP computes from instants (`getTime()`), never by re-reading the text
  fields. This is the only thing that survives the October clock change: a walk
  from 02:30 to 02:15 after the rollback is 45 real minutes, which
  `minutesBetween` returns correctly from instants and would refuse from parsed
  times of day.
- The walk is filed on the day it started, and the screen follows the walk
  rather than the clock.
- Start is offered on today only. There is no pause.
- The only accent this feature spends is Aqua Glaciar. Aurora Boreal does not
  enter — The Scarce Accent Rule.
- The device keeps the walk's **id**, not its start. The start is read back from
  the row, so there is one source for it and a clock the app cannot contradict.
- The minute counter is not a live region: a reader must not announce it every
  minute.
- Touch targets from `TOUCH_TARGET`; no callback `style` on a `Pressable`.

## Failure modes and their answers

1. **Midnight, the live row.** `AppState` → active past midnight advances both
   `today` and `day` (`index.tsx:376`), and the running walk's row then belongs
   to a day the screen is no longer on. Answer: while a walk is open, the screen
   stays on the walk's day. After STOP it stays there too — the header will read
   `Ayer`, which is correct, and the forward arrow is one tap.
2. **Midnight, the entry sheet.** Opening a crossed walk puts `00:10` in HASTA
   and `23:40` in DESDE, both re-parsed against the screen's day, so
   `minutesBetween` returns null and Guardar refuses an untouched entry. Answer:
   the mirror of `startWithinDay` — when start plus duration lands on another
   day, HASTA is empty and the duration is the fact.

   **Superseded in part on 2026-10-16:** this answer originally said "both
   steppers (`applyMinutes`, `editDuration`) gain the same mirror". Round 2
   deleted both, along with everything else that let a duration write into a
   time — that machinery is where this branch's two critical defects came
   from. The mirror itself survives where it matters, in `endWithinDay` and in
   what the sheet shows on opening a crossed walk.

3. **A typed crossing is still refused.** The app records a crossing it
   measured, because it holds both instants and guesses nothing. It still
   refuses a HASTA typed before its DESDE, which remains a mistyped digit far
   more often than a walk across midnight.
4. **Forgotten stop.** Past `MAX_WALK_MINUTES` (1440) the flag is dropped, the
   duration stays `null`, and nothing is written. Never clamp to 1440: that
   invents a 24-hour walk and the CHECK would be satisfied by a lie.
5. **Under a minute.** The row is deleted and nothing is said. A start and a
   stop in the same minute is a mis-tap, and the honest record of a mis-tap is
   nothing; the block returning to its idle state is the feedback.
6. **A write that fails.** Both controls write before the state changes.
   A failed insert leaves the block idle and says so through the screen's
   existing failure path; a failed update leaves the walk running so the tutor
   can press stop again. Neither control is optimistic: a walk that looks
   started and was not is worse than a tap that visibly did nothing.
7. **The app restarted mid-walk.** The flag survives in AsyncStorage; on
   relaunch the walk is found among the day's rows and the elapsed minutes
   recomputed from
   its `occurred_at`. If the row is gone — deleted on the other phone — the flag
   is dropped silently and the block returns to idle.

   **It is looked up in the day's rows rather than fetched by id, and that has
   a residue this spec first understated.** A walk that crossed midnight is not
   among today's rows either, so an app killed mid-walk at 00:10 cannot tell
   "deleted elsewhere" from "started yesterday", drops the flag, and leaves a
   walk with a start and no length — the abandoned shape, reached after forty
   minutes rather than after twenty-four hours. Accepted for v0: nothing is
   lost and the row is editable. Fetching by id, or storing the start's day
   beside the id, separates the two cases when it is worth doing.

8. **Wrong day.** The walking state renders only when the day on screen is the
   walk's own day, never on a day reached with the arrows.
9. **The goal celebration.** It fires only when the walk's day is the day on
   screen, so closing a crossed walk cannot throw confetti over a day nobody is
   looking at.

## Out of scope

Pause. Cross-tutor visibility or control of a walk in progress. Notifications
or any ongoing-notification surface. Auto-detecting the end of a walk. Weather.
The medication read from Salud.

## Testing

- `lib/`: `endWithinDay` mirroring the existing `startWithinDay` cases,
  including the exact-midnight boundary and the 1440 edge; `minutesBetween`
  across a DST rollback.
- Sheet: an entry with DESDE and no HASTA saves; an entry with neither is
  refused; a crossed walk opens and saves untouched.
- e2e: start, the row appears last and is tappable, stop, the duration lands.
  Derive every time from a "now" the test owns — a fixed morning time on today
  is a test that fails half the day.
- Device: the idle line at `font_scale` 1.0 and 1.3; the breathing segment with
  and without "remove animations"; the 48dp floor on both controls.

## Open

Nothing blocking. The copy and the idle layout are settled by one measurement on
the device, not by another decision.
