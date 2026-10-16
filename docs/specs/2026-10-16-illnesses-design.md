# Illnesses — design

Status: agreed 2026-10-16, in conversation with the tutor. Not yet planned.

Written in English to match PRODUCT.md, DESIGN.md and AGENTS.md. The app's own
copy stays Spanish.

## Why

On 2026-09-11 the tutor recorded "Diarrea y vómitos" at 11:30 and three
medications at 11:31. PRODUCT.md filed that as evidence the data model had no
episodes — four rows that are one event, held together by nothing but a
timestamp.

Asked about it five weeks later, the tutor said what actually happened:

> Seguramente a las 11:30 salí del veterinario con la medicación para Loki,
> casi seguro flora y la recomendación de algún pienso húmedo de tipo gastro.
> De ahí la adición de los medicamentos inmediatamente después, simplemente
> para no perder el registro de cada uno, no por haber suministrado en ese
> instante.

**Those three rows were not three doses given. They were a prescription being
written down.** The diary says "this happened at this time", and it was being
used as a holding pen for "the vet just gave us these". The times were false in
all three, and nothing tied them to the diagnosis they came from.

The tutor also established that **every medication Loki gets comes from the
vet** — there are no household doses, and the kefir that stands in for a
probiotic goes in the food, not in a medication record. The diary's own
`Medicación` entry kind survives only because the diary existed before the
Salud tab did, and nobody wanted to lose records during the build.

## The boundary this rests on

**The diary records what happens to the dog. Salud records what is decided
about him.**

A walk happens. A meal happens. An accident, a fight with another dog, a
sudden limp, swallowing something dangerous — they happen, and nobody
prescribed them. That is the diary.

A vaccine is decided. A deworming is decided. A weighing is a measurement, and
belongs to the growth curve even when it is done at home. An illness starts
with a diagnosis and continues with a course: also decided. That is Salud.

The tutor found the same split in their pet insurance, which is a useful
outside check that this is not a distinction of our own invention:

|              | Waiting period | Where it lives           | What it is                                      |
| ------------ | -------------- | ------------------------ | ----------------------------------------------- |
| **Accident** | 5 days         | Incidencia, in the diary | Something happened to him                       |
| **Illness**  | 28 days        | This feature, in Salud   | He has something, with a diagnosis and a course |

An insurer separating them by five days against twenty-eight is pricing a real
difference in kind.

## What an illness record is

Three fields. The tutor wrote the shape themselves:

- **A start date.** Only the start. _"No se sabe cuánto va a durar la
  enfermedad en el momento que algo se sale de lo normal."_ There is no end
  date, no status and no "resolved" — the duration is read afterwards from how
  long the treatment ran.
- **A title.** `Vómitos y diarrea`.
- **A description, in Markdown.** Everything else lives here as prose the vet
  dictated and a human reads: the diagnosis, the treatment and the schedule.

The tutor's own example, which is the acceptance criterion for the field:

```markdown
Posible infección parasitaria por giardias.

## Tratamiento

- Flora: 1 sobre al día durante 7 días.
- Panicur: pastilla desparasitaria. 1/día.
- Comida húmeda gastrointestinal... Lata y media al día hasta que se corte
  la diarrea y se estabilicen las kakas.

## Pauta

Separar la flora de la pastilla anti-parasitaria durante al menos 4h entre
comidas. Ejemplo: dar la flora en la ración del desayuno cuando el estómago
está más sensible y la pastilla en la ración del almuerzo separado por 6h.
```

**The description is deliberately unstructured, and that is the design, not a
shortcut.** A structured plan — drug, dose, frequency, duration — was the
obvious thing to build and would have lost the sentence that mattered most:
_"la flora en el desayuno cuando el estómago está más sensible y la pastilla
en el almuerzo separado por 6h"_. No schema invented at a desk would have had
a field for that.

The app already does this: the vet card's HORARIO is a Markdown textarea that
renders on the reading side, with `MarkdownHelp` beside it.

## What the tutor does with it

At nine in the evening on the second day, about to feed the dog, the gesture
is **to read the schedule** — not to tick anything. That is the whole job of
the record.

The separate question, _"has he already had today's pill?"_, is answered
elsewhere and is **not** in scope here. See Deferred.

## Where it appears

Three surfaces, following the pattern the treatments feature established on
2026-10-16:

1. **Salud** — created, edited and listed here. This is the only place it is
   written.
2. **The diary** — read-only on its start date, the way a treatment is. The
   argument is the one the tutor gave for treatments and repeated here: a day
   that reads oddly is explained by what started that day, and the connection
   is only available if both are on screen at once.
3. **The calendar** — marked.

### The calendar mark

**Illnesses take the existing red mark, alongside incidents. No third hue.**

The tutor's reason: both are out of the ordinary and probably end in a vet
visit, and distinguishing them does not change what the tutor does. The
stronger reason: the calendar's job is to find the day something went wrong,
not to classify it — the day itself says which. DESIGN.md also forbids a third
alarm hue outright.

