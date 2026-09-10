import {
  birthdayOn,
  daysAgo,
  daysInMonth,
  formatDayDate,
  formatDayHeadline,
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

describe("daysAgo", () => {
  it("counts whole days from local midnight, whatever the clock says", () => {
    // 23:50 yesterday to 00:10 today is one day, not eleven hours.
    expect(
      daysAgo(new Date(2026, 8, 9, 23, 50), new Date(2026, 8, 10, 0, 10)),
    ).toBe(1);
    expect(
      daysAgo(new Date(2026, 8, 10, 0, 10), new Date(2026, 8, 10, 23, 50)),
    ).toBe(0);
  });

  it("crosses a month and a year", () => {
    expect(daysAgo(new Date(2026, 7, 31), new Date(2026, 8, 1))).toBe(1);
    expect(daysAgo(new Date(2025, 11, 31), new Date(2026, 0, 1))).toBe(1);
  });

  it("is negative for a day in the future", () => {
    expect(daysAgo(new Date(2026, 8, 11), new Date(2026, 8, 10))).toBe(-1);
  });
});

describe("formatDayHeadline", () => {
  const today = new Date(2026, 8, 10); // a Thursday

  it("names the two days a person names", () => {
    expect(formatDayHeadline(today, today)).toBe("Hoy");
    expect(formatDayHeadline(new Date(2026, 8, 9), today)).toBe("Ayer");
  });

  it("reaches for the weekday from two days back", () => {
    // "Anteayer" is not what anyone says any more.
    expect(formatDayHeadline(new Date(2026, 8, 8), today)).toBe("Martes");
    expect(formatDayHeadline(new Date(2026, 8, 6), today)).toBe("Domingo");
    expect(formatDayHeadline(new Date(2026, 7, 20), today)).toBe("Jueves");
  });
});

describe("formatDayDate", () => {
  it("gives the date without the weekday, lowercase month", () => {
    expect(formatDayDate(new Date(2026, 8, 10))).toBe("10 de septiembre");
    expect(formatDayDate(new Date(2026, 0, 1))).toBe("1 de enero");
  });
});

describe("birthdayOn", () => {
  const on = (iso: string, birth: string | null) =>
    birthdayOn(new Date(`${iso}T12:00:00`), birth);

  it("counts the years turned on the day itself", () => {
    expect(on("2026-09-14", "2025-09-14")).toBe(1);
    expect(on("2033-09-14", "2025-09-14")).toBe(8);
  });

  it("is null on every other day", () => {
    expect(on("2026-09-13", "2025-09-14")).toBeNull();
    expect(on("2026-09-15", "2025-09-14")).toBeNull();
    expect(on("2026-10-14", "2025-09-14")).toBeNull();
  });

  it("returns 0 on the day of birth, which is not yet a birthday", () => {
    expect(on("2025-09-14", "2025-09-14")).toBe(0);
  });

  it("is null before the animal existed", () => {
    expect(on("2024-09-14", "2025-09-14")).toBeNull();
  });

  it("matches the 1st for an approximate date, with no special case", () => {
    // Stored as YYYY-MM-01 with birth_date_approximate = true.
    expect(on("2026-04-01", "2024-04-01")).toBe(2);
    expect(on("2026-04-02", "2024-04-01")).toBeNull();
  });

  it("has no birthday without a birth date", () => {
    expect(on("2026-09-14", null)).toBeNull();
    expect(on("2026-09-14", "nonsense")).toBeNull();
  });

  it("survives a leap day by simply not matching a year without one", () => {
    expect(on("2028-02-29", "2024-02-29")).toBe(4);
    expect(on("2027-03-01", "2024-02-29")).toBeNull();
  });
});
