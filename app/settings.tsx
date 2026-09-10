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
    <Screen scroll>
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
      <Text className="mb-8 text-text-tertiary">
        Cómo se lee la app en este móvil. No cambia nada de lo que hayáis
        registrado.
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
        {/* Said out loud rather than discovered: the number pad has no
            a.m./p.m., so the two time fields keep taking 24-hour digits
            whatever this says. */}
        <Text className="-mt-3 mb-5 text-xs text-text-tertiary">
          Para leer. Al escribir una hora se sigue usando 24h, porque el teclado
          numérico no tiene a.m. ni p.m.
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
        <Text className="-mt-3 mb-5 text-xs text-text-tertiary">
          Al escribir valen las dos: 90 o 1h 30m.
        </Text>
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

      <View className="mt-6">
        <Version testID="settings-version" />
      </View>
    </Screen>
  );
}
