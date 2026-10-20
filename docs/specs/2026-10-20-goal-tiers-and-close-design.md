# The goal's two tiers, and the close that lands on it — design

Status: **agreed 2026-10-20**, in conversation with the tutor. Third draft: a
builder check found the first unbuildable, and the second was settled on an
artboard. Not yet planned.

Written in English to match PRODUCT.md, DESIGN.md and AGENTS.md. The app's own
copy stays Spanish.

## Why these two are one document

They are the same bar. The close is the animation that runs when a walk lands
on it; the tiers change what the bar is measuring. Designing either alone would
mean designing the close twice — once for a bar that ends at one number, once
for a bar that ends at two.

Both come from the walk of the evening of the 19th: the tutor filmed the close,
and looking at it asked why the goal had become hard to reach at all.

---

# Part A — the close

## What is wrong, measured

Frames pulled from the tutor's video at 0.2 s intervals:

| t             | the bar                                                  |
| ------------- | -------------------------------------------------------- |
| 8.6 s         | walking: saved minutes to x=403, the live segment beyond |
| **8.8–9.0 s** | **painted only to x=207 — the bar has lost the walk**    |
| 9.2 s         | back to x=405, the stretch now in the saved tone         |

**The bar shrinks for about 400 ms and then grows back** — half the length of
the close animation, immediately before it.

The cause is a timing seam. When the walk stops, `walkingSince` goes null at
once and the live segment unmounts with it, but the closed minutes do not reach
`walkedMinutes` until the reload returns. For those 400 ms the bar tells the
truth of a minute ago.

The animation that then runs — the stretch swelling 4 → 7 dp — the tutor called
_tosca_, and the word fits the sequence more than the beat: a square widening
arriving after a stumble.

## What replaces it

**The live segment stays painted, and a fill converts it left to right.**

This is the single most important sentence in Part A, and the first draft left
it ambiguous. The fill does **not** grow into empty track from the junction: if
it did, its first frame would be the x=207 frame the tutor complained about,
and the drop would survive. The segment that is already on screen is held, and
the animation travels along it, turning it from the in-progress tone into the
tone it will keep — then continues to the stretch's true end.

- **Origin:** the junction — where the saved minutes stop. Not _the tick_: the
  tick is not drawn on the first walk of the day or once the goal is met, and
  the first walk of the day happens daily. The origin is the position, which is
  `0` when nothing is recorded yet, and that is correct.
- **Not reaching the next tier:** the converted stretch lands in the saved tone
  and stops. Where a tick was drawn, it has nothing left to separate and goes.
- **Reaching the next tier:** the same conversion, and on arrival the whole lap
  transitions to that tier's tone, with the confetti.

The swell goes. The sheen goes with it: it existed to light the swollen stretch,
and a directional conversion is its own emphasis.

## Why this removes the 400 ms hole

Both ends of the fill are known **before the reload lands**:

- the origin is the junction, which is `recorded` — the pre-close total the
  component already holds;
- the end is that value plus the minutes just closed, which `stop` knows the
  moment the server accepts.

Today's `fresh` gate exists because the stretch was computed by _subtracting_
the closed minutes from a total that might or might not include them yet —
stale input, wrong stretch, a real defect that cost a fix round on this branch.
Anchoring at the junction and _adding_ makes the stale value correct by
construction.

**The live segment's right edge is not the fill's end.** `running` comes from
`elapsedMinutes`, refreshed every 30 s, while the end is `recorded +
closedMinutes`; they differ by up to a minute's width. The conversion therefore
has to reconcile them — the fill travels to the true end, past or short of where
the segment was painted. Visible only as the stretch settling a hair, and only
worth saying because a builder must not assume they are the same number.

## The handover, which is the hard part

When the reload lands, `walkedMinutes` grows and `recorded` jumps. That must not
be visible. Two halves, and the first draft stated only one:

- **Width.** The fill must already be painted where the data is about to say. If
  the reload is slower than the animation, nothing moves when it arrives; if it
  is faster, the fill must not restart.
