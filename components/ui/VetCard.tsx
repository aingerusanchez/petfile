import { Clock, MapPin, Phone, Stethoscope } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import {
  EMPTY_VET,
  formatPhone,
  hasVet,
  mapsHref,
  saveVet,
  telHref,
  vetLabel,
  type Vet,
  type VetKind,
} from "../../lib/vets";
import { Button } from "./Button";
import { Group } from "./Group";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { TextField } from "./TextField";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * One clinic, and the two things you do with it at speed.
 *
 * **Both cards exist before anybody fills them.** They could have been added
 * from the floating action like a weight or a treatment, and that would have
 * been wrong for the same reason a dog's name is not added from a floating
 * action: a vet is a *property of the animal*, not a record that accumulates.
 * There are exactly two, they are known in advance, and the emergency one is
 * needed by somebody who is frightened — a card that has to be discovered
 * before it can be filled is a card that is empty on the night it matters.
 * Empty, it says what it is for and offers to be filled.
 *
 * **The phone and the address are controls, not text.** A number that looks
 * like a paragraph and happens to dial is a guess a tutor has to make; with a
 * glyph and the tone this app gives its links, the row says what pressing it
 * does. The rest — the clinic, the person, the hours — is read, so it is
 * written as text and nothing more.
 */
export function VetCard({
  kind,
  vet,
  petId,
  petName,
  onSaved,
  onFailed,
}: {
  kind: VetKind;
  vet: Vet;
  petId: string;
  /** The dog's own name: an empty card says whose clinic it is asking for. */
  petName: string;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const filled = hasVet(vet);
  const tel = telHref(vet.phone);
  const maps = mapsHref(vet.address);

  return (
    <Group
      title={vetLabel(kind).toUpperCase()}
      testID={`vet-${kind}`}
      className="mb-6"
    >
      {filled ? (
        <View className="mb-4">
          {vet.clinic ? (
            <Text className="font-semibold text-text-primary">
              {vet.clinic}
            </Text>
          ) : null}
          {vet.vet ? (
            <View className="mt-1 flex-row items-center gap-2">
              <Stethoscope size={14} color={colors.textTertiary} />
              <Text className="min-w-0 flex-1 text-sm text-text-tertiary">
                {vet.vet}
              </Text>
            </View>
          ) : null}

          {tel ? (
            <Pressable
              testID={`vet-${kind}-call`}
              onPress={() => Linking.openURL(tel)}
              accessibilityRole="button"
              accessibilityLabel={`Llamar a ${vet.clinic || vetLabel(kind)}: ${formatPhone(vet.phone)}`}
              style={{ minHeight: TOUCH_TARGET }}
              className="mt-2 flex-row items-center gap-2 active:opacity-70"
            >
              <Phone size={16} color={colors.accentSecondary} />
              {/* Grouped where it is read: "944260051" off a contact list
                  and "944 26 00 51" on the fridge are the same number, and
                  only one of them can be read back over the phone. */}
              <Text className="min-w-0 flex-1 font-semibold text-accent-secondary">
                {formatPhone(vet.phone)}
              </Text>
            </Pressable>
          ) : null}

          {maps ? (
            <Pressable
              testID={`vet-${kind}-map`}
              onPress={() => Linking.openURL(maps)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${vet.address} en el mapa`}
              style={{ minHeight: TOUCH_TARGET }}
              className="flex-row items-center gap-2 py-1 active:opacity-70"
            >
              <MapPin size={16} color={colors.accentSecondary} />
              <Text className="min-w-0 flex-1 text-accent-secondary">
                {vet.address}
              </Text>
            </Pressable>
          ) : null}

          {vet.hours ? (
            <View className="mt-1 flex-row items-center gap-2">
              <Clock size={14} color={colors.textTertiary} />
              <Text className="min-w-0 flex-1 text-sm text-text-tertiary">
                {vet.hours}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        // **An empty card says what it is for, in the household's own terms.**
        // "Veterinario" is a category; "la que conoce a Loki" is the clinic
        // the tutor is actually thinking of — and naming the dog is what turns
        // a field into a question somebody can answer.
        <Text className="mb-4 text-text-tertiary">
          {kind === "primary"
            ? `La clínica de siempre, la que conoce a ${petName}.`
            : "A quién llamar o dónde ir cuando surge una urgencia a cualquier hora del día. Puede ser la misma si la clínica habitual abre 24h."}
        </Text>
      )}

      <View className="mb-4 items-start">
        <Button
          testID={`vet-${kind}-edit`}
          label={filled ? "Editar" : "Añadir"}
          variant="link"
          onPress={() => setEditing(true)}
        />
      </View>

      {editing ? (
        <VetSheet
          kind={kind}
          vet={vet}
          petId={petId}
          onClose={() => setEditing(false)}
          onSaved={(message) => {
            setEditing(false);
            onSaved(message);
          }}
          onFailed={onFailed}
        />
      ) : null}
    </Group>
  );
}

function VetSheet({
  kind,
  vet,
  petId,
  onClose,
  onSaved,
  onFailed,
}: {
  kind: VetKind;
  vet: Vet;
  petId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Vet>(hasVet(vet) ? vet : EMPTY_VET);

  const field = (key: keyof Vet) => (value: string) =>
    setDraft((was) => ({ ...was, [key]: value }));

  // Nothing to save until something differs from the row, the rule every
  // other form here follows.
  const changed = (Object.keys(EMPTY_VET) as (keyof Vet)[]).some(
    (key) => draft[key].trim() !== vet[key].trim(),
  );

  return (
    <Sheet onClose={onClose} testID={`vet-${kind}-sheet`}>
      <Text
        accessibilityRole="header"
        className="mb-5 font-bold text-lg text-text-primary"
      >
        {vetLabel(kind)}
      </Text>

      <TextField
        testID={`vet-${kind}-clinic`}
        label="CLÍNICA"
        value={draft.clinic}
        onChangeText={field("clinic")}
        placeholder="Clínica Veterinaria…"
        autoCapitalize="words"
      />
      <TextField
        testID={`vet-${kind}-vet`}
        label="VETERINARIA O VETERINARIO"
        value={draft.vet}
        onChangeText={field("vet")}
        placeholder="A quién preguntáis"
        autoCapitalize="words"
      />
      <TextField
        testID={`vet-${kind}-phone`}
        label="TELÉFONO"
        value={draft.phone}
        onChangeText={field("phone")}
        // **Grouped on blur, never as the digits arrive.** A focused
        // `TextInput` on Android ignores a value the JS layer rewrites — the
        // lesson the time fields and the date field both carry — so the
        // spacing lands when focus goes somewhere else, which is the
        // correction the platform honours.
        onBlur={() =>
          setDraft((was) => ({ ...was, phone: formatPhone(was.phone) }))
        }
        placeholder="944 00 00 00"
        // The pad that has the digits and the symbols a number can carry.
        keyboardType="phone-pad"
        autoCorrect={false}
      />
      <TextField
        testID={`vet-${kind}-address`}
        label="DIRECCIÓN"
        multiline
        value={draft.address}
        onChangeText={field("address")}
        placeholder="Calle, número, código postal y ciudad"
      />
      <TextField
        testID={`vet-${kind}-hours`}
        label="HORARIO"
        value={draft.hours}
        onChangeText={field("hours")}
        placeholder="24h · L-V 10:00-20:00"
      />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button
            testID={`vet-${kind}-save`}
            variant="primary"
            label="Guardar"
            successLabel="Guardado"
            errorLabel="No se ha podido guardar"
            disabled={!changed}
            onPress={async () => {
              const { error } = await saveVet(petId, kind, draft);
              if (error) {
                onFailed(error);
                return false;
              }
              onSaved(`${vetLabel(kind)} guardado`);
              return true;
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}
