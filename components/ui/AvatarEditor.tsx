import { Minus, Plus } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import {
  centredFrame,
  clampOffset,
  cropRect,
  coverScale,
  MAX_ZOOM,
  rezoom,
  type Frame,
  type Natural,
} from "../../lib/framing";
import { colors, pressed, TOUCH_TARGET } from "./tokens";
import { Text } from "./Text";

/** How much a tap on − or + moves the zoom. */
const ZOOM_STEP = 0.5;

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
 * **Zoom has buttons as well as a pinch.** A pinch is the natural gesture and
 * the only one on the device, but it is unreachable with a screen reader and
 * unavailable with a mouse, so the capability cannot live in the gesture
 * alone. Both go through `rezoom`, which zooms about the middle of the circle:
 * one predictable rule rather than two that nearly agree. Repositioning is
 * still drag-only — the default is a centred cover crop, which is a complete
 * result on its own, so nothing is unreachable, only un-nudgeable.
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
  stageRef.current = stage;

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

  const responder = useMemo(() => {
    const mark = (
      event: GestureResponderEvent,
      gesture: PanResponderGestureState,
    ) => {
      start.current = {
        frame: frameRef.current,
        distance: pinchDistance(event.nativeEvent.touches),
        dx: gesture.dx,
        dy: gesture.dy,
      };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: mark,
      // Fires again for every finger that lands or lifts, which is what keeps
      // a pinch from jumping when the second one arrives mid-drag.
      onPanResponderStart: mark,
      onPanResponderEnd: mark,
      onPanResponderMove: (event, gesture) => {
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
    });
  }, [apply]);

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

  const zoomBy = useCallback(
    (delta: number) => {
      const image = naturalRef.current;
      if (!image) return;
      apply(
        rezoom(image, stage, frameRef.current, frameRef.current.zoom + delta),
      );
    },
    [apply, stage],
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
          <Text
            accessibilityRole="header"
            className="mb-5 text-xl font-bold text-text-primary"
          >
            {`La foto de ${name}`}
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
              <View className="mb-3 flex-row items-center justify-center gap-5">
                <ZoomButton
                  testID="avatar-editor-zoom-out"
                  label="Alejar"
                  icon={Minus}
                  disabled={frame.zoom <= 1}
                  onPress={() => zoomBy(-ZOOM_STEP)}
                />
                <Text
                  testID="avatar-editor-zoom"
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`Zoom ${frame.zoom.toFixed(1)} aumentos`}
                  className="w-16 text-center text-text-tertiary"
                >
                  {`${frame.zoom.toFixed(1)}×`}
                </Text>
                <ZoomButton
                  testID="avatar-editor-zoom-in"
                  label="Acercar"
                  icon={Plus}
                  disabled={frame.zoom >= MAX_ZOOM}
                  onPress={() => zoomBy(ZOOM_STEP)}
                />
              </View>
              <Text className="mb-5 text-center text-xs text-text-tertiary">
                Arrástrala para colocarla y pellízcala para acercar. Así es como
                se verá.
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
              style={(state) => [{ minHeight: TOUCH_TARGET }, pressed(state)]}
              className="flex-1 items-center justify-center rounded-xl border border-border-strong py-4"
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
      style={(state) => [
        { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET },
        pressed(state),
      ]}
      className="items-center justify-center rounded-xl border border-border-strong"
    >
      <Icon
        size={20}
        strokeWidth={2.5}
        color={disabled ? colors.textMuted : colors.textSecondary}
      />
    </Pressable>
  );
}
