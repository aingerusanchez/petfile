import { Clock } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import {
  clockDigits,
  DIAL_MARKS,
  formatClock,
  halfOf,
  hourAt,
  markFromPoint,
  markOfHour,
  markPoint,
  parseClock,
  type DayHalf,
} from "../../lib/clock";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * An hour and a minute, set on a clock face.
 *
 * **The same bargain the date field struck.** A time is faster to type than to
 * browse — "915" is two seconds — so typing stays the whole width of the field
 * and this is a glyph beside it, for the tutor who would rather not aim at a
 * number pad and for the one who cannot.
 *
 * **A clock, because everybody already owns this instruction.** The first
 * version of this was a strip of hour chips and a grid of minutes: correct,
 * legible, and a control nobody has ever used before. A face with a hand on it
 * needs no learning at all, and it answers "is that morning or evening" in the
 * shape of the thing rather than in a digit.
 *
 * **One ring and a switch, rather than two rings.** Material's 24-hour dial
 * nests a second ring inside the first; on this phone that puts its numbers
 * 38dp apart, well under the 48dp floor measured and enforced everywhere else
 * here (`TOUCH_TARGET`). So the face keeps twelve marks at 54dp of separation
 * and a two-way switch says which half of the day they are labelled with. The
 * hand does not move when the half changes — 09 and 21 are the same place on a
 * clock — so the switch reads as relabelling rather than as a jump.
 *
 * **Tap a number or drag the hand; both land on the same value.** The numbers
 * are real buttons, which is what a screen reader needs and what the suite
 * drives; the drag is the gesture the hardware invites and snaps to the minute.
 *
 * **An off-grid minute is kept, not rounded.** Opening this on 09:47 puts the
 * hand on 47 with no label under it and a dot at the tip: confirming without
 * touching anything gives back the time it opened with. Rounding on open would
 * be the picker quietly editing a value nobody asked it to touch.
 */

/** Which half of the header — and so the face — is being set. */
type Mode = "hour" | "minute";

const MINUTES_IN_HOUR = 60;
/** Every fifth minute is labelled; the other 55 are still reachable by drag. */
const MINUTE_LABEL_STEP = 5;
/** The disc under the selected number. */
const KNOB = 22;
/**
 * The hand's tip when it lands between two numbers.
 *
 * **A disc there would cover a number it has not selected.** Measured on the
 * device at 18:07: the full knob sat half over the "05" and read as though
 * five were chosen and smudged. A number gets the disc; a gap gets a point,
 * which is also the honest difference between "this one" and "between these".
 */
const TIP = 7;
/** The twelve places a number can sit, whatever it is labelled with. */
const MARKS = Array.from({ length: DIAL_MARKS }, (_, mark) => mark);