And the pattern the tutor described — _"varios días seguidos con puntitos
ámbar por medicación, después de un día con un punto rojo"_ — is legible
precisely because there are two hues and not three. Subdividing red would blur
the shape it depends on.

**Stated honestly: that amber run does not exist today.** Amber marks
medication, and daily doses are recorded nowhere yet. The shape the tutor
described is an argument for the deferred checklist, not a description of
what this feature will draw.

## Goals

- A prescription has a home, so it stops being typed into the diary as doses
  that were never given.
- The diagnosis and the schedule are readable in one place, at the moment they
  are needed.
- An illness is visible from the day it started, in the diary and the calendar.

## Non-goals

- Structuring the treatment. The description is prose.
- An end date, a status, or any notion of "resolved".
- Reminders, notifications or anything that pushes.
- Linking an illness to the diary's incidents, treatments or meals.
- Changing what the diary's `Medicación` entry does.

## Anti-goals — what would make this a failure even if it worked

- **A second place to record the same thing.** This feature exists because
  there was one; shipping another would be worse than shipping nothing. If a
  tutor ends up with both an incident and an illness for one event, the
  boundary was not drawn clearly enough in the UI.
- **A form that asks for more than the vet said.** Required fields the tutor
  cannot fill at the vet's door will be filled with noise or skip the record
  entirely.
- **Drifting from the diary's own idiom.** This is the same app; an illness
  sheet that looks like a different product has failed even if the data is
  right.

## Constraints

- A new table with its own migration — the first since `0006`. It follows that
  file's rules: RLS through `public.is_pet_owner`, four policies rather than
  one `FOR ALL`, revoke-then-grant, and `created_by` defaulting to `auth.uid()`
  and nulling on delete so a departing account does not take the animal's
  history with it.
- `started_on` is a `date`, not a timestamp — the same reasoning as
  `pet_treatments.administered_on`, and the same trap to avoid: compare date
  strings, never build a `Date` from one.
- Nothing is computed from an illness, so by PRODUCT.md's rule it would not
  earn columns — but it is not a diary entry either, and `pet_events` is for
  things that happened at a time. A table of its own is the honest shape.
- The description renders through the existing `Markdown` component; the
  editor is a Markdown textarea with `MarkdownHelp`, as the vet card's HORARIO
  already is.
- Everything in AGENTS.md: pnpm, strict TypeScript, no `any`, no raw hex, no
  callback `style` on a `Pressable`, `TOUCH_TARGET`, `Text` from
  `components/ui`, no `@supabase/supabase-js` outside `lib/`, Conventional
  Commits, a version bump and a CHANGELOG entry with the work.

## What this displaces

`app/(tabs)/health.tsx` already has an **ENFERMEDADES** section, and it
currently lists the diary's incidents, read-only, each leading to its day.
That was the cheap half of this feature, shipped as a placeholder. It now
becomes the real thing, and incidents stop appearing there — they are
accidents, and they live in the diary.

**Existing records the tutor will move by hand.** Loki's diary holds incidents
that are really illnesses — the vomit of 14 October among them. The tutor
already did this once, deleting the duplicated Milbemax themselves, and
prefers it to a migration that guesses.

## Deferred, with the tutor's agreement

- **The daily treatment checklist.** The schedule as tickable tasks in the
  diary's treatments section — one box for the flora, one for the pill —
  answering _"¿ya le has dado la pastilla de hoy?"_ without either tutor
  having to ask the other. This was proposed and deliberately held back:
  _"anota esta idea porque me gustaría desarrollarla en el futuro, de momento
  empezaremos con algo más sencillo y genérico."_ It needs daily state, a
  model for a course, and two-tutor coordination, and it is the feature that
  makes the amber run above real.
- **Closing the diary's `Medicación` door.** It cannot close until the
  checklist exists: until then the diary is the only place to note that
  today's dose was given. The controller previously tied this to illnesses
  shipping and was wrong — recorded here so the plan is not repeated.
- **Consultations.** A vet visit with no particular reason — the annual check
  in December — carrying notes and decisions: the half-natural diet, whether
  and when to neuter. PRODUCT.md has described it since 2026-09-07 and it has
  never been built. It is a point in time with notes, where an illness has a
  cause and a course; an illness can contain several consultations and a
  consultation can exist without an illness. Its own feature, next.

## Settled after the builder check — the author's calls

A fresh engineer read this document cold and asked what they would have to
guess. These are the answers; each is the author's call, not the tutor's, and
each is here so the plan does not re-derive it.

- **The diary's row taps through**, exactly as a treatment's does: a chevron,
  `router.push("/health?illness=<id>")`, and the `?treatment=` machinery in
  `app/(tabs)/health.tsx` mirrored for a second parameter — applied during
  render against a remembered value, cleared in an effect, held until the rows
  load. "Read-only on its start date, the way a treatment is" was meant to
  settle this and did not say so.
