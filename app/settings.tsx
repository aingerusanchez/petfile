import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { View } from "react-native";
import {
  Chip,
  ChipGroup,
  Group,
  Screen,
  Text,
  Version,
  Button,
} from "../components/ui";
import { formatDuration } from "../lib/duration";
import { formatTimeOfDay } from "../lib/events";
import {
  useSettings,
  type DurationFormat,
  type TimeFormat,
} from "../lib/settings";

/** A fixed instant, so both previews read the same time whatever the clock says. */
const SAMPLE = new Date(2026, 8, 10, 15, 30);
const SAMPLE_MINUTES = 90;

/**
 * How this tutor wants the app to read.
 *
 * **A stack route, not a fourth tab.** The tab bar names the three things the
 * app is *for* — the diary, the health record, the animal — and settings are
 * none of them; they are where you go once and come back from. It opens from
 * the profile, which is the screen already about the person's own setup.
 *
 * **Every option shows its own answer.** A radio pair labelled "24h / 12h"
 * asks the tutor to imagine the result; the same pair with "15:30" and
 * "3:30 p.m." on the chips *is* the result. That is also what makes the
 * duration option legible at all — "hours" and "minutes" name nothing on
 * their own.
 *
 * **The preference changes how the app writes, never what it stores.** Times
 * are still instants and durations are still minutes. The moment a setting
 * would change the data it belongs in the schema, not here.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { settings, update } = useSettings();

  const times: { value: TimeFormat; label: string }[] = [
    { value: "24h", label: formatTimeOfDay(SAMPLE, "24h") },
    { value: "12h", label: formatTimeOfDay(SAMPLE, "12h") },
  ];

  const durations: { value: DurationFormat; label: string }[] = [
    { value: "hours", label: formatDuration(SAMPLE_MINUTES, "hours") },
    { value: "minutes", label: formatDuration(SAMPLE_MINUTES, "minutes") },
  ];

  return (
    <Screen scroll footer={<Version testID="settings-version" />}>
      {/* This route has no tab bar and the Stack draws no header, so the way
          back is the screen's own business. */}
      <View className="mb-8 -ml-3">
        <Button
          testID="settings-back"
          variant="link"
          icon={ChevronLeft}
          label="Perfil"
          accessibilityLabel="Volver al perfil"
          onPress={() => router.back()}
        />
      </View>

      <Text
        testID="settings-title"
        accessibilityRole="header"
        className="mb-1 font-bold text-2xl text-text-primary"
      >
        Ajustes
      </Text>
      {/* One line, and only the part the options cannot show: that this is
          per device. The reassurance about stored data went — nothing on this
          screen suggests otherwise. */}
      <Text className="mb-8 text-text-tertiary">
        Cómo se lee la app en este móvil.
      </Text>

      <Group testID="settings-formats" title="Formatos">
        <ChipGroup label="Hora">
          {times.map(({ value, label }) => (
            <Chip
              key={value}
              testID={`settings-time-${value}`}
              label={label}
              accessibilityLabel={
                value === "24h" ? "Formato 24 horas" : "Formato 12 horas"
              }
              selected={settings.timeFormat === value}
              onPress={() => update({ timeFormat: value })}
            />
          ))}
        </ChipGroup>
        {/* The one caveat that survives, because it is the one thing the
            chips cannot show: this changes reading, not writing. Cut to the
            fact — the reason (a number pad has no meridiem) belongs in the
            code, not on the screen. */}
        <Text className="-mt-3 mb-5 text-xs text-text-tertiary">
          Solo para leer: al escribir una hora se sigue usando 24h.
        </Text>

        <ChipGroup label="Duración">
          {durations.map(({ value, label }) => (
            <Chip
              key={value}
              testID={`settings-duration-${value}`}
              label={label}
              accessibilityLabel={
                value === "hours" ? "En horas y minutos" : "Solo en minutos"
              }
              selected={settings.durationFormat === value}
              onPress={() => update({ durationFormat: value })}
            />
          ))}
        </ChipGroup>
      </Group>

      {/* Named, not hidden: these are the next ones and this is where they go.
          Saying so is cheaper than a tutor wondering whether the screen is
          finished. */}
      <Group testID="settings-soon" title="Más adelante">
        <Text className="mb-5 text-text-tertiary">
          Silenciar avisos, idioma, y voltear la app para zurdos — que llevaría
          el botón de añadir al pulgar hábil.
        </Text>
      </Group>
    </Screen>
  );
}
