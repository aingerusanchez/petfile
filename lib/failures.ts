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
 * What each call site was trying to do, as an infinitive the two sentences
 * below can carry: "No hay conexión para **empezar el paseo**", "Algo ha ido
 * mal por nuestro lado al **leer el día**".
 *
 * **The context was already here and only reached the console.** A tutor
 * offline photographed a diary whose log region and whose toast said the same
 * sentence — "Parece que no hay conexión. Inténtalo otra vez cuando vuelva."
 * — for two entirely different facts: the day could not be *read*, and the
 * walk could not be *started*. One is a state with its own Reintentar, the
 * other an event that happened once, and nothing on screen said so.
 * PRODUCT.md settles it: the toast carries the reason, not just the fact,
 * because "no hay conexión para guardar el paseo" is what lets a tutor decide
 * to wait rather than press again.
 *
 * **Literal, not witty.** DESIGN.md allows the voice to reach a failure, but
 * only while the way out stays explicit — and this half of the sentence is
 * the part that says which thing to try again.
 */
export const FAILURE_ACTIONS: Record<string, string> = {
  // The day and its entries.
  startWalk: "empezar el paseo",
  closeWalk: "terminar el paseo",
  logEvent: "guardar la entrada",
  updateEvent: "guardar los cambios",
  deleteEvent: "borrar la entrada",
  eventsForDay: "leer el día",
  eventsForMonths: "leer el calendario",
  incidentsFor: "leer los incidentes",
  // The animal's file.
  getMyPet: "leer la ficha",
  createPet: "registrar la ficha",
  updatePet: "guardar la ficha",
  deletePet: "borrar la ficha",
  uploadPetPhoto: "subir la foto",
  updatePetPhoto: "guardar la foto",
  removePetPhoto: "borrar la foto",
  // Salud.
  saveWeight: "guardar el peso",
  weightsFor: "leer los pesos",
  deleteWeight: "borrar el peso",
  logTreatment: "guardar el tratamiento",
  updateTreatment: "guardar el tratamiento",
  deleteTreatment: "borrar el tratamiento",
  treatmentsFor: "leer los tratamientos",
  saveVet: "guardar el veterinario",
};

/**
 * The call sites that deliberately stay generic, and why — because a failure
 * nobody can name honestly is worse named than unnamed.
 *
 * `getSession` and `signedPhotoUrl` throw their sentence away: both call this
 * for the console line alone, so there is no reader to name anything to.
 * `pickPetPhoto` and `cropToSquare` never touch the network — the picker and
 * the native manipulator fail on the device — so "no hay conexión para…"
 * would be a lie about where the fault is, and the honest version is a
 * sentence about the phone that nothing else in the app says yet.
 */
export const UNNAMED_FAILURES = [
  "getSession",
  "signedPhotoUrl",
  "pickPetPhoto",
  "cropToSquare",
] as const;

/**
 * The sentence a tutor sees, in the app's voice.
 *
 * Two shapes, because there are two things a tutor can do about a failure:
 * wait for the signal to come back, or nothing at all. A message that cannot
 * name a recovery takes responsibility instead of blaming the reader — the
 * phrasing DESIGN.md already settled on.
 *
 * Each shape has a named and an unnamed form: the named one says which action
 * failed, so two failures a tutor can meet at the same moment are never the
 * same sentence. See `FAILURE_ACTIONS`.
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

  const action = FAILURE_ACTIONS[context];

  if (cause instanceof TimeoutError || looksOffline(message)) {
    return action
      ? `No hay conexión para ${action}. Inténtalo otra vez cuando vuelva.`
      : "Parece que no hay conexión. Inténtalo otra vez cuando vuelva.";
  }

  return action
    ? `Algo ha ido mal por nuestro lado al ${action}. Vuelve a intentarlo.`
    : "Algo ha ido mal por nuestro lado. Vuelve a intentarlo.";
}
