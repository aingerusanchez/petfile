import { Minus, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import {
  centredFrame,
  clampOffset,
  coverScale,
  cropRect,
  MAX_ZOOM,
  rezoom,
  type Frame,
  type Natural,
} from "../../lib/framing";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Slider } from "./Slider";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/** How much a tap on − or + moves the zoom. */
const ZOOM_STEP = 0.5;

/** The slider's resolution. Finer than the buttons, which are for precision. */
const ZOOM_GRAIN = 0.1;

type AvatarEditorProps = {
  name: string;
  /** The stored photo, signed for reading, or null when there is none. */
  currentUri: string | null;
  /** Opens the system picker. Resolves to a local uri, or null if they backed out. */
  onPick: () => Promise<string | null>;
  /** Gets the picked photo and the square the tutor framed, in source pixels. */
  onSave: (
    uri: string,
    rect: { originX: number; originY: number; size: number },
  ) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  onClose: () => void;
};

/** The distance between two fingers, or null when there is only one. */
function pinchDistance(
  touches: GestureResponderEvent["nativeEvent"]["touches"],
): number | null {
  if (!touches || touches.length < 2) return null;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * Framing the animal's photo, against the circle it will actually appear in.
 *
 * **The preview is the mask.** The stage is the circle, not a square with a
 * circle drawn on it: what the tutor drags is what the profile will show, so
 * there is nothing to imagine and nothing to be surprised by. The file saved
 * is the circle's bounding square — the crop and the mask are the same
 * decision seen twice.
 *
 * **Only a freshly picked photo can be reframed.** What is stored is already
 * the crop at `AVATAR_PX`, so reframing it would mean enlarging 512 pixels
 * into a frame that wants more. The editor says so and offers the picker
 * instead, which is the honest version of the same action.
 *
 * **Zoom has three controls, and they are not redundant.** A pinch is the
 * natural gesture but is unreachable with a screen reader and unavailable with
 * a mouse. The slider is the one that shows the range — how far in you can go,
 * and where you are in it — and it is the fast way across that range. The
 * buttons are the precise way, a fixed step each, and the only one that works
 * with a keyboard. All three go through `rezoom`, which zooms about the middle
 * of the circle: one predictable rule rather than three that nearly agree.
 *
 * Repositioning is still drag-only — the default is a centred cover crop,
 * which is a complete result on its own, so nothing is unreachable, only
 * un-nudgeable.
 */
export function AvatarEditor({
  name,
  currentUri,
  onPick,
  onSave,
  onRemove,
  onClose,
}: AvatarEditorProps) {
  const { width } = useWindowDimensions();
  // Big enough to judge a dog's face on a phone, and it still leaves the
  // sheet's gutters alone on the narrowest Android screens.
  const stage = Math.max(200, Math.min(280, width - 96));

  const [picked, setPicked] = useState<string | null>(null);
  const [natural, setNatural] = useState<Natural | null>(null);
  const [frame, setFrame] = useState<Frame>({ zoom: 1, x: 0, y: 0 });

  // The gesture callbacks are created once and read the live values through
  // refs: a PanResponder closes over the state it was built with, and
  // rebuilding it on every frame would drop the gesture mid-drag.
  const frameRef = useRef(frame);
  const naturalRef = useRef(natural);
  const stageRef = useRef(stage);
  // In an effect rather than during render: a ref written while rendering is
  // the defect `react-hooks/refs` exists to catch, and nothing reads this one
  // before a gesture starts.
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const apply = useCallback((next: Frame) => {
    frameRef.current = next;
    setFrame(next);
  }, []);

  const start = useRef({
    frame,
    distance: null as number | null,
    dx: 0,
    dy: 0,
  });

  // `mark` and `drag` are callbacks, not inline closures inside the memo: a
  // `useMemo` body runs during render, so reading a ref from one is the same
  // violation as reading it at the top level.
  const mark = useCallback(
    (event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      start.current = {
        frame: frameRef.current,
        distance: pinchDistance(event.nativeEvent.touches),
        dx: gesture.dx,
        dy: gesture.dy,
      };
    },
    [],
  );

  const drag = useCallback(
    (event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const image = naturalRef.current;
      if (!image) return;
      const from = start.current;
      const distance = pinchDistance(event.nativeEvent.touches);

      if (from.distance && distance) {
        apply(
          rezoom(
            image,
            stageRef.current,
            from.frame,
            (from.frame.zoom * distance) / from.distance,
          ),
        );
        return;
      }

      apply({
        zoom: from.frame.zoom,
        ...clampOffset(
          image,
          stageRef.current,
          from.frame.zoom,
          from.frame.x + (gesture.dx - from.dx),
          from.frame.y + (gesture.dy - from.dy),
        ),
      });
    },
    [apply],
  );

  // `react-hooks/refs` cannot see through `PanResponder.create`: it sees a
  // ref-reading callback handed to a function during render and warns that the
  // value may be read there. It is not — the handlers run on touch, which is
  // the whole reason they reach for a ref instead of closing over state. The
  // memo has to stay, too: `PanResponder.create` owns the accumulated
  // `gestureState`, so rebuilding it per render would reset `dx` mid-drag.
  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: mark,
        // Fires again for every finger that lands or lifts, which is what
        // keeps a pinch from jumping when the second one arrives mid-drag.
        onPanResponderStart: mark,
        onPanResponderEnd: mark,
        onPanResponderMove: drag,
      }),
    [mark, drag],
  );

  const pick = useCallback(async () => {
    const uri = await onPick();
    if (!uri) return true; // backed out of the picker, which is not a failure

    return new Promise<boolean>((resolve) => {
      Image.getSize(
        uri,
        (imageWidth, imageHeight) => {
          const image = { width: imageWidth, height: imageHeight };
          naturalRef.current = image;
          setNatural(image);
          setPicked(uri);
          apply(centredFrame(image, stageRef.current));
          resolve(true);
        },
        () => resolve(false),
      );
    });
  }, [onPick, apply]);

  const zoomTo = useCallback(
    (zoom: number) => {
      const image = naturalRef.current;
      if (!image) return;
      apply(rezoom(image, stage, frameRef.current, zoom));
    },
    [apply, stage],
  );

  const zoomBy = useCallback(
    (delta: number) => zoomTo(frameRef.current.zoom + delta),
    [zoomTo],
  );

  const save = useCallback(async () => {
    if (!picked || !natural) return false;
    return onSave(picked, cropRect(natural, stage, frame));
  }, [picked, natural, stage, frame, onSave]);

  const framing = !!picked && !!natural;
  const scale = natural ? coverScale(natural, stage) * frame.zoom : 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="avatar-editor-scrim"
        onPress={onClose}
        className="flex-1 justify-end bg-base/80"
      >
        <Pressable
          testID="avatar-editor"
          onPress={(event) => event.stopPropagation()}
          className="rounded-xl border border-border-default bg-surface p-5"
        >
          {/* Centred, so it sits over the portrait rather than off to its
              left: the sheet is about one round thing in the middle of it. */}
          <Text
            accessibilityRole="header"
            className="mb-5 text-center font-bold text-xl text-text-primary"
          >
            {`Foto de ${name}`}
          </Text>

          <View className="mb-5 items-center">
            {framing ? (
              <View
                testID="avatar-editor-stage"
                accessibilityLabel="Arrastra la foto para colocarla"
                style={{
                  width: stage,
                  height: stage,
                  borderRadius: stage / 2,
                }}
                className="overflow-hidden border border-border-strong bg-elevated"
                {...responder.panHandlers}
              >
                <Image
                  testID="avatar-editor-preview"
                  source={{ uri: picked! }}
                  accessible={false}
                  style={{
                    position: "absolute",
                    left: frame.x,
                    top: frame.y,
                    width: natural!.width * scale,
                    height: natural!.height * scale,
                  }}
                />
              </View>
            ) : (
              <Avatar
                testID="avatar-editor-current"
                uri={currentUri}
                name={name}
                size={stage}
              />
            )}
          </View>

          {framing ? (
            <>
              <View className="flex-row items-center gap-4">
                <ZoomButton
                  testID="avatar-editor-zoom-out"
                  label="Alejar"
                  icon={Minus}
                  disabled={frame.zoom <= 1}
                  onPress={() => zoomBy(-ZOOM_STEP)}
                />
                <View className="flex-1">
                  <Slider
                    testID="avatar-editor-slider"
                    value={frame.zoom}
                    min={1}
                    max={MAX_ZOOM}
                    step={ZOOM_GRAIN}
                    onChange={zoomTo}
                    accessibilityLabel="Zoom"
                    accessibilityValueText={`${frame.zoom.toFixed(1)} aumentos`}
                  />
                </View>
                <ZoomButton
                  testID="avatar-editor-zoom-in"
                  label="Acercar"
                  icon={Plus}
                  disabled={frame.zoom >= MAX_ZOOM}
                  onPress={() => zoomBy(ZOOM_STEP)}
                />
              </View>
              <Text
                testID="avatar-editor-zoom"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Zoom ${frame.zoom.toFixed(1)} aumentos`}
                className="mb-3 text-center text-text-tertiary"
              >
                {`${frame.zoom.toFixed(1)}×`}
              </Text>
              {/* `text-balance` evens the two lines on the web; the native CSS
                  compiler has no `text-wrap`, so the non-breaking space is
                  what stops "se verá." orphaning a line there. */}
              <Text className="mb-5 text-center text-xs text-balance text-text-tertiary">
                {
                  "Arrástrala para colocarla y pellízcala para acercar. Así es como se\u00A0verá."
                }
              </Text>
            </>
          ) : (
            <Text className="mb-5 text-center text-xs text-text-tertiary">
              {currentUri
                ? "Para reencuadrarla, vuelve a elegir la foto."
                : `Elige una foto y encuádrala como quieras.`}
            </Text>
          )}

          <View className="mb-5 flex-row items-center justify-between">
            <Button
              testID="avatar-editor-pick"
              variant="link"
              label={picked || currentUri ? "Elegir otra foto" : "Elegir foto"}
              accessibilityLabel={`Elegir una foto de ${name}`}
              successLabel="Encuádrala"
              errorLabel="No hemos podido abrirla"
              onPress={pick}
            />
            {currentUri && !picked ? (
              <Button
                testID="avatar-editor-remove"
                variant="link"
                tone="danger"
                label="Quitar"
                accessibilityLabel={`Quitar la foto de ${name}`}
                successLabel="Quitada"
                errorLabel="No se pudo quitar"
                onPress={onRemove}
              />
            ) : null}
          </View>

          <View className="mt-1 flex-row gap-3">
            <Pressable
              testID="avatar-editor-cancel"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              style={{ minHeight: TOUCH_TARGET }}
              className="flex-1 items-center justify-center rounded-xl border border-border-strong py-4 active:opacity-70"
            >
              <Text className="text-text-secondary">Cancelar</Text>
            </Pressable>
            <View className="flex-1">
              <Button
                testID="avatar-editor-save"
                variant="primary"
                label="Guardar"
                disabled={!framing}
                successLabel="Guardada"
                errorLabel="No se ha podido guardar"
                onPress={save}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A square icon-only control, which needs its name spoken rather than shown. */
function ZoomButton({
  testID,
  label,
  icon: Icon,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  icon: typeof Minus;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
      className="items-center justify-center rounded-xl border border-border-strong active:opacity-70"
    >
      <Icon
        size={20}
        strokeWidth={2.5}
        color={disabled ? colors.textMuted : colors.textSecondary}
      />
    </Pressable>
  );
}
