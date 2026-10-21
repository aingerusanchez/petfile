import { queueToast, toastKey, type ToastIdentity } from "../toasts";

type Queued<T extends ToastIdentity> = T & { key: string; repeats: number };

const offline = {
  variant: "error",
  message: "No hay conexión para empezar el paseo.",
} as const;

function queue(...shown: ToastIdentity[]): Queued<ToastIdentity>[] {
  return shown.reduce<Queued<ToastIdentity>[]>(
    (current, options) => queueToast(current, options),
    [],
  );
}

describe("toastKey", () => {
  it("is the variant and the message together", () => {
    expect(toastKey(offline)).toBe(toastKey({ ...offline }));
    expect(toastKey(offline)).not.toBe(
      toastKey({ ...offline, variant: "warning" }),
    );
    expect(toastKey(offline)).not.toBe(
      toastKey({ ...offline, message: "No hay conexión para leer el día." }),
    );
  });

  /**
   * Otherwise `error` + `:nada` and `error:` + `nada` are the same toast, and
   * two unrelated failures would swallow each other.
   */
  it("cannot be collided by a message that contains the separator", () => {
    expect(toastKey({ variant: "error", message: "a:b" })).not.toBe(
      toastKey({ variant: "error:a", message: "b" }),
    );
  });
});

describe("queueToast", () => {
  it("adds a toast nobody is already showing", () => {
    const shown = queue(offline);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ ...offline, repeats: 1 });
  });

  /**
   * The defect: two presses of a failing control stacked two identical walls
   * of red over the diary. The second press is the same error, so it is the
   * same toast — counted, not repeated.
   */
  it("counts an identical failure instead of stacking a second one", () => {
    const shown = queue(offline, offline, offline);
    expect(shown).toHaveLength(1);
    expect(shown[0].repeats).toBe(3);
  });

  it("stacks two failures that are not the same failure", () => {
    const shown = queue(offline, {
      variant: "error",
      message: "No hay conexión para leer el día.",
    });
    expect(shown).toHaveLength(2);
    expect(shown.every((toast) => toast.repeats === 1)).toBe(true);
  });

  it("stacks the same sentence in two different variants", () => {
    const shown = queue(offline, { ...offline, variant: "warning" });
    expect(shown).toHaveLength(2);
  });

  it("leaves a repeat where it already was, rather than moving it", () => {
    const first = { variant: "success", message: "Peso guardado" };
    const shown = queueToast(queue(first, offline), first);
    expect(shown.map((toast) => toast.message)).toEqual([
      first.message,
      offline.message,
    ]);
    expect(shown[0].repeats).toBe(2);
  });

  /** The first one is the one on screen, so its action is the live one. */
  it("keeps the options the toast on screen was created with", () => {
    const press = () => {};
    const first = {
      ...offline,
      persist: true,
      action: { label: "Reintentar", onPress: press },
    };
    const shown = queueToast(queueToast<typeof first>([], first), {
      ...first,
      persist: false,
      action: { label: "Otro", onPress: () => {} },
    });
    expect(shown).toHaveLength(1);
    expect(shown[0].persist).toBe(true);
    expect(shown[0].action.onPress).toBe(press);
  });

  it("does not mutate the queue it was given", () => {
    const before = queue(offline);
    const after = queueToast(before, offline);
    expect(before[0].repeats).toBe(1);
    expect(after).not.toBe(before);
  });
});
