import { Redirect, useRouter } from "expo-router";
import { Mars, Plus, Venus } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, type ScrollView } from "react-native";
import {
  BreedField,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  DateField,
  Group,
  LoadingScreen,
  Screen,
  spacing,
  Text,
  TextField,
  useCelebration,
  useToast,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { meansMixedBreed, MIXED_BREED_LABEL } from "../lib/breeds";
import { parseISO, toApproximateISO } from "../lib/dates";
import {
  createPet,
  getMyPet,
  validatePetDraft,
  type PetDraft,
} from "../lib/pets";

type ActivityLevel = NonNullable<PetDraft["activityLevel"]>;

/**
 * Each level carries a line the tutor can hold against their own dog.
 *
 * The point is contrast, not instruction: "Moderado" means nothing on its own,
 * and a tutor guessing between three abstractions will pick the middle one —
 * which is exactly the fabricated "moderate" this field used to record by
 * default. A concrete walk count is checkable in a second.
 *
 * The numbers are pitched at what most breeds and ages actually get in Spain:
 * two or three walks a day is the norm, not the high end, so "moderado" sits
 * there rather than above three. The voice is plural — the tutor and the dog
 * go out together.
 */
const ACTIVITY: {
  value: ActivityLevel;
  /** The chip label: the scale itself, short enough for a 3-up row. */
  label: string;
  /**
   * Kept apart from the sentence rather than written into it: a screen reader
   * announces 😴 as "cara durmiendo", so the emoji carries tone for the eye
   * and noise for the ear. The hint is spoken without it.
   */
  emoji: string;
  /** Shown only for the chosen option, below the row. */
  hint: string;
}[] = [
  {
    value: "low",
    label: "Bajo",
    emoji: "😴",
    hint: "Dormilón. Salimos una o dos veces al día, paseos cortos. Con eso va servido.",
  },
  {
    value: "moderate",
    label: "Moderado",
    emoji: "🎾",
    hint: "Juguetón. Dos o tres paseos, alguno de media hora, y jugamos un rato.",
  },
  {
    value: "high",
    label: "Alto",
    emoji: "💪",
    hint: "Incansable. Tres o más paseos largos, o alguno de una hora. Necesita quemar.",
  },
];

/** Shown while nothing is chosen: an invitation, not a description. */
const ACTIVITY_PROMPT = "Elige el que más se acerque a vuestro día a día.";

export default function Onboarding() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [draft, setDraft] = useState<PetDraft>({
    name: "",
    sex: null,
    breedPrimary: null,
    breedSecondary: null,
    isMixed: false,
    birthDate: null,
    birthDateApproximate: false,
    spayedNeutered: null,
    // Null, not "moderate": a pre-selected default is indistinguishable from
    // an answer, and this feeds weight and nutrition later.
    activityLevel: null,
  });
  // spayedNeutered is a true boolean | null tri-state where null is itself a
  // legitimate answer ("no lo sé"), so the draft's initial null can't double
  // as "untouched" — this flag is what keeps no chip pre-selected until the
  // user actually picks one.
  const [neuteredTouched, setNeuteredTouched] = useState(false);
  // The optional tier stays collapsed by default. Its fields exist to feed
  // weight tracking and future nutrition guidance, and the intended path is to
  // ask for each one when a flow that needs it starts — not at signup.
  const [showOptional, setShowOptional] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasPet, setHasPet] = useState<boolean | null>(null);
  const [petCheckError, setPetCheckError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  /**
   * Scroll-to-error plumbing.
   *
   * `onLayout` reports a view's offset within its *parent*, so a field's
   * position in the scroll content is the group's offset plus the field's
   * offset inside it. One group holds every field that can fail, which keeps
   * this to a single extra term rather than a walk up the tree.
   */
  const scrollRef = useRef<ScrollView>(null);
  const groupY = useRef(0);
  const fieldY = useRef<Record<string, number>>({});
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  /**
   * The status-bar band the scroll target has to clear.
   *
   * A scrolled ScrollView runs under the status bar, and this device's inset
   * (40dp) is larger than the margin below — so without it, scrolling to the
   * first error landed the field's label under the clock, which is the one
   * thing that margin exists to prevent.
   */
  const topInset = useRef(0);

  /** Visual order, which is the order a tutor reads and fixes them in. */
  const FIELD_ORDER = ["name", "birthDate", "breedPrimary"];

  function scrollToFirstError(errors: Record<string, string>) {
    const first = FIELD_ORDER.find((key) => errors[key]);
    if (!first) return;

    // Deferred a frame on purpose. Scrolling in the same tick as
    // `setFieldErrors` scrolls the pre-error layout, and then the error
    // messages mount and the browser's scroll anchoring adjusts the offset to
    // preserve what was on screen — which cancels the scroll. Measured: the
    // jump landed at the original offset plus exactly one message's height.
    // Waiting for the frame lets the messages lay out first, so the offsets
    // below are the ones the tutor will actually see.
    requestAnimationFrame(() => {
      const y = fieldY.current[first];
      if (y === undefined || !scrollRef.current) return;

      // A margin above the field so its label comes with it. An error you can
      // see but whose field name you cannot is half an answer.
      const target = Math.max(
        groupY.current + y - spacing.lg - topInset.current,
        0,
      );

      // Only move if the field is not already comfortably on screen. Yanking
      // the view when the tutor could already see the field costs them their
      // place — and on this form the first required field is near the top, so
      // scrolling unconditionally hid the headline for nothing.
      const top = scrollOffset.current;
      const bottom = top + viewportHeight.current;
      const fieldTop = groupY.current + y;
      const alreadyVisible =
        viewportHeight.current > 0 &&
        fieldTop >= top &&
        fieldTop + spacing.xl <= bottom;
      if (alreadyVisible) return;

      scrollRef.current.scrollTo({ y: target, animated: true });
    });
  }

  /**
   * "Es mestizo" and the breed field are two faces of one fact.
   *
   * They used to be two controls saying the same thing, plus a third path — a
   * suggestion row — that offered to translate between them. Ticking the box
   * now writes "Mestizo" into the field, and typing it ticks the box, so
   * whichever one the tutor reaches for, the screen ends up in a single state
   * they can see. Untick clears the word again.
   *
   * The second breed is gone from the form with it. Naming the halves of a
   * cross is a real thing to collect and a worse thing to ask for here, so it
   * waits for the profile's edit surface — `breed_secondary` stays in the
   * schema, unwritten, rather than being dropped.
   *
   * What reaches the database is unchanged and still honest: the boundary in
   * `lib/pets.ts` recognises the word, sets `is_mixed` and stores no breed, so
   * "Mestizo" is a thing the screen says and never a thing the record claims.
   */
  const mixed = draft.isMixed || meansMixedBreed(draft.breedPrimary);

  function setMixed(next: boolean) {
    setDraft((d) => ({
      ...d,
      isMixed: next,
      breedPrimary: next
        ? MIXED_BREED_LABEL
        : meansMixedBreed(d.breedPrimary)
          ? null
          : d.breedPrimary,
      breedSecondary: null,
    }));
  }

  /**
   * Brings a field to the top of the viewport.
   *
   * For the breed fields, which open a suggestion list *below* themselves.
   * Under edge-to-edge the keyboard does not resize the window, so a field
   * sitting low on the page has its list open behind the keyboard — measured
   * on device, all six suggestions were off screen with nothing on screen
   * changing, which reads as the field having no autocomplete at all. Moving
   * the field up gives the list the whole band above the keyboard.
   *
   * Unconditional, unlike `scrollToFirstError`: here the point is not to
   * reveal the field, which the tutor is already looking at, but to clear
   * room under it.
   */
  function revealField(key: string) {
    requestAnimationFrame(() => {
      const y = fieldY.current[key];
      if (y === undefined || !scrollRef.current) return;
      const target = Math.max(
        groupY.current + y - spacing.sm - topInset.current,
        0,
      );
      scrollRef.current.scrollTo({ y: target, animated: true });
    });
  }

  /**
   * Validate on submit, forgive on input.
   *
   * An error used to sit there until the next submit even after the tutor had
   * fixed the field, which reads as the form not noticing. This clears an
   * error the moment its field becomes valid — and only then, so a message
   * cannot appear mid-typing for a field the tutor has not finished.
   *
   * It never *adds* an error: it walks the errors already on screen and keeps
   * the ones that still hold, which is what makes it safe to run on every
   * keystroke.
   */
  useEffect(() => {
    setFieldErrors((previous) => {
      const keys = Object.keys(previous);
      if (keys.length === 0) return previous;

      const current = validatePetDraft(draft);
      const next: Record<string, string> = {};
      for (const key of keys) {
        if (current[key]) next[key] = current[key];
      }

      // Same keys and same messages means nothing changed; returning the same
      // object keeps this from re-rendering on every keystroke.
      const unchanged =
        Object.keys(next).length === keys.length &&
        keys.every((key) => next[key] === previous[key]);
      return unchanged ? previous : next;
    });
  }, [draft]);

  const retry = useCallback(() => {
    setPetCheckError(null);
    setHasPet(null);
    setAttempt((n) => n + 1);
  }, []);

  // Onboarding is reachable directly (deep link, back navigation), so it needs
  // the same has-pet check `app/index.tsx` does — otherwise a user who already
  // has a pet gets the creation form again and can make a duplicate.
  useEffect(() => {
    if (!session) {
      setHasPet(null);
      setPetCheckError(null);
      return;
    }

    let cancelled = false;
    getMyPet()
      .then(({ pet, error: failure }) => {
        if (cancelled) return;
        if (failure) {
          setPetCheckError(failure);
          return;
        }
        setHasPet(pet !== null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPetCheckError(
          err instanceof Error
            ? err.message
            : "No hemos podido encontrar a tu perro",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  // A failed check must not fall through to the form (that would risk a
  // duplicate pet) or leave the spinner spinning forever.
  if (petCheckError) {
    return (
      <Screen center>
        <Text
          accessibilityLiveRegion="polite"
          className="mb-5 text-center text-error"
        >
          {petCheckError}
        </Text>
        <Button testID="onboarding-retry" label="Reintentar" onPress={retry} />
      </Screen>
    );
  }

  if (loading || (session && hasPet === null)) return <LoadingScreen />;

  if (!session) return <Redirect href="/login" />;
  if (hasPet) return <Redirect href="/(tabs)" />;

  /**
   * Ticking "only the month and year" rewrites any day already chosen to the
   * 1st, so the stored value can never carry a day the tutor did not mean.
   * Unticking leaves the value alone — the picker will ask for a day next.
   */
  function setApproximate(next: boolean) {
    setDraft((d) => {
      if (!next) return { ...d, birthDateApproximate: false };
      const parts = parseISO(d.birthDate);
      return {
        ...d,
        birthDateApproximate: true,
        birthDate: parts
          ? toApproximateISO(parts.year, parts.month)
          : d.birthDate,
      };
    });
  }

  /**
   * Reports its own outcome: `Button` runs the loading state, blocks a second
   * press for the whole cycle, and shows a check or an alert from what this
   * resolves to. Throwing counts as failure, so there is no `finally` needed
   * to unstick a busy flag any more — the button owns that.
   */
  async function submit(): Promise<boolean> {
    // Validate here first so every invalid field gets its own message. Going
    // straight to createPet would surface one error at a time, at the bottom
    // of the form, for a field that may be scrolled off-screen.
    const errors = validatePetDraft(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Always the first error, never the last one reported: with several
      // invalid fields the tutor should land on the topmost one and work down.
      scrollToFirstError(errors);
      // No toast here on purpose: each invalid field already says what is
      // wrong right where it is wrong, and a toast repeating "revisa el
      // formulario" would add noise without adding information. The button's
      // alert icon is the only extra signal needed.
      // Any invalid field in the collapsed tier must be visible to be fixed.
      if (errors.spayedNeutered || errors.activityLevel) setShowOptional(true);
      return false;
    }

    // The button shows an alert icon on failure, but an icon is not a reason.
    // A throw has to become a sentence too: `createPet` returns its error for
    // an expected failure and throws for an unexpected one (an RPC returning
    // no row, a constraint the app did not anticipate), and letting the throw
    // escape would leave the user with a red flash and no explanation.
    try {
      const { petId, error: failure } = await createPet(draft);
      if (petId) {
        // The toast host lives above the Stack, so this survives the
        // navigation that immediately unmounts this screen — which is the
        // whole reason the flow no longer has to stall to be understood.
        // Once in an account's life: v0 is single-pet, and onboarding
        // redirects away for good afterwards. That is what earns the effect —
        // it can never become the repeated noise that usually ruins one.
        celebrate();
        toast.show({
          variant: "success",
          message: `¡${petName} ya está contigo!`,
        });
        router.replace("/(tabs)");
        return true;
      }
      // A failed write is something the tutor must deal with, not something to
      // glance at, so it persists and offers the retry rather than draining
      // away on a timer.
      toast.show({
        variant: "error",
        // The failure stays inside the recall metaphor the button opened, and
        // the retry keeps it actionable — a joke that left the tutor without a
        // way forward would not be worth the charm.
        message:
          failure ??
          `Parece que ${petName} no contesta a su nombre... ¡vuelve a intentarlo!`,
        persist: true,
        action: { label: "Reintentar", onPress: () => void submit() },
      });
      return false;
    } catch (err) {
      toast.show({
        variant: "error",
        message:
          err instanceof Error
            ? err.message
            : "Algo ha ido mal por nuestro lado. Vuelve a intentarlo.",
        persist: true,
      });
      return false;
    }
  }

  /**
   * The primary action calls the animal by name as soon as there is one, and
   * the success toast answers it: "¡Vamos, Loki!" → "¡Loki ya está contigo!"
   *
   * The pair is a recall — the call on a walk and the dog arriving — which is
   * the product's own world rather than decoration borrowed from elsewhere. It
   * also makes the confirmation read as an answer instead of a log line, and
   * it is the only place in the flow the tutor sees their input read back.
   */
  const petName = draft.name.trim();
  const submitLabel = petName ? `¡Vamos, ${petName}!` : "Añadir mascota";
  const chosenActivity = ACTIVITY.find((a) => a.value === draft.activityLevel);

  return (
    <Screen
      scroll
      scrollRef={scrollRef}
      onScrollOffset={(y) => {
        scrollOffset.current = y;
      }}
      onViewportHeight={(h) => {
        viewportHeight.current = h;
      }}
      onTopInset={(inset) => {
        topInset.current = inset;
      }}
    >
      {/* "Compi" over "mascota": the animal is someone the tutor lives with,
          not something they own. The emoji is a deliberate fallback to the
          system emoji font, which is a different thing from The No-Glyph Rule
          — that bans text glyphs expected to match Outfit, like the ♂/♀ the
          sex chips used to carry. */}
      <Text
        accessibilityRole="header"
        // No emoji in an accessible name: a screen reader reads 🐶 out as
        // "cara de perro", which turns the screen's title into a description
        // of its own decoration.
        accessibilityLabel="Preséntame a tu compi"
        className="mb-8 text-3xl font-bold text-text-primary"
      >
        {/* The space before the emoji is a non-breaking one (U+00A0). With an
            ordinary space the headline wrapped between "compi" and the emoji,
            leaving it orphaned on a line of its own. */}
        {"Preséntame a tu compi\u00A0🐶"}
      </Text>

      {/* Everything visible at start lives in one group on purpose: the tutor
          should read these as one set of facts about their animal, of equal
          standing, even though breed is skippable. The tiering shows in what
          blocks a save and in the `opcional` marker, not in the grouping. */}
      <Group
        testID="onboarding-group-main"
        onLayout={(e) => {
          groupY.current = e.nativeEvent.layout.y;
        }}
      >
        <TextField
          testID="onboarding-name"
          onLayout={(e) => {
            fieldY.current.name = e.nativeEvent.layout.y;
          }}
          label="Nombre"
          required
          value={draft.name}
          onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
          placeholder="Loki"
          error={fieldErrors.name}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          maxLength={40}
        />

        <ChipGroup label="Sexo" className="mb-5">
          {(
            [
              { value: "male", label: "Macho", icon: Mars },
              { value: "female", label: "Hembra", icon: Venus },
            ] as const
          ).map(({ value, label, icon }) => (
            <Chip
              key={value}
              testID={`onboarding-sex-${value}`}
              label={label}
              icon={icon}
              selected={draft.sex === value}
              onPress={() => setDraft((d) => ({ ...d, sex: value }))}
            />
          ))}
        </ChipGroup>
        <DateField
          testID="onboarding-birthdate"
          onLayout={(e) => {
            fieldY.current.birthDate = e.nativeEvent.layout.y;
          }}
          label="Fecha de nacimiento"
          required
          value={draft.birthDate}
          onChange={(iso) => setDraft((d) => ({ ...d, birthDate: iso }))}
          approximate={draft.birthDateApproximate}
          error={fieldErrors.birthDate}
        />
        <View className="mb-5 -mt-3">
          <Checkbox
            testID="onboarding-birthdate-approx"
            label="Aproximado"
            accessibilityLabel="Fecha de nacimiento aproximada"
            checked={draft.birthDateApproximate}
            onChange={setApproximate}
          />
        </View>

        <BreedField
          testID="onboarding-breed"
          onLayout={(e) => {
            fieldY.current.breedPrimary = e.nativeEvent.layout.y;
          }}
          label="Raza"
          value={draft.breedPrimary}
          onChange={(breed) => setDraft((d) => ({ ...d, breedPrimary: breed }))}
          onFocus={() => revealField("breedPrimary")}
          placeholder="Husky Siberiano"
          error={fieldErrors.breedPrimary}
        />
        <View className="mb-4 -mt-3">
          <Checkbox
            testID="onboarding-mixed"
            label="Es mestizo"
            accessibilityLabel="Es mestizo, sin raza concreta"
            checked={mixed}
            onChange={setMixed}
          />
        </View>
      </Group>

      {/* The deferrable fields get their own group rather than joining the one
          above: they are a different kind of fact — what the app will use for
          weight and nutrition later — and they arrive at a different moment. */}
      {showOptional ? (
        <Group testID="onboarding-optional" title="Salud y actividad">
          <ChipGroup label="¿Esterilizado?">
            {(
              [
                { value: true, label: "Sí", testId: "yes" },
                { value: false, label: "No", testId: "no" },
                { value: null, label: "No sé", testId: "unknown" },
              ] as const
            ).map(({ value, label, testId }) => (
              <Chip
                key={testId}
                testID={`onboarding-neutered-${testId}`}
                label={label}
                selected={neuteredTouched && draft.spayedNeutered === value}
                onPress={() => {
                  setNeuteredTouched(true);
                  setDraft((d) => ({ ...d, spayedNeutered: value }));
                }}
              />
            ))}
          </ChipGroup>

          <ChipGroup label="Nivel de actividad" className="mb-2">
            {ACTIVITY.map(({ value, label }) => (
              <Chip
                key={value}
                testID={`onboarding-activity-${value}`}
                label={label}
                selected={draft.activityLevel === value}
                onPress={() =>
                  setDraft((d) => ({ ...d, activityLevel: value }))
                }
              />
            ))}
          </ChipGroup>
          {/* One hint at a time, for the chosen option only. Printing all
              three at once explains in bulk what the tutor has not chosen,
              which is the load this app deliberately does not charge. With
              nothing chosen the line invites a choice rather than describing
              options that are not active. */}
          <Text
            testID="onboarding-activity-hint"
            accessibilityLabel={
              chosenActivity ? chosenActivity.hint : ACTIVITY_PROMPT
            }
            className="mb-5 text-xs text-text-tertiary"
          >
            {chosenActivity
              ? `${chosenActivity.emoji} ${chosenActivity.hint}`
              : ACTIVITY_PROMPT}
          </Text>
        </Group>
      ) : (
        <Button
          testID="onboarding-more"
          variant="link"
          icon={Plus}
          label="Añadir salud y actividad"
          onPress={() => setShowOptional(true)}
        />
      )}

      <View className="mt-10">
        <Button
          testID="onboarding-submit"
          variant="primary"
          label={submitLabel}
          // The visible label is the app's voice; the accessible name is the
          // action. "¡Vamos, Loki!" only reads as a control next to the form
          // it submits.
          accessibilityLabel="Registrar mascota"
          successLabel="¡Ya estáis dentro!"
          // Two different failures reach the same button, so it says which:
          // fields left blank, or a write that did not go through. The toast
          // carries the detail for the second; this is the headline.
          errorLabel={
            Object.keys(fieldErrors).length > 0
              ? "Faltan datos por rellenar"
              : "No se ha podido guardar"
          }
          onPress={submit}
        />
      </View>
    </Screen>
  );
}
