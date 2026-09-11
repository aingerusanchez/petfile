import {
  addDays,
  isStandardVaccine,
  VACCINE_NAMES,
  VACCINE_OTHER,
  vaccineNote,
  TREATMENT_INTERVAL_DAYS,
  TREATMENT_KINDS,
  treatmentCadence,
  dateKey,
  daysBetween,
  dueStatus,
  fromDateKey,
  pending,
  proposeNextDue,
  scheduleKey,
  treatmentLabel,
  validateTreatment,
  type PetTreatmentRow,
} from "../treatments";

const given = (
  kind: PetTreatmentRow["kind"],
  name: string | null,
  administered_on: string,
  next_due_on: string | null,
): PetTreatmentRow => ({
  id: `${kind}-${name}-${administered_on}`,
  pet_id: "p",
  kind,
  name,
  administered_on,
  next_due_on,
  note: null,
  created_by: null,
  created_at: `${administered_on}T10:00:00Z`,
  updated_at: `${administered_on}T10:00:00Z`,
});

describe("dates", () => {
  it("reads an ISO day as the local day it names", () => {
    // `new Date("2026-09-11")` is UTC midnight, which is the 10th in Madrid —
    // the same trap the calendar's cells hit from the other side.
    const day = fromDateKey("2026-09-11");
    expect(day?.getFullYear()).toBe(2026);
    expect(day?.getMonth()).toBe(8);
    expect(day?.getDate()).toBe(11);
  });

  it("survives the clocks going back", () => {
    // Madrid moves on 25 October. Adding 86,400,000ms a day lands an hour
    // early across it, which is the previous date — on the one field this
    // module exists to get right.
    expect(dateKey(addDays(new Date(2026, 9, 20), 10))).toBe("2026-10-30");
    expect(dateKey(addDays(new Date(2026, 2, 25), 10))).toBe("2026-04-04");
    expect(daysBetween(new Date(2026, 9, 20), new Date(2026, 9, 30))).toBe(10);
  });

  it("counts backwards for a date already past", () => {
    expect(daysBetween(new Date(2026, 8, 11), new Date(2026, 8, 4))).toBe(-7);
    expect(daysBetween(new Date(2026, 8, 11), new Date(2026, 8, 11))).toBe(0);
  });
});

describe("proposeNextDue", () => {
  const on = new Date(2026, 8, 11);

  it("offers the adult schedule for each kind", () => {
    expect(dateKey(proposeNextDue("vaccine", on))).toBe("2027-09-11");
    expect(dateKey(proposeNextDue("deworming", on))).toBe("2026-12-10");
    expect(dateKey(proposeNextDue("antiparasitic", on))).toBe("2026-10-11");
  });
});

describe("dueStatus", () => {
  const today = new Date(2026, 8, 11);

  it("separates late from soon from later", () => {
    expect(dueStatus("2026-09-10", today)).toBe("overdue");
    expect(dueStatus("2026-09-11", today)).toBe("soon");
    expect(dueStatus("2026-09-25", today)).toBe("soon");
    expect(dueStatus("2026-09-26", today)).toBe("later");
  });
});

describe("scheduleKey", () => {
  it("keeps two vaccines on two clocks", () => {
    // Grouping vaccines by kind alone would let a rabies shot replace the
    // pentavalente's due date, and the one it replaced is the one nobody
    // gets reminded about.
    expect(scheduleKey({ kind: "vaccine", name: "Rabia" })).not.toBe(
      scheduleKey({ kind: "vaccine", name: "Pentavalente" }),
    );
    expect(scheduleKey({ kind: "vaccine", name: " rabia " })).toBe(
      scheduleKey({ kind: "vaccine", name: "Rabia" }),
    );
  });

  it("puts every product of one deworming on one clock", () => {
    // Measured against nine months of a real puppy's records: Panacur,
    // Panacur 500mg and Milbemax are not three schedules, they are whatever
    // the vet handed over that month for the same habit. Keyed by name, the
    // pending section listed all three and shouted that one had expired in
    // April — five months after the dose that had already replaced it.
    const key = scheduleKey({ kind: "deworming", name: "Panacur" });
    expect(scheduleKey({ kind: "deworming", name: "Panacur 500mg" })).toBe(key);
    expect(scheduleKey({ kind: "deworming", name: "Milbemax" })).toBe(key);
    expect(scheduleKey({ kind: "deworming", name: null })).toBe(key);
    expect(scheduleKey({ kind: "antiparasitic", name: "Nexgard" })).not.toBe(
      key,
    );
  });
});

