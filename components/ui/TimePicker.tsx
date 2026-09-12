import { Clock } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Chip } from "./Chip";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * An hour and a minute, pointed at rather than typed.
 *
 * **The same bargain the date field struck, and for the same reason.** A time
 * field is faster to type than to browse — "915" is two seconds — so typing
 * stays the whole width of the field and this is a glyph beside it. It is
 * here for the tutor who would rather not aim at a number pad, and for the one
 * who cannot: a 48dp chip is a far easier target than four digits.
 *
 * **Hours scroll, minutes are a grid of fives.** Twenty-four in a row is a
 * strip you flick; sixty minutes is not a grid anybody scans, and this app
 * logs walks in quarter-hours. Five-minute steps cover what a household
 * actually writes down, and the exact minute somebody needs — 09:47 — is
 * already one typed word away.
 *
 * **An off-grid minute is kept, not rounded.** Opening this on 09:47 marks no
 * minute and the draft still says 47: confirming without touching the grid
 * gives back the time it opened with. Rounding on open would be the picker
 * quietly editing a value nobody asked it to touch.
 */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, step) => step * 5);

const pad = (value: number) => String(value).padStart(2, "0");

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
  const parsed = /^\s*(\d{1,2})[:.]?(\d{2})\s*$/.exec(value);
  const now = new Date();

  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);

  function openPicker() {
    // Opens on what the field says, or on the clock when it says nothing —
    // the same default the sheet itself uses for a new entry.
    const startHour = parsed ? Number(parsed[1]) : now.getHours();
    const startMinute = parsed ? Number(parsed[2]) : now.getMinutes();
    setHour(startHour > 23 ? now.getHours() : startHour);
    setMinute(startMinute > 59 ? now.getMinutes() : startMinute);
    setOpen(true);
  }

  return (
    <>
      <Pressable
        testID={testID}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Elegir la hora`}
        style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
        className="items-center justify-center active:opacity-70"
      >
        <Clock size={18} color={colors.textTertiary} />
      </Pressable>

      {open ? (
        <Sheet onClose={() => setOpen(false)} testID="timepicker">
          <Text
            accessibilityRole="header"
            className="mb-1 font-bold text-lg text-text-primary"
          >
            {label}
          </Text>
          <Text testID="timepicker-preview" className="mb-5 text-text-tertiary">
            {pad(hour)}:{pad(minute)}
          </Text>

          <Text className="mb-2 font-semibold text-xs tracking-[0.05em] text-accent-secondary uppercase">
            Hora
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
          >
            {HOURS.map((option) => (
              <Chip
                key={option}
                testID={`timepicker-hour-${pad(option)}`}
                label={pad(option)}
                selected={hour === option}
                onPress={() => setHour(option)}
              />
            ))}
          </ScrollView>

          <Text className="mb-2 font-semibold text-xs tracking-[0.05em] text-accent-secondary uppercase">
            Minutos
          </Text>
          <View className="mb-5 flex-row flex-wrap gap-3">
            {MINUTES.map((option) => (
              <Chip
                key={option}
                testID={`timepicker-minute-${pad(option)}`}
                label={pad(option)}
                selected={minute === option}
                onPress={() => setMinute(option)}
              />
            ))}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Pressable
                testID="timepicker-cancel"
                onPress={() => setOpen(false)}
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
                onPress={() => {
                  onChange(`${pad(hour)}:${pad(minute)}`);
                  setOpen(false);
                }}
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
      ) : null}
    </>
  );
}
