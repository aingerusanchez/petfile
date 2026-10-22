/**
 * What makes two toasts the same toast, and what a repeat does about it.
 *
 * **The defect, from a photograph of the tutor's phone offline:** two
 * identical walls of red stacked over the diary, one per press of a failing
 * control, saying the same sentence twice. A second press that fails the same
 * way is the *same* error, and an error repeating itself verbatim pushes the
 * thing it is about off the screen.
 *
 * **Persistence was the other half of that answer, and it did not last.** The
 * rule shipped as "an error worth reading should stay readable", and a day of
 * living with it turned that into a diary the tutor had to clear by hand:
 * «lo que parece faltar es el desvanecimiento tras un tiempo». A failure now
 * fades after eight seconds (`Toast.tsx`), which is what makes the rule
 * below about a *countdown* rather than about a stack — a repeat restarts it,
 * so the second press is given the whole reading time and not the remainder
 * of the first's.
 *
 * Pure, and in `lib/` for the usual reason: this is the kind of rule that
 * would be a bug if it drifted, and it can be tested without a renderer.
 */

/** Everything that decides whether two toasts are the same one. */
export type ToastIdentity = { variant: string; message: string };

/** A toast on screen: its options, its identity and how often it has happened. */
export type QueuedToast<T extends ToastIdentity> = T & {
  key: string;
  repeats: number;
};

/**
 * The identity of a toast: **its variant and its message, nothing else.**
 *
 * The message is the whole fact a toast carries, and since `describeFailure`
 * names the action that failed, two different failures have two different
 * messages — "No hay conexión para empezar el paseo" and "No hay conexión
 * para leer el día" are two toasts, and pressing a failing control twice is
 * one. The variant is in the key because the same sentence at two severities
 * is two different statements.
 *
 * **A separator no variant can contain**, so `error` + `:a` and `error:` + `a`
 * cannot collide: `ToastVariant` is a union of plain words, and a NUL is in
 * none of them nor in any message the app writes.
 */
export function toastKey(toast: ToastIdentity): string {
  return `${toast.variant}\u0000${toast.message}`;
}

/**
 * The queue after showing `options`.
 *
 * A toast nobody is showing is appended. One already on screen is **counted
 * where it is** — not moved to the end, not re-entered, not replaced: moving
 * it would animate a second failure as if it were a new message, and
 * replacing it would swap the live action out from under a thumb. The count
 * is what tells the tutor their second press failed too, which is the
 * quietest honest answer: the control they pressed has already shaken.
 *
 * **The countdown goes back to the start**, which is `Toast.tsx`'s doing and
 * is what "counted where it is" has to mean now that a failure fades: a
 * repeat that inherited the remainder of the first toast's eight seconds
 * would give the second press less reading time than the first, in the one
 * direction that costs the tutor the message.
 *
 * The options kept are the ones the toast on screen was created with, because
 * those are the ones its action — and, on a toast that persists, its dismiss
 * control — are wired to.
 */
export function queueToast<T extends ToastIdentity>(
  queue: readonly QueuedToast<T>[],
  options: T,
): QueuedToast<T>[] {
  const key = toastKey(options);
  const shown = queue.findIndex((toast) => toast.key === key);
  if (shown === -1) return [...queue, { ...options, key, repeats: 1 }];
  return queue.map((toast, index) =>
    index === shown ? { ...toast, repeats: toast.repeats + 1 } : toast,
  );
}
