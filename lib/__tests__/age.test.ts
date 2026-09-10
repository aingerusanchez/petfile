import {
  ageInMonths,
  describeAge,
  formatAge,
  LIFE_STAGE_LABELS,
  lifeStage,
} from "../age";

const on = (iso: string) => new Date(`${iso}T12:00:00`);

describe("ageInMonths", () => {
  it("counts calendar months", () => {
    expect(ageInMonths("2025-09-14", on("2026-09-14"))).toBe(12);
    expect(ageInMonths("2025-09-14", on("2026-03-14"))).toBe(6);
  });

  it("does not count the month until its day comes round", () => {
    // One day short of turning one is still eleven months, not twelve.
    expect(ageInMonths("2025-09-14", on("2026-09-13"))).toBe(11);
    expect(ageInMonths("2025-09-14", on("2026-09-15"))).toBe(12);
  });

  it("is zero on the day he was born", () => {
    expect(ageInMonths("2026-09-10", on("2026-09-10"))).toBe(0);
  });

  it("has no answer for a date it cannot read", () => {
    expect(ageInMonths(null)).toBeNull();
    expect(ageInMonths("14/09/2025")).toBeNull();
    expect(ageInMonths("2025-13-01")).toBeNull();
  });

  it("refuses to invent an age for a future birth date", () => {
    // The form already rejects one; this must not answer "-2 meses".
    expect(ageInMonths("2026-11-01", on("2026-09-10"))).toBeNull();
  });
});

describe("lifeStage", () => {
  it("puts each month in the stage the thresholds say", () => {
    expect(lifeStage(0)).toBe("puppy");
    expect(lifeStage(5)).toBe("puppy");
    expect(lifeStage(6)).toBe("adolescent");
    expect(lifeStage(17)).toBe("adolescent");
    expect(lifeStage(18)).toBe("adult");
    expect(lifeStage(83)).toBe("adult");
    expect(lifeStage(84)).toBe("senior");
    expect(lifeStage(200)).toBe("senior");
  });

  it("has a Spanish label for every stage", () => {
    for (const months of [0, 6, 18, 84]) {
      expect(LIFE_STAGE_LABELS[lifeStage(months)]).toMatch(/\S/);
    }
  });
});

describe("formatAge", () => {
  it("uses months for the first two years", () => {
    expect(formatAge(1)).toBe("1 mes");
    expect(formatAge(5)).toBe("5 meses");
    expect(formatAge(15)).toBe("15 meses");
    expect(formatAge(23)).toBe("23 meses");
  });

  it("switches to whole years at two, and truncates them", () => {
    expect(formatAge(24)).toBe("2 años");
    expect(formatAge(35)).toBe("2 años");
    expect(formatAge(36)).toBe("3 años");
  });

  it("says so when the month is all that is known", () => {
    expect(formatAge(5, true)).toBe("unos 5 meses");
    expect(formatAge(24, true)).toBe("unos 2 años");
    // "unos 1 mes" is not Spanish.
    expect(formatAge(1, true)).toBe("un mes");
  });

  it("does not round a newborn up to a month", () => {
    expect(formatAge(0)).toBe("Menos de un mes");
    expect(formatAge(0, true)).toBe("Menos de un mes");
  });
});

describe("describeAge", () => {
  it("gives the header everything it needs in one call", () => {
    expect(describeAge("2025-09-14", false, on("2026-09-10"))).toEqual({
      months: 11,
      stage: "adolescent",
      stageLabel: "Adolescente",
      text: "11 meses",
    });
  });

  it("carries the approximate flag into the phrasing", () => {
    // The stored day is the 1st placeholder, so the wording has to soften.
    expect(describeAge("2019-01-01", true, on("2026-09-10"))?.text).toBe(
      "unos 7 años",
    );
    expect(describeAge("2019-01-01", true, on("2026-09-10"))?.stage).toBe(
      "senior",
    );
  });

  it("is null when there is no birth date to read", () => {
    expect(describeAge(null)).toBeNull();
  });
});
