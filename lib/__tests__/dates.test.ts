import {
  daysInMonth,
  formatDisplayDate,
  parseISO,
  toApproximateISO,
  toISO,
  yearChoices,
} from "../dates";

describe("parseISO", () => {
  it("splits a well-formed date", () => {
    expect(parseISO("2025-09-14")).toEqual({ year: 2025, month: 9, day: 14 });
  });

  it("rejects null, empty and malformed input", () => {
    expect(parseISO(null)).toBeNull();
    expect(parseISO("")).toBeNull();
    expect(parseISO("14/09/2025")).toBeNull();
    expect(parseISO("2025-9-14")).toBeNull();
  });

  it("rejects impossible months and days", () => {
    expect(parseISO("2025-13-01")).toBeNull();
    expect(parseISO("2025-00-01")).toBeNull();
    expect(parseISO("2025-02-30")).toBeNull();
  });

  it("accepts 29 February only in a leap year", () => {
    expect(parseISO("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseISO("2025-02-29")).toBeNull();
  });
});

describe("daysInMonth", () => {
  it("knows month lengths", () => {
    expect(daysInMonth(2025, 1)).toBe(31);
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it("handles leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe("toISO", () => {
  it("pads every component", () => {
    expect(toISO({ year: 2025, month: 9, day: 4 })).toBe("2025-09-04");
  });

  it("clamps a day that overflows its month, so switching month never yields an invalid date", () => {
    expect(toISO({ year: 2025, month: 2, day: 31 })).toBe("2025-02-28");
    expect(toISO({ year: 2024, month: 2, day: 31 })).toBe("2024-02-29");
    expect(toISO({ year: 2025, month: 4, day: 31 })).toBe("2025-04-30");
  });
});

describe("toApproximateISO", () => {
  it("pins the day to the first of the month", () => {
    expect(toApproximateISO(2025, 9)).toBe("2025-09-01");
  });
});

describe("formatDisplayDate", () => {
  it("renders an exact date in the Spanish locale order", () => {
    expect(formatDisplayDate("2025-09-14")).toBe("14/09/2025");
  });

  it("pads single-digit days and months", () => {
    expect(formatDisplayDate("2025-01-05")).toBe("05/01/2025");
  });

  it("shows only month and year for an approximate date, never the placeholder day", () => {
    expect(formatDisplayDate("2025-09-01", true)).toBe("Septiembre de 2025");
    expect(formatDisplayDate("2025-09-01", true)).not.toContain("01");
  });

  it("renders nothing for an absent or malformed value", () => {
    expect(formatDisplayDate(null)).toBe("");
    expect(formatDisplayDate("nonsense")).toBe("");
  });
});

describe("yearChoices", () => {
  it("counts back from the current year", () => {
    const years = yearChoices(new Date("2026-09-07T00:00:00Z"), 3);
    expect(years).toEqual([2026, 2025, 2024]);
  });
});
