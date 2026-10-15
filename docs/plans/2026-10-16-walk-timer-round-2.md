# Walk timer, round 2 — agreed scope

Picks up from `docs/specs/2026-10-15-walk-timer-design.md` and
`docs/plans/2026-10-15-walk-timer.md`, both shipped on `feat/walk-timer`
at v0.10.0. Everything here was agreed after a real walk on the device on
2026-10-15. Nothing in it is written yet.

## Where the branch stands

- Seven tasks, each reviewed; two task-level fix rounds; a whole-branch review
  on the most capable model; one fix wave of six commits; one scoped re-review,
  clean. Head `e044fb0`.
- 385 unit tests, 126 e2e, lint and `tsc` clean.
- v0.10.0 is installed on the Xiaomi and has been used for real walks.

### Device verification, from the real walk

| Check                       | Result                                                   |
| --------------------------- | -------------------------------------------------------- |
| Start control height        | **48.0 dp** exactly — Android's floor met                |
| Idle line, `font_scale` 1.0 | 244.6 dp measure + 72.3 dp control of 327.4 usable. Fits |
| Idle line, `font_scale` 1.3 | Fits clean, no ellipsis, no clipping                     |
| The tutor's own scale       | **0.9**, below default — real use has extra headroom     |

The glyph-plus-noun control is therefore justified by measurement rather than
by taste: the warmer `¡Vamos de paseo!` would not have fitted.

**Still unmeasured:** the breathing segment with and without "remove
animations", and the no-goal state on the device.

## 1. Cut the duration-to-time coupling, and with it the steppers

**Why, in one line: the `-15` / `+15` machinery is where both of this
branch's critical defects came from** — the one that destroyed a running
walk's start, and the one that walked it backwards on a second tap. They were
not two bugs living near the steppers; they were the steppers' bug in two
shapes. The tutor also never used the buttons in three weeks of real use.

Remove, because each exists only so a duration can write into a time:

- `STEP_MINUTES`, `startOnDay`, `endOnDay`
- the `derived` state and `moveDerived`
- `applyMinutes`
- the two stepper buttons and their testIDs
- the five `setDerived(null)` resets in `editAt`, `editFrom` and both walk
  `TimePicker`s

**Keep:** `showDuration` (two times → the duration shown) and `tidyDuration`,
which gets much simpler once it no longer re-derives.

**The duration field becomes read-only.** Agreed with the tutor: it was built
to speed up logging, and the faster, more intuitive path turned out to be the
two times. `save`'s three branches already read the fields independently, so
no case becomes unsavable — "HASTA plus a length" and "DESDE plus a length"
both still store correctly. What is lost is the auto-fill of the other time,
which is precisely what corrupted rows.

## 2. A running walk's times are not editable

While the sheet is open on the walk this device has running, DESDE, HASTA and
the duration are all disabled. The note and the stool chips stay editable —
they are why the row is tapped mid-walk at all.

Accepted cost: pressing start five minutes late can no longer be corrected
until the walk is stopped.

## 3. The remaining residual from the final review

`stop`'s `untouched` check reads the last fetched row, so between a mid-walk
save and the reload landing (normally well under a second) a sub-minute stop
could still delete a row that already has a note. Close it by treating a sheet
save on the running row as touched.

The other residual — typing a HASTA on a running walk letting a later stepper
tap overwrite the measured start — **disappears with items 1 and 2**, since
there are no steppers and the fields are disabled.

## 4. The live row's state text takes the accent

`En marcha` renders in the column's ordinary tone while the time and the glyph
beside it are already Aqua. Give the text the accent too.

Rejected, with the tutor's own reasoning: changing it to `De paseo...` would
say the same thing the goal block says four centimetres above.

## 5. A spinner while the start is being written

The already-shipped fix keeps the control on screen during the write, where it
used to vanish — confirmed on the device. What is still missing is any sign
that it is working, and **a control that is present but inert is what makes a
tutor tap it again**, which is the duplicate-walk failure this branch spent a
round closing. `GoalBlock` already receives `busy`; swap the glyph for an
activity indicator while it is true.

Real conditions that make this matter: starting the walk in the doorway, where
the phone is still holding a one-bar home wifi before it gives up and moves to
mobile data.

## 6. The control reads as text, not as a button

At `font_scale` 1.3 the control is Aqua semibold beside white semibold and
nothing says it is pressable.

**Agreed: variant C** — outlined when idle, filled when running. It is the
rule the app already applies three times (the selected day, the active tab,
the chosen segment: _the chosen one is the filled one_), and a walk in
progress is an active state where an idle button is an offer. **Variant A**
(filled in both states) is the fallback if C does not convince on the device.

**Build both and screenshot them side by side on the phone before choosing.**

**A measurement this needs before it can be called done:** at `font_scale` 1.3
the control already ended exactly at the right margin. A pill adds horizontal
padding — `px-4` overflows by roughly 20 dp and would ellipsize the measure.
`px-3` is the likely answer, but it is a device measurement, not a decision to
take at a desk.

## Not in this round

Recorded in PRODUCT.md: the stool glyphs restyled toward the familiar emoji,
the walk's activity level as a five-step optional field, `De paseo con <tutor>`
once sharing exists, an A/B of the steppers if there are ever enough testers,
and a minimum width for the in-progress segment so it is visible in a walk's
first minutes.
