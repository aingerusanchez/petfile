import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast, type ToastOptions } from "./Toast";
import { PAGE_GUTTER, spacing } from "./tokens";

type Queued = ToastOptions & { id: number };

/**
 * Routes with no bottom tab bar. Everything else is inside the `(tabs)` group,
 * so the toast has to clear it — the host lives above the navigator and cannot
 * ask React Navigation for the bar's height from up there.
 */
const ROUTES_WITHOUT_TAB_BAR = ["/login", "/onboarding"];

/** Android Material navigation-bar height. */
const TAB_BAR_HEIGHT = 56;

type ToastApi = {
  /** Queue a toast. Returns its id, so a persistent one can be closed by code. */
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Hosts the toast stack above everything else.
 *
 * **It has to live above the navigator.** A toast rendered by a screen dies
 * with that screen, which is exactly wrong for the most important case: a
 * create that succeeds and then navigates away would unmount its own
 * confirmation before it could be read. Mounting the host in the root layout,
 * outside the `Stack`, is what lets a message outlive the screen that sent it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const clearsTabBar = !ROUTES_WITHOUT_TAB_BAR.includes(pathname);

  const dismiss = useCallback((id: number) => {
    setQueue((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    // Date.now() would collide for two toasts queued in the same millisecond,
    // which is entirely possible from one handler.
    const id = nextId++;
    setQueue((current) => [...current, { ...options, id }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {queue.length > 0 ? (
        <View
          testID="toast-host"
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: PAGE_GUTTER + insets.left,
            right: PAGE_GUTTER + insets.right,
            bottom:
              spacing.md + insets.bottom + (clearsTabBar ? TAB_BAR_HEIGHT : 0),
            gap: spacing.sm,
          }}
        >
          {queue.map((toast) => (
            <Toast
              key={toast.id}
              testID={`toast-${toast.variant}`}
              {...toast}
              onDismiss={() => dismiss(toast.id)}
            />
          ))}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

let nextId = 1;

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
