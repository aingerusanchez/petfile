import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { TOUCH_TARGET } from "./tokens";

/** The thumb's diameter in dp. Smaller than the touch target it sits inside. */
const THUMB = 20;

type SliderProps = {
  value: number;
  min: number;
  max: number;
  /** Rounds the value as it is dragged. Omit for a continuous slider. */
  step?: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** How the current value is read aloud, when the number alone would not do. */
  accessibilityValueText?: string;
  testID?: string;
};

/**
 * A single-value slider, built here rather than pulled in.
 *
 * `@react-native-community/slider` is a native module, and this app would take
 * a rebuild and a platform's own look for one control — the design system has
 * one radius, one border weight and one accent, and a platform slider honours
 * none of them.
 *
 * **The track is the touch target, not the thumb.** The thumb is 20dp, which
 * is well under Android's 48dp floor; the row it sits in is 48dp tall and the
 * whole width of it responds, so a tap anywhere jumps the value there. That is
 * also what makes the control usable without a drag at all.
 *
 * **It is adjustable to a screen reader**, which is the reason it exists
 * alongside the zoom buttons rather than instead of them: `role="adjustable"`
 * with increment and decrement actions means TalkBack's volume-style gesture
 * moves it, and the buttons remain for anyone who wants a discrete step.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  accessibilityValueText,
  testID,
}: SliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const emit = useCallback(
    (x: number) => {
      const travel = widthRef.current - THUMB;
      if (travel <= 0) return;
      const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / travel));
      const raw = min + ratio * (max - min);
      onChange(step ? Math.round(raw / step) * step : raw);
    },
    [min, max, step, onChange],
  );

  // The responder is built once, so it reaches the live handler through a ref
  // rather than closing over the one it was created with. The ref is written
  // in an effect and read only inside `track`, which is what keeps this out of
  // render — a ref touched during render is the defect `react-hooks/refs`
  // exists to catch, and a `PanResponder.create` call in a `useRef` argument
  // or a `useMemo` body *is* render.
  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  // `locationX` is measured from this view's left edge and keeps tracking when
  // the finger runs off either end, where `emit` clamps it. That is also what
  // makes a plain tap on the track jump the value there.
  const track = useCallback((event: GestureResponderEvent) => {
    emitRef.current(event.nativeEvent.locationX);
  }, []);

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
        onPanResponderGrant: track,
        onPanResponderMove: track,
      }),
    [track],
  );

  const span = max - min || 1;
  const ratio = Math.min(1, Math.max(0, (value - min) / span));
  const travel = Math.max(0, width - THUMB);

  const nudge = (direction: 1 | -1) => {
    const amount = step ?? span / 20;
    onChange(Math.min(max, Math.max(min, value + direction * amount)));
  };

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min,
        max,
        now: value,
        text: accessibilityValueText,
      }}
      // The web renders the role and drops the value: react-native-web has no
      // mapping for `accessibilityValue`, the same gap that made Checkbox and
      // Button spell out `aria-checked` and `aria-disabled` by hand. Without
      // these the control announces as a slider with no position.
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={accessibilityValueText}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        nudge(event.nativeEvent.actionName === "decrement" ? -1 : 1)
      }
      style={{ height: TOUCH_TARGET, justifyContent: "center" }}
      {...responder.panHandlers}
    >
      {/* Steel Frost for the unfilled track, not Fjord Slate: this control
          lives on a Fjord Slate sheet, and the goal bar's trick of using the
          content surface on the page ground does not transfer — the track
          disappeared into the panel. Measured, this reads at 1.67:1, above the
          1.29:1 the grouping hairline already holds. */}
      <View className="h-1 rounded-xl bg-border-strong">
        <View
          style={{ width: THUMB / 2 + ratio * travel }}
          className="h-1 rounded-xl bg-accent-secondary"
        />
      </View>
      {/* Round, which is what a thumb is: the radius rule governs corners, and
          a control with no corners has none to govern. */}
      <View
        style={{
          position: "absolute",
          left: ratio * travel,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          pointerEvents: "none",
        }}
        className="border border-border-strong bg-accent-primary"
      />
    </View>
  );
}