describe("pending", () => {
  it("keeps only the latest of each schedule", () => {
    const rows = [
      given("vaccine", "Polivalente", "2026-08-01", "2027-08-01"),
      given("vaccine", "Polivalente", "2025-08-02", "2026-08-02"),
    ];
    expect(pending(rows).map((row) => row.next_due_on)).toEqual(["2027-08-01"]);
  });

  it("lists two named vaccines separately", () => {
    const rows = [
      given("vaccine", "Rabia", "2026-06-01", "2027-06-01"),
      given("vaccine", "Polivalente", "2026-08-01", "2027-08-01"),
    ];
    expect(pending(rows)).toHaveLength(2);
  });

  it("collapses a year of dewormings into the one that is still standing", () => {
    // The real shape of the defect this fixed: three products, one habit, and
    // two expired reminders from doses that had already been superseded.
    const rows = [
      given("deworming", "Panacur", "2026-01-05", "2026-04-05"),
      given("deworming", "Panacur 500mg", "2025-12-26", "2026-03-26"),
      given("deworming", "Milbemax", "2026-04-15", "2026-07-14"),
      given("deworming", "Milbemax", "2026-07-14", "2026-10-12"),
      given("antiparasitic", "Nexgard", "2026-09-02", "2026-10-11"),
    ];
    expect(pending(rows).map((row) => [row.kind, row.next_due_on])).toEqual([
      ["antiparasitic", "2026-10-11"],
      ["deworming", "2026-10-12"],
    ]);
  });

  it("drops what has no next date, because a one-off is not pending", () => {
    const rows = [
      given("deworming", null, "2026-08-01", null),
      given("antiparasitic", "Seresto", "2026-09-01", "2026-10-01"),
    ];
    expect(pending(rows).map((row) => row.kind)).toEqual(["antiparasitic"]);
  });

  it("sorts soonest first", () => {
    const rows = [
      given("vaccine", null, "2026-08-01", "2027-08-01"),
      given("antiparasitic", null, "2026-09-01", "2026-10-01"),
      given("deworming", null, "2026-07-01", "2026-09-29"),
    ];
    expect(pending(rows).map((row) => row.next_due_on)).toEqual([
      "2026-09-29",
      "2026-10-01",
      "2027-08-01",
    ]);
  });

  it("says nothing when nothing was ever logged", () => {
    expect(pending([])).toEqual([]);
  });
});

describe("validateTreatment", () => {
  const administeredOn = new Date(2026, 8, 11);

  it("accepts a treatment with no next date", () => {
    expect(validateTreatment({ kind: "deworming", administeredOn })).toEqual(
      {},
    );
  });

  it("refuses a next date before the one given", () => {
    expect(
      validateTreatment({
        kind: "vaccine",
        administeredOn,
        nextDueOn: new Date(2026, 8, 10),
      }).nextDueOn,
    ).toBeTruthy();
  });

  it("allows the same day, which the column allows too", () => {
    expect(
      validateTreatment({
        kind: "vaccine",
        administeredOn,
        nextDueOn: new Date(2026, 8, 11),
      }),
    ).toEqual({});
  });
});

describe("the vaccine list", () => {
  it("recognises a standard name however it was typed", () => {
    expect(isStandardVaccine("Rabia")).toBe(true);
    expect(isStandardVaccine(" rabia ")).toBe(true);
    expect(isStandardVaccine("Tos de las perreras")).toBe(true);
  });

  it("does not claim one it has never heard of", () => {
    // The rows written before the list existed reopen on "Otra" with their
    // own name intact: a closed list must not rewrite what somebody already
    // wrote down.
    expect(isStandardVaccine("Pentavalente")).toBe(false);
    expect(isStandardVaccine(null)).toBe(false);
    expect(isStandardVaccine("")).toBe(false);
  });

  it("keeps the valencies as one schedule", () => {
    // Penta, hexa and octovalente are the same annual booster. Offering them
    // separately would split the very pauta the list exists to hold together,
    // so the list says "Polivalente" and the note explains it.
    expect(VACCINE_NAMES).not.toContain("Pentavalente");
    expect(VACCINE_NAMES).toContain("Polivalente");
    expect(vaccineNote("Polivalente")).toContain("hexa");
    expect(vaccineNote("Rabia")).toBeNull();
  });

  it("never offers the escape hatch as a name", () => {
    expect(VACCINE_NAMES).not.toContain(VACCINE_OTHER);
  });
});

describe("treatmentCadence", () => {
  it("says the interval in the words a household uses", () => {
    expect(treatmentCadence("vaccine")).toBe("cada año");
    expect(treatmentCadence("deworming")).toBe("cada 3 meses");
    expect(treatmentCadence("antiparasitic")).toBe("cada mes");
  });

  it("is derived from the interval, so the two cannot drift", () => {
    // The point of the assertion: change TREATMENT_INTERVAL_DAYS and the
    // sentence follows, rather than the app stating a schedule it no longer
    // keeps on the one screen whose job is keeping schedules.
    for (const kind of TREATMENT_KINDS) {
      const days = TREATMENT_INTERVAL_DAYS[kind];
      const months = Math.round(days / 30);
      expect(treatmentCadence(kind)).toContain(
        days % 365 === 0 ? "año" : months === 1 ? "mes" : String(months),
      );
    }
  });
});

describe("treatmentLabel", () => {
  it("names each kind in the household's words", () => {
    expect(treatmentLabel("vaccine")).toBe("Vacuna");
    // The qualifier is the point: without it these two name the same idea
    // twice to anybody who has not had the vet explain it.
    expect(treatmentLabel("deworming")).toBe("Desparasitación (Int.)");
    expect(treatmentLabel("antiparasitic")).toBe("Antiparasitario (Ext.)");
  });
});
