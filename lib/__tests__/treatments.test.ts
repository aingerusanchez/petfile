import {
  addDays,
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
    // Grouping by kind alone would let a rabies shot replace the polivalente's
    // due date, and the one it replaced is the one nobody gets reminded about.
    expect(scheduleKey({ kind: "vaccine", name: "Rabia" })).not.toBe(
      scheduleKey({ kind: "vaccine", name: "Polivalente" }),
    );
    // The same schedule typed twice is one schedule.
    expect(scheduleKey({ kind: "vaccine", name: " rabia " })).toBe(
      scheduleKey({ kind: "vaccine", name: "Rabia" }),
    );
    expect(scheduleKey({ kind: "vaccine", name: null })).toBe(
      scheduleKey({ kind: "vaccine", name: "  " }),
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

describe("treatmentLabel", () => {
  it("names each kind in the household's words", () => {
    expect(treatmentLabel("vaccine")).toBe("Vacuna");
    expect(treatmentLabel("deworming")).toBe("Desparasitación");
    expect(treatmentLabel("antiparasitic")).toBe("Antiparasitario");
  });
});