- **Tone.** When the reload lands mid-animation, `met` flips and the fill
  underneath turns the tier's tone _before_ the animation has arrived there.
  Today this cannot happen, because `fresh` guarantees the data landed first.
  Remove the gate and it can. A builder who fixes only the width will ship a bar
  that turns colour a quarter of a second early.

**No frame may show the bar in two minds, in width or in tone.**

## The cases the first draft missed

- **Nothing was added.** A walk discarded as a mis-tap, or abandoned. No
  animation: there is nothing to say.
- **Past the top tier.** The bar is full on both laps and a close adds minutes
  that cannot be shown. No fill — there is no stretch — and no swell, since the
  swell is gone. **The day is already said; the close says nothing more.** This
  is a deliberate silence, not an oversight.
- **The reload fails.** The fill has animated to a value the data never
  confirms. It must hold at its end state rather than snapping back, and the
  failure is the toast's job, not the bar's. This is the path PRODUCT.md already
  records as open — a failed action must not take the diary away — and whichever
  lands first, the other must not reintroduce the snap.
- **Reduced motion.** "Absent" here means the bar is painted at the fill's **end
  state immediately on the stop** — no animation and no hole. Reverting to
  today's behaviour would restore the 400 ms gap for exactly the tutors who
  asked for less movement.

---

# Part B — two tiers

## The finding that reframed this

The tutor's premise was that a goal which is hard to reach is set wrong. True
here, but there was a second explanation that fits the dates better: **the ruler
changed in the same month.** Four walks at forty is 160 against a goal of 180.
In September the goal was met nearly every day — and in September the 11 a.m.
café outing counted. Dropping it removed the 20–30 minutes that made the
difference.

So the question was never "was 3 h too much" but "what is a normal day worth,
measured the new way".

## Is the café outing a walk?

**No, and the tutor's instinct is right — with one correction.** The figure is
minutes _walked_, standing in for exercise and stimulation; a dog lying still
under a table is neither. But the transit is: ten minutes there and ten back are
twenty minutes of walking and sniffing. The honest number is the transit, not
the whole outing and not zero.

Whether to log it that way is the tutor's call per walk, and it moves the
arithmetic. Open — see the questions.

## What the tiers mean

The tutor's own metaphor, which settles the semantics better than a table:

> One meal a day is the minimum to survive in good condition, but it is not
> ideal — two or three is. A day with only one meal happens: a feast that leaves
> you with no appetite by dinner. Is it a risk? No. Is it worth marking on the
> map? Yes. And the moment you look at the detail and find it was a birthday
> lunch, it explains itself.

|            | meaning                        | the tutor's own example                                     |
| ---------- | ------------------------------ | ----------------------------------------------------------- |
| **Tier 0** | below the habitual and healthy | a sedentary, stormy, low or injured day                     |
| **Tier 1** | what was needed was done       | a normal day — the café, the errands, some regular exercise |
| **Tier 2** | an exceptional day             | a run, the mountain, a day walking a city as a tourist      |

**Tier 0 does not judge whether it was enough.** It says the day was below the
usual, and the explanation comes from the day itself — a vaccine icon on the
calendar, a medication that left him sleepy, an accident that forced rest, or
(deferred, see non-goals) the weather. That is what keeps Tier 0 informative
instead of a scold, and it is the anti-goal this design most needs to honour.

## The numbers

**Tier 1 = 2 h. Tier 2 = 4 h, computed as double.**

Tier 1 is the tutor's, from last month's actual days: most or all clear 2 h,
some narrowly. It admits the two shapes of an ordinary day — four walks of
thirty, and three of forty.

A note, because it looked like a contradiction and is not. The tutor also said
that three walks instead of four _feels_ like less than normal, and three of
forty is exactly 2 h. Both are true and the metaphor reconciles them: feeling
slightly short of your own habit is not the same as falling below the healthy
minimum. Tier 1 is the floor, not the habit.

**Tier 2 as double is a better number than it looks**, and for a reason beyond
arithmetic: with two laps on one track (below), double makes the two laps the
same length. The bar fills twice, and the second time is literally another whole
day. The form carries the meaning with no legend. The tutor's doubt — whether
something so linear captures a championship day — is fair, and the answer is
that it is reachable: three ordinary walks plus a mountain walk of two hours
is 4 h, and a mountain walk that doubles or triples the typical forty is exactly
what the tutor described.

