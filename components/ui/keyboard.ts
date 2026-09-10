import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * How much of the screen the software keyboard is covering, in dp.
 *
 * Under edge-to-edge — which this app runs with — Android no longer resizes
 * the window when the keyboard opens, so nothing moves out of its way on its
 * own. Treating the keyboard as a bottom inset is what gives content somewhere
 * to go: `Screen` adds it to the page's padding, and `Sheet` lifts the panel
 * by it.
 *
 * The listeners never fire on the web, where the value stays 0 and the browser
 * handles its own layout.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (event) =>
      setInset(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => setInset(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return inset;
}
