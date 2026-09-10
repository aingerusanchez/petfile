/**
 * What the app says when a request does not come back.
 *
 * Two problems this closes, both found by running the app on a phone that had
 * dropped off the network.
 *
 * **Nothing bounded a request.** `supabase-js` uses `fetch` with no timeout,
 * so a radio that accepts the connection and then answers nothing leaves the
 * promise pending for as long as the OS keeps the socket. Measured: the launch
 * screen span for minutes with `AuthRetryableFetchError` in the log and
 * nothing on screen — the one failure mode a user cannot tell from a hang,
 * because it *is* one.
 *
 * **The message was the transport's.** A failure surfaced
 * "fetch failed: java.net.ConnectException: Failed to connect to
 * <host>/172.64.149.246:443" to a tutor. That names neither the problem nor
 * the recovery, which is what DESIGN.md asks an error to do. The raw text
 * still goes to the console, where it belongs.
 */

/**
 * How long a request may take before the app stops waiting.
 *
 * Twelve seconds is deliberately generous: this is a phone, often on a weak
 * signal in a vet's waiting room, and a slow answer is still an answer. It is
 * a ceiling on silence, not a performance budget.
 */
export const REQUEST_TIMEOUT_MS = 12_000;

export class TimeoutError extends Error {
  constructor(readonly what: string) {
    super(`${what} did not answer in ${REQUEST_TIMEOUT_MS}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Rejects with a `TimeoutError` when `work` has not settled in time.
 *
 * The timer is always cleared, including on the happy path, so a resolved
 * request cannot keep the app awake for twelve seconds after the fact.
 */
export async function withTimeout<T>(
  // `PromiseLike`, not `Promise`: a Supabase query builder is a thenable that
  // only becomes a request when it is awaited, and it has no `.catch`.
  work: PromiseLike<T>,
  what: string,
  ms: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(what)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Reads like a connection that never happened, whatever layer named it. */
function looksOffline(message: string): boolean {
  return /network request failed|fetch failed|connectexception|failed to fetch|timeout|timed out|econnrefused|enotfound|unable to resolve host/i.test(
    message,
  );
}

/**
 * The sentence a tutor sees, in the app's voice.
 *
 * Two shapes, because there are two things a tutor can do about a failure:
 * wait for the signal to come back, or nothing at all. A message that cannot
 * name a recovery takes responsibility instead of blaming the reader — the
 * phrasing DESIGN.md already settled on.
 */
export function describeFailure(cause: unknown, context: string): string {
  // Not just `Error`: Supabase hands back a plain `PostgrestError` object, so
  // reading only `instanceof Error` threw away the very message this function
  // exists to classify.
  const message =
    typeof cause === "string"
      ? cause
      : cause instanceof Error
        ? cause.message
        : typeof cause === "object" &&
            cause !== null &&
            "message" in cause &&
            typeof (cause as { message: unknown }).message === "string"
          ? (cause as { message: string }).message
          : "";

  // The raw text is a diagnostic, not a message: it goes where diagnostics go.
  if (message) console.warn(`[${context}]`, message);

  if (cause instanceof TimeoutError || looksOffline(message)) {
    return "Parece que no hay conexión. Inténtalo otra vez cuando vuelva.";
  }

  return "Algo ha ido mal por nuestro lado. Vuelve a intentarlo.";
}