### Tier 2 is computed, not configured — my call

No second column, no second form field. Reasons:

- One number to set is the app's existing contract, and the second number is one
  the tutor would have no basis to choose.
- Double is what makes the two laps equal, which is the whole visual argument.
- **It removes the migration entirely.** Part B's data cost drops to nothing: no
  new column, no generated-types change, no README Arquitectura update, no
  migration against the one row that exists.

The cost is the extremes: a 30-minute goal gives a 1 h Tier 2 that may be
trivial, a 4 h goal gives 8 h that is unreachable. One household, one goal of
2 h, so neither is live today. **Reversible on purpose:** changing a formula is
one line, and adding the field later is easy. Removing a field once tutors have
set it is not.

## How the bar reads

**The ground is the highest tier reached; the fill is progress toward the next.**

- Below Tier 1: empty track, Mist filling.
- At Tier 1: **the whole bar turns Aqua**, as it does today, and violet begins
  to fill over it.
- At Tier 2: the whole bar turns violet.

The bar is cumulative and there is only ever one of it: each lap paints over
the one below, so a day on lap two still shows that lap one was completed.

**This was settled on an artboard against the tutor's own first description**,
which was the same idea read literally: Mist fills lap one, and _then_ Aqua
begins to paint over it progressively. The fissure is in one column, and it is
the commonest day there is — a day that reaches Tier 1 and stops shows the bar
**entirely Mist and not a trace of Aqua**. Aqua is currently the whole signal
for "met", on the bar and in the calendar's miniature of it, so eighteen days a
month would be marked in the colour that today means _not_ met. The tutor's
words on choosing otherwise: _"no quiero perder el hito de objetivo conseguido
y que cambie a Aqua para ilustrarlo."_

**The trade the tutor accepted, in their own framing.** Aqua now appears on
every ordinary day rather than being saved for the moment of arriving. What
stays rare is the violet, and that is where the surprise was always meant to
live: the first mountain day after this ships is _"un día que anotar en el
calendario"_ — in consonance with the birthday's own empty state.

**Saved and in-progress stay distinguished on every lap.** Within the current
lap's fill, the saved minutes are a tone lighter than the ones accumulating,
with the tick between them — exactly as now. The tiers are orthogonal to that;
all that changes is which pair of tones the lap wears. Lap two's pair is a
saved violet and a live violet a step below it.

### What the bar shows, case by case

The first draft left these undefined and a builder could not have proceeded.

- **Crossing Tier 1 during a walk.** The live minutes carry the bar to the end
  of lap one and it completes, turning Aqua, with the confetti — mid-walk, as it
  already does today. The bar then starts lap two and the live segment continues
  on it. The in-progress tone is unchanged on both laps.
- **Opening a walk already past Tier 1.** The bar is on lap two: its ground is
  the empty track again, its fill is the lap-two minutes. Lap one's completion
  is no longer on the bar — it is in the measure's words and in the calendar's
  mark.
- **A close that crosses a lap boundary.** **One animation, whose origin is the
  tick, even though it changes tier on the way.** The fill leaves the tick and
  converts what is left of lap one; on reaching the right edge the whole bar
  turns Aqua and the confetti falls, once; the same fill then continues from the
  left edge in violet over that Aqua, to wherever the walk ended. Not two
  animations in sequence — one gesture that changes colour as it passes a
  threshold. A walk long enough to cross both tiers does it twice, by the same
  rule.
- **The tick on lap two.** The tick marks the saved/live junction, which exists
  on either lap and is drawn by the same rule it has now. It does **not** mark
  the lap boundary; the first draft claimed it did and the code refuses to draw
  it at x=0, which is where a lap boundary sits.

## The colour

Aurora Boreal for Tier 2, on the bar **and** on the calendar. The tutor's call,
and better than my first recommendation.

