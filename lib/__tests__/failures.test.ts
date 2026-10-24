import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeFailure,
  FAILURE_ACTIONS,
  REQUEST_TIMEOUT_MS,
  TimeoutError,
  UNNAMED_FAILURES,
  withTimeout,
} from "../failures";

describe("withTimeout", () => {
  it("passes a value straight through", async () => {
    await expect(withTimeout(Promise.resolve("ok"), "test")).resolves.toBe(
      "ok",
    );
  });

  it("accepts a thenable, which is what a Supabase query is", async () => {
    const settled = Promise.resolve("ok");
    const thenable: PromiseLike<string> = { then: settled.then.bind(settled) };
    await expect(withTimeout(thenable, "test")).resolves.toBe("ok");
  });

  it("rejects with a TimeoutError when nothing answers", async () => {
    jest.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), "getSession", 5000);
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    jest.advanceTimersByTime(5000);
    await assertion;
    jest.useRealTimers();
  });

  it("clears its timer on the happy path", async () => {
    // Otherwise a resolved request keeps a 12-second timer alive behind it,
    // which in React Native is a pending task that can outlive the screen.
    jest.useFakeTimers();
    const clear = jest.spyOn(global, "clearTimeout");
    await withTimeout(Promise.resolve(1), "test");
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
    jest.useRealTimers();
  });

  it("is generous by default: a slow answer is still an answer", () => {
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });
});

describe("describeFailure", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  afterAll(() => warn.mockRestore());

  it("names a lost connection, whatever layer reported it", () => {
    const offline =
      "Parece que no hay conexión. Inténtalo otra vez cuando vuelva.";
    expect(describeFailure(new TimeoutError("getMyPet"), "t")).toBe(offline);
    expect(describeFailure(new Error("Network request failed"), "t")).toBe(
      offline,
    );
    expect(
      describeFailure(
        new Error("fetch failed: java.net.ConnectException: Failed to connect"),
        "t",
      ),
    ).toBe(offline);
    expect(describeFailure({ message: "Failed to fetch" }, "t")).toBe(offline);
  });

  it("takes responsibility for anything else", () => {
    expect(describeFailure(new Error("not authenticated"), "t")).toBe(
      "Algo ha ido mal por nuestro lado. Vuelve a intentarlo.",
    );
    expect(describeFailure(undefined, "t")).toBe(
      "Algo ha ido mal por nuestro lado. Vuelve a intentarlo.",
    );
  });

  it("keeps the raw text as a diagnostic rather than a message", () => {
    warn.mockClear();
    describeFailure(
      new Error("java.net.ConnectException: 172.64.149.246:443"),
      "getMyPet",
    );
    expect(warn).toHaveBeenCalledWith(
      "[getMyPet]",
      "java.net.ConnectException: 172.64.149.246:443",
    );
  });
});

describe("the action a failure is about", () => {
  // Swapped rather than spied: the describe above restores the real one in
  // its own `afterAll`, which runs after this body is evaluated.
  const real = console.warn;
  beforeAll(() => {
    console.warn = () => {};
  });
  afterAll(() => {
    console.warn = real;
  });

  it("names it when the connection is what failed", () => {
    expect(
      describeFailure(new Error("Network request failed"), "startWalk"),
    ).toBe(
      "No hay conexión para empezar el paseo. Inténtalo otra vez cuando vuelva.",
    );
    expect(
      describeFailure(new TimeoutError("eventsForDay"), "eventsForDay"),
    ).toBe(
      "No hay conexión para leer el día. Inténtalo otra vez cuando vuelva.",
    );
  });

  it("names it when the fault is ours", () => {
    expect(describeFailure(new Error("boom"), "closeWalk")).toBe(
      "Algo ha ido mal por nuestro lado al terminar el paseo. Vuelve a intentarlo.",
    );
  });

  /**
   * The defect this closes: a tutor offline saw the same sentence in the log's
   * region and in the toast, and could not tell that two different things had
   * failed — a day that could not be read and a walk that could not be
   * started.
   */
  it("gives two different failures two different sentences", () => {
    const offline = new Error("Network request failed");
    expect(describeFailure(offline, "startWalk")).not.toBe(
      describeFailure(offline, "eventsForDay"),
    );
  });

  it("stays generic where the call site cannot name an action", () => {
    for (const context of UNNAMED_FAILURES) {
      expect(describeFailure(new Error("Failed to fetch"), context)).toBe(
        "Parece que no hay conexión. Inténtalo otra vez cuando vuelva.",
      );
    }
  });

  /**
   * A new call site that invents a context nobody wrote a phrase for would
   * fall back to the generic sentence silently — which is the bug this file
   * exists to stop coming back. Either name the action or add the context to
   * `UNNAMED_FAILURES`, which is a decision rather than an oversight.
   */
  it("covers every context the app actually passes", () => {
    const dir = join(process.cwd(), "lib");
    const contexts = new Set<string>();
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file === "failures.ts") continue;
      const source = readFileSync(join(dir, file), "utf8");
      for (const [, context] of source.matchAll(
        /describeFailure\([^,]+,\s*"([A-Za-z]+)"\)/g,
      )) {
        contexts.add(context);
      }
    }
    expect(contexts.has("startWalk")).toBe(true);
    expect(contexts.size).toBeGreaterThan(20);
    for (const context of contexts) {
      expect(
        context in FAILURE_ACTIONS ||
          (UNNAMED_FAILURES as readonly string[]).includes(context),
      ).toBe(true);
    }
  });
});
