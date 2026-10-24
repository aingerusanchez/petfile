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
import { queueToast, toastKey, type QueuedToast } from "../../lib/toasts";
import { Toast, type ToastOptions } from "./Toast";
import { PAGE_GUTTER, spacing } from "./tokens";

type Queued = QueuedToast<ToastOptions>;

/**
 * Routes with no bottom tab bar. Everything else is inside the `(tabs)` group,
 * so the toast has to clear it — the host lives above the navigator and cannot
 * ask React Navigation for the bar's height from up there.
 */
const ROUTES_WITHOUT_TAB_BAR = ["/login", "/onboarding"];

/** Android Material navigation-bar height. */
const TAB_BAR_HEIGHT = 56;

type ToastApi = {
  /**
   * Queue a toast. Returns its key, so a persistent one can be closed by code.
   *
   * **The key is the toast's identity, not a serial number**, which is what
   * makes a repeat of the same failure find the toast already on screen —
   * including through this return value, where a fresh id would have handed
   * the caller a `dismiss` that silently did nothing.
   */
  show: (options: ToastOptions) => string;
  dismiss: (key: string) => void;
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
 *
 * **Identical errors do not accumulate.** Two presses of a failing control
 * used to stack two identical walls of red over the diary — photographed on
 * the tutor's phone offline, with a third copy of the same sentence in the
 * log's own region. A toast whose variant and message match one already up is
 * counted on that toast instead of added beside it; `lib/toasts.ts` holds the
 * rule and the reasoning.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const clearsTabBar = !ROUTES_WITHOUT_TAB_BAR.includes(pathname);

  const dismiss = useCallback((key: string) => {
    setQueue((current) => current.filter((toast) => toast.key !== key));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    setQueue((current) => queueToast(current, options));
    // Derived from the options rather than read out of the updater, which
    // React may not have run yet: the key is a pure function of what was
    // asked for, so it is the same answer either way.
    return toastKey(options);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {queue.length > 0 ? (
        <View
          testID="toast-host"
          style={{
            position: "absolute",
            // In the style, not as a prop: the prop form is deprecated and
            // warns on every render.
            pointerEvents: "box-none",
            left: PAGE_GUTTER + insets.left,
            right: PAGE_GUTTER + insets.right,
            bottom:
              spacing.md + insets.bottom + (clearsTabBar ? TAB_BAR_HEIGHT : 0),
            gap: spacing.sm,
          }}
        >
          {queue.map(({ key, ...toast }) => (
            <Toast
              key={key}
              testID={`toast-${toast.variant}`}
              {...toast}
              onDismiss={() => dismiss(key)}
            />
          ))}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
