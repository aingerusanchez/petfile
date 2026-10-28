import {
  elapsedMinutes,
  NO_RUNNING_WALKS,
  parseRunningWalk,
  walkOutcome,
  withoutRunningWalk,
  withRunningWalk,
} from "../walk";

const at = (iso: string) => new Date(iso);
const after = (from: Date, ms: number) => new Date(from.getTime() + ms);
const MINUTE = 60_000;

describe("parseRunningWalk", () => {
  it("reads back what it wrote", () => {
    expect(parseRunningWalk(withRunningWalk(null, "p1", "walk-1"), "p1")).toBe(
      "walk-1",
    );
  });

  it("returns null for nothing stored", () => {
    expect(parseRunningWalk(null, "p1")).toBeNull();
  });

  it("returns null for a corrupt blob rather than throwing", () => {
    expect(parseRunningWalk("{not json", "p1")).toBeNull();
  });

  it("returns null when the id is not a string", () => {
    expect(parseRunningWalk(JSON.stringify({ id: 7 }), "p1")).toBeNull();
  });

  it("guarda un paseo por mascota sin pisar el de la otra", () => {
    const a = withRunningWalk(null, "p1", "w1");
    const b = withRunningWalk(a, "p2", "w2");
    expect(parseRunningWalk(b, "p1")).toBe("w1");
    expect(parseRunningWalk(b, "p2")).toBe("w2");
  });

  it("una mascota sin paseo abierto no tiene paseo", () => {
    expect(
      parseRunningWalk(withRunningWalk(null, "p1", "w1"), "p2"),
    ).toBeNull();
  });

  it("quitar el de una deja el de la otra", () => {
    const two = withRunningWalk(withRunningWalk(null, "p1", "w1"), "p2", "w2");
    const left = withoutRunningWalk(two, "p1");
    expect(parseRunningWalk(left, "p1")).toBeNull();
    expect(parseRunningWalk(left, "p2")).toBe("w2");
  });

  it("quitar la última deja el blob que dice que no hay ninguna", () => {
    const one = withRunningWalk(null, "p1", "w1");
    expect(withoutRunningWalk(one, "p1")).toBe(NO_RUNNING_WALKS);
    expect(withoutRunningWalk(null, "p1")).toBe(NO_RUNNING_WALKS);
    expect(withoutRunningWalk(one, "p2")).not.toBe(NO_RUNNING_WALKS);
  });

  // Review Focus 2: se actualiza la app con un paseo abierto.
  it("adopta el blob viejo de una sola ranura", () => {
    expect(parseRunningWalk(JSON.stringify({ id: "w1" }), "p1")).toBe("w1");
  });

  it("la primera escritura reescribe el blob viejo en la forma nueva", () => {
    const next = withRunningWalk(JSON.stringify({ id: "w1" }), "p2", "w2");
    expect(parseRunningWalk(next, "p2")).toBe("w2");
    expect(parseRunningWalk(next, "p1")).toBeNull();
  });

  it("lo que no se entiende es nada", () => {
    expect(parseRunningWalk("{not json", "p1")).toBeNull();
    expect(
      parseRunningWalk(JSON.stringify({ walks: { p1: 7 } }), "p1"),
    ).toBeNull();
  });
});

describe("elapsedMinutes", () => {
  const start = at("2026-10-15T11:02:00");

  it("counts whole minutes only", () => {
    expect(elapsedMinutes(start, after(start, 18 * MINUTE + 59_000))).toBe(18);
  });

  it("never goes negative", () => {
    expect(elapsedMinutes(start, after(start, -5 * MINUTE))).toBe(0);
  });
});

describe("walkOutcome", () => {
  const start = at("2026-10-15T11:02:00");

  it("discards a walk under a minute", () => {
    expect(walkOutcome(start, after(start, 59_000))).toEqual({
      action: "discard",
    });
  });

  it("closes a walk at exactly one minute", () => {
    expect(walkOutcome(start, after(start, MINUTE))).toEqual({
      action: "close",
      minutes: 1,
    });
  });

  it("stores the same number the counter was showing", () => {
    const now = after(start, 29 * MINUTE + 45_000);
    expect(elapsedMinutes(start, now)).toBe(29);
    expect(walkOutcome(start, now)).toEqual({ action: "close", minutes: 29 });
  });

  it("closes a walk that crossed midnight", () => {
    const night = at("2026-10-15T23:40:00");
    expect(walkOutcome(night, at("2026-10-16T00:10:00"))).toEqual({
      action: "close",
      minutes: 30,
    });
  });

  it("abandons a walk past the column's ceiling", () => {
    expect(walkOutcome(start, after(start, 1441 * MINUTE))).toEqual({
      action: "abandon",
    });
  });

  it("abandons rather than discards when the clock went backwards", () => {
    expect(walkOutcome(start, after(start, -MINUTE))).toEqual({
      action: "abandon",
    });
  });
});