- **The calendar keeps one red dot and grows a second reason for it.**
  `CalendarMark` gains `hasIllness` beside `hasIncident`; both draw the same
  mark. The legend reads `Incidencia o enfermedad`, and a day's spoken name
  says which of the two it has, or both. The hue is shared because the two are
  the same kind of alarm; the words are not, because `MonthCalendar` currently
  announces "con incidencia" and that would be false on an illness-only day.
- **The illness gets its own diary section, above TRATAMIENTOS** and below the
  goal block — the cause before the consequence. Not inside TRATAMIENTOS: an
  illness is not one, and DESIGN.md has a row wear the hue that put it on the
  calendar, so a red row in an amber section would break that section's rule.
- **That section copies the treatments section's states verbatim**: nothing
  while unread, nothing when empty, and **nothing at all on a failed read** —
  no heading, no message, no button. The reasoning transfers exactly, because
  it is the same shape of read: the whole history, filtered by day, so a
  failure is about the list and not about the day.
- **The calendar needs its own window clip.** An illness outside the events
  window would otherwise draw red on a day the grid never read — the precise
  defect `treatmentsSince` and `marksForMonths`' null gate exist to prevent,
  and which has unit tests. The document did not name it; the code makes it
  unmissable.
- **Fields:** `started_on date not null`, defaulted to today in the sheet and
  limited to the past (`DateField`'s `reach="past"`); `title text not null`
  with a non-blank check in `lib/`, the way `validatePetDraft` does it;
  `description text` nullable — the vet's door is exactly where you have the
  name and not yet the protocol.
- **An illness can be deleted**, through a `Borrar` danger link in its sheet,
  as `WeightSheet` and `TreatmentSheet` already have.
- **`PRODUCT.md:82` is rewritten in the same work.** It still specifies an
  optional end date, a symptoms field and treatments hanging off the illness —
  three things this design removes on purpose. Leaving it would make the live
  decision record contradict what shipped.
- **`incidentsFor` in `lib/events.ts` becomes dead** once Salud stops listing
  incidents; it goes, with its coverage.

## A limit of the Markdown renderer, found by testing the example above

The acceptance-criterion example renders correctly today — headings, bullets
and a hanging-indent continuation all work. What `components/ui/Markdown.tsx`
does **not** support: ordered lists, nested bullets, links, tables, or `#`.
A protocol written `1. Flora…` renders as a paragraph with the digits visible.
Not broken, but not a list, and `MarkdownHelp` does not mention it, so nobody
would learn why.

A vet's protocol is at least as likely to be numbered as bulleted. **Open for
the tutor** — see below.

Separately: every current caller of this renderer passes one short paragraph,
two of them clamped to three lines. A heading renders at `text-xs` in the
accent colour — _smaller_ than body text — so a long description is two tiny
labels over normal prose. That may be right; AGENTS.md's rule applies and it
has to be looked at on the device before it is called done.

## Answered by the tutor, 2026-10-16

1. **An incident is found by the calendar's red dot and by the day it sits
   in.** The tutor accepts that consciously: paging the grid for a red mark
   and then reading the day is the answer until there is a better one. The
   better one is **text search** — _"pelea con…"_, _"golpe contra…"_ — which
   PRODUCT.md deferred once already (2026-09-10: finding an entry by its words
   is a separate tool, a full-screen result list and not a calendar). This
   design does not re-open it; it adds a second reason to build it.

   **So the regression is accepted, not overlooked**, and the CHANGELOG says
   so in those terms rather than quietly.

2. **Nothing in the UI distinguishes the two, by decision.** _"De momento no
   se diferencia, sólo son puntos que llaman la atención en el calendario o
   sus respectivas pestañas."_ Anti-goal 1 is relaxed accordingly: a tutor who
   files one as the other has filed it where they thought of it, and the red
   dot finds it either way. **Nothing in the diary changes.**

3. **The renderer learns ordered lists.** See below.

## Ordered lists in the Markdown renderer

`components/ui/Markdown.tsx` splits on blank lines and knows three block
shapes: a `## `/`### ` heading, a `- ` list, and a paragraph. An ordered list
is the symmetric fourth — a block whose first line matches `\d+\. `, split on
`\n(?=\d+\. )`, rendering its own numbers rather than the typed ones so a
mis-numbered list still reads in order.

It is small, and it belongs with this feature because a vet's protocol is as
likely to be numbered as bulleted. `MarkdownHelp` gains the line. **Nested
lists, links and tables stay out** — nothing here has wanted them, and each is
a parser rather than a branch.

## Left to the builder

- The sheet's layout, within the app's existing form idiom.
- Whether the Salud list paginates, and at what length.
- The exact wording of labels and the empty state, following `clarify`'s voice.
- Whether the diary's row for an illness reuses the treatments section or sits
  in one of its own — the treatments section is titled TRATAMIENTOS and an
  illness is not one.