export function TimePicker({
  /** The field's current text, whatever state it is in. */
  value,
  onChange,
  label,
  testID,
}: {
  value: string;
  onChange: (time: string) => void;
  /** The field this belongs to, for the accessible name. */
  label: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Elegir la hora`}
        style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
        className="items-center justify-center active:opacity-70"
      >
        <Clock size={18} color={colors.textTertiary} />
      </Pressable>

      {/* Mounted only while open, so every visit starts from the field's
          current value rather than from where the last visit left the dial. */}
      {open ? (
        <Dial
          label={label}
          value={value}
          onClose={() => setOpen(false)}
          onConfirm={(time) => {
            onChange(time);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function Dial({
  label,
  value,
  onClose,
  onConfirm,
}: {
  label: string;
  value: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
}) {
  const { width } = useWindowDimensions();
  // Opens on what the field says, or on the clock when it says nothing — the
  // same default the entry sheet itself uses for a new entry.
  const start = useMemo(() => parseClock(value) ?? nowClock(), [value]);

  const [hour, setHour] = useState(start.hour);
  const [minute, setMinute] = useState(start.minute);
  const [mode, setMode] = useState<Mode>("hour");
  const [half, setHalf] = useState<DayHalf>(halfOf(start.hour));

  /** The face's own square, in window coordinates, and its measured side. */
  const faceRef = useRef({ x: 0, y: 0, side: 0 });
  const faceView = useRef<View>(null);

  // The sheet scrolls, so where the face sits on screen is only known once it
  // is on it. Measured on layout and again when a finger goes down.
  function measure() {
    faceView.current?.measureInWindow((x, y, side) => {
      faceRef.current = { x, y, side };
    });
  }

  function showHalf(next: DayHalf) {
    setHalf(next);
    // The switch is live in both modes: it relabels the face while the hour is
    // being set, and it still means "the other half of the day" while the
    // minute is, so it never becomes an inert control.
    setHour((was) => hourAt(markOfHour(was), next));
  }

  /**
   * The hand follows the finger.
   *
   * **The responder props rather than a `PanResponder`.** A `PanResponder` has
   * to be built once — rebuilding it mid-gesture drops the gesture — which
   * means its handlers cannot see state and have to read it back out of refs,
   * and the React Compiler rules reject that on sight. These are ordinary
   * props: they are rebuilt every render, the node they sit on is not, and the
   * responder system calls whichever handler is on the node at the time. So
   * they simply close over `mode` and `half`, and there is nothing to keep in
   * step with anything.
   */
  function follow(event: GestureResponderEvent) {
    const { x, y, side: measured } = faceRef.current;
    if (!measured) return;
    const dx = event.nativeEvent.pageX - x - measured / 2;
    const dy = event.nativeEvent.pageY - y - measured / 2;

    if (mode === "hour") {
      const mark = markFromPoint(dx, dy, DIAL_MARKS);
      if (mark !== null) setHour(hourAt(mark, half));
    } else {
      const mark = markFromPoint(dx, dy, MINUTES_IN_HOUR);
      if (mark !== null) setMinute(mark);
    }
  }

  // 264 is the face on a normal phone; the clamp is for the narrow ones, where
  // the numbers ride in rather than off the edge.
  const side = Math.min(264, width - 96);
  const radius = side / 2 - KNOB - 4;
  const centre = side / 2;
  const selected = mode === "hour" ? markOfHour(hour) : minute;
  const steps = mode === "hour" ? DIAL_MARKS : MINUTES_IN_HOUR;
  const knob = markPoint(selected, steps, radius);
  // True for every hour and for the twelve labelled minutes; false at 09:47,
  // where the hand ends between two numbers and takes a point instead.
  const onLabel = mode === "hour" || minute % MINUTE_LABEL_STEP === 0;

  return (
    <Sheet onClose={onClose} testID="timepicker">
      <Text
        accessibilityRole="header"
        className="mb-5 font-bold text-lg text-text-primary"
      >
        {label}
      </Text>

      <View
        testID="timepicker-preview"
        // The value and the mode switch are the same control, as they are on
        // every clock picker: the part being set is the part lit up, so there
        // is nothing to explain and nothing extra to press.
        className="mb-4 flex-row items-center justify-center gap-2"
      >
        <Unit
          testID="timepicker-set-hour"
          digits={clockDigits(hour)}
          active={mode === "hour"}
          accessibilityLabel={`Hora, ${clockDigits(hour)}. Poner la hora`}
          onPress={() => setMode("hour")}
        />
        <Text style={DIGITS} className="text-text-tertiary">
          :
        </Text>
        <Unit
          testID="timepicker-set-minute"
          digits={clockDigits(minute)}
          active={mode === "minute"}
          accessibilityLabel={`Minutos, ${clockDigits(minute)}. Poner los minutos`}
          onPress={() => setMode("minute")}
        />
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Mitad del día"
        className="mb-5 flex-row justify-center gap-2"
      >
        <Half
          testID="timepicker-half-morning"
          label="00 – 11"
          accessibilityLabel="Horas de 00 a 11"
          selected={half === "morning"}
          onPress={() => showHalf("morning")}
        />
        <Half
          testID="timepicker-half-afternoon"
          label="12 – 23"
          accessibilityLabel="Horas de 12 a 23"
          selected={half === "afternoon"}
          onPress={() => showHalf("afternoon")}
        />
      </View>

      <View
        ref={faceView}
        onLayout={(event: LayoutChangeEvent) => {
          if (event.nativeEvent.layout.width) measure();
        }}
        accessibilityRole="radiogroup"
        accessibilityLabel={mode === "hour" ? "Hora" : "Minutos"}
        style={{ width: side, height: side }}
        className="mb-6 self-center"
        // A press belongs to whichever number is under it; only a movement is
        // the face's own business — including one that began on a number,
        // which is how a drag from "3" to "7" is supposed to behave.
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponderCapture={() => true}
        onResponderGrant={measure}
        onResponderMove={follow}
        // The sheet this sits in scrolls, and a circular drag has a vertical
        // component: without this the scroll view asks for the gesture back
        // halfway round the face and gets it, because the default answer to
        // that question is yes.
        onResponderTerminationRequest={() => false}
        // Letting go of the hour hands over to the minute, the way every clock
        // picker does: the two together are one gesture, not two errands.
        onResponderRelease={() => {
          if (mode === "hour") setMode("minute");
        }}
      >
        <Svg width={side} height={side}>
          {/* The face reads as a face because of its edge, not its fill:
              Elevated Frost on Fjord Slate measures 1.16:1, the same
              imperceptible step that made the chips carry a weight change
              instead of a colour one. */}
          <Circle
            cx={centre}
            cy={centre}
            // Half a pixel in, so the stroke is not clipped by the edge of
            // the drawing.
            r={centre - 0.5}
            fill={colors.elevated}
            stroke={colors.borderStrong}
            strokeWidth={1}
          />
          <Line
            x1={centre}
            y1={centre}
            x2={centre + knob.x}
            y2={centre + knob.y}
            stroke={colors.accentPrimary}
            strokeWidth={2}
          />
          <Circle cx={centre} cy={centre} r={4} fill={colors.accentPrimary} />
          <Circle
            cx={centre + knob.x}
            cy={centre + knob.y}
            r={onLabel ? KNOB : TIP}
            fill={colors.accentPrimary}
          />
        </Svg>

        {MARKS.map((mark) => {
          const at = markPoint(mark, DIAL_MARKS, radius);
          const number =
            mode === "hour" ? hourAt(mark, half) : mark * MINUTE_LABEL_STEP;
          const isSelected =
            mode === "hour" ? mark === markOfHour(hour) : number === minute;

          return (
            <Pressable
              key={mark}
              testID={`timepicker-${mode}-${clockDigits(number)}`}
              onPress={() => {
                if (mode === "hour") {
                  setHour(number);
                  setMode("minute");
                } else {
                  setMinute(number);
                }
              }}
              accessibilityRole="radio"
              accessibilityLabel={
                mode === "hour"
                  ? `Las ${clockDigits(number)}`
                  : `Minuto ${clockDigits(number)}`
              }
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              aria-checked={isSelected}
              style={{
                position: "absolute",
                width: TOUCH_TARGET,
                height: TOUCH_TARGET,
                left: centre + at.x - TOUCH_TARGET / 2,
                top: centre + at.y - TOUCH_TARGET / 2,
              }}
              className="items-center justify-center"
            >
              <Text
                style={{ fontSize: 16, lineHeight: 20 }}
                className={
                  isSelected
                    ? "font-bold text-on-accent"
                    : "text-text-secondary"
                }
              >
                {clockDigits(number)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Pressable
            testID="timepicker-cancel"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            style={{ minHeight: TOUCH_TARGET }}
            className="items-center justify-center rounded-xl border border-border-strong py-4 active:opacity-70"
          >
            <Text className="text-text-secondary">Cancelar</Text>
          </Pressable>
        </View>
        <View className="flex-1">
          <Pressable
            testID="timepicker-confirm"
            onPress={() => onConfirm(formatClock({ hour, minute }))}
            accessibilityRole="button"
            accessibilityLabel="Confirmar"
            style={{ minHeight: TOUCH_TARGET }}
            className="items-center justify-center rounded-xl bg-accent-primary py-4 active:opacity-70"
          >
            <Text className="font-semibold text-on-accent">Confirmar</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const DIGITS = { fontSize: 34, lineHeight: 40 } as const;

/** One half of the big value at the top, and the switch for setting it. */
function Unit({
  digits,
  active,
  onPress,
  accessibilityLabel,
  testID,
}: {
  digits: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={{ minHeight: 64, minWidth: 76 }}
      className={`items-center justify-center rounded-xl border px-3 active:opacity-70 ${
        active
          ? "border-accent-primary bg-elevated"
          : "border-border-default bg-surface"
      }`}
    >
      <Text
        style={DIGITS}
        // The inactive half is still the value, not a placeholder: it stays
        // legible and gives up only its weight.
        className={
          active ? "font-bold text-text-primary" : "text-text-secondary"
        }
      >
        {digits}
      </Text>
    </Pressable>
  );
}

/** Which twelve hours the face is showing. */
function Half({
  label,
  selected,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
      style={{ minHeight: TOUCH_TARGET, minWidth: 104 }}
      className={`items-center justify-center rounded-xl border px-4 active:opacity-70 ${
        selected
          ? "border-accent-primary bg-elevated"
          : "border-border-default bg-surface"
      }`}
    >
      <Text
        className={`text-text-primary ${selected ? "font-bold" : ""}`}
        // Tabular-ish by construction: both labels are five characters, so the
        // pair stays the same width whichever one is bold.
      >
        {label}
      </Text>
    </Pressable>
  );
}

function nowClock() {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}