My draft proposed violet on the bar and Aqua on the calendar, which would have
broken **The Shared Mark Rule** (DESIGN.md): a mark that stands for a record
wears that record's colour wherever it appears, which is why a goal met is Aqua
in the day's bar and in the calendar's miniature of it. One state in two colours
on two surfaces is exactly what that rule forbids, and my draft cited the Scarce
Accent Rule instead — the wrong rule. The tutor's answer keeps the mark whole.

The tutor's reasoning on the birthday collision, recorded because it is the
argument: the birthday is a watermark _behind_ the number, once a year; Tier 2
replaces the colour of the bar _under_ it. Different element, different
position. And if the violet appears often, that is a goal set wrong or a
circumstance — a holiday, a week with a trainer — which is itself worth seeing.

**One fact the tutor should weigh, which the first draft omitted.** Violet on
the goal bar was built and photographed on the device, and rejected: DESIGN.md
and PRODUCT.md record that of three Aurora/Aqua assignments tried, the one that
spent Aurora on the goal bar saw it "become the app's background texture rather
than its punctuation". That was the everyday met state — eighteen days a month —
where Tier 2 is a few. It is not a refutation. It is a prior finding on this
exact surface, and the draft presented that surface as untested.

## Data

**Nothing.** Tier 1 is the existing `exercise_goal_minutes`, unchanged and still
holding the household's own number. Tier 2 is derived. No migration, no form
field, no generated types.

**A tutor with no goal keeps today's behaviour exactly**: no bar on the day view,
no underline on the calendar. The tiers are a reading of a goal, not a
requirement to have one.

## Goals, non-goals, anti-goals

**Goals.** A floor an ordinary day reaches. A ceiling a championship day
reaches. A bar that completes on a normal day. A Tier 0 that reads as "this day
had a reason".

**Non-goals.** Suggesting the numbers from history — the activity question
PRODUCT.md already defers. Changing what counts as a walk. **The weather**: it
belongs with Tier 0 and is the commonest explanation, but it is a feature with a
location permission and an API, deferred since September, and this design must
not pretend to contain it.

**Anti-goals.** A bar a normal day cannot fill. A violet common enough to stop
meaning anything. **A Tier 0 that reads as a telling-off** — the dog was ill, and
the app is not disappointed in anybody.

## What this touches

Named explicitly, as the illnesses design does: `lib/goalbar.ts` and its tests
(`closeMotion`'s contract inverts from subtract to add, and its three cases do
not survive two laps), `components/ui/GoalBlock.tsx`, `app/(tabs)/index.tsx`
(the `fresh` gate goes), `components/ui/MonthCalendar.tsx` and its legend —
which gains a fourth entry in a row that already wraps at a large font scale —
plus `e2e/home.spec.ts`, `DESIGN.md`, `CHANGELOG.md` and the `package.json` bump
in the same commit.

## What is left to the builder

The mechanism of the handover. Where lap state lives. How the live segment is
held through the close. The confetti's threshold is **Tier 1 only** — PRODUCT.md
already records the effect as near wearing out at eighteen times a month, and
the tutor's complaint in Part A was loudness; Tier 2 gets the colour and nothing
else. All the platform constraints in AGENTS.md.

---

## Questions for the tutor

1. ~~The Spanish.~~ **Answered, provisionally:** Tier 1 keeps _"Objetivo
   conseguido"_; Tier 2 is _"Objetivo conseguido x2"_, which leans on Tier 2
   being defined as double. The tutor marked it as for now, so it is the
   placeholder a better phrase would replace, not a decision to defend.
2. ~~The café outing.~~ **Answered, and the tutor's practice is cleaner than
   the design's suggestion.** The weekday outing is under five minutes each way
   and is not logged at all. At the weekend, when the bar is in another village
   and each leg is over ten minutes, the two legs are logged as **two separate
   walks** — rather than one walk with the sitting subtracted. That also closes
   the September arithmetic: what stopped being counted was not thirty minutes
   of walking but a whole outing of which most was a dog lying still. The 3 h of
   September were never 3 h of walking.
3. ~~Scope.~~ **Answered: together with the walk timer**, because it is the same
   bar, the same animations and the same styles.
4. **On lap two, what does the measure read?** Still open: the day's total
   against the top tier ("3h de 4h"), which is what the artboard assumes, or
   what is left of this lap.
