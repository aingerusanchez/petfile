import {
  describeFailure,
  REQUEST_TIMEOUT_MS,
  TimeoutError,
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
