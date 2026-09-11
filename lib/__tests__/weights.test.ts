import {
  formatChange,
  formatWeight,
  measuredKey,
  parseWeight,
  validateWeight,
  weightChange,
  weightInput,
  type PetWeightRow,
} from "../weights";

const weighed = (measured_on: string, grams: number): PetWeightRow => ({
  id: measured_on,
  pet_id: "p",
  measured_on,
  grams,
  note: null,
  created_by: null,
  created_at: `${measured_on}T10:00:00Z`,
  updated_at: `${measured_on}T10:00:00Z`,
});

describe("parseWeight", () => {
  it("takes both decimal separators", () => {
    // The Spanish keyboard's decimal key is a comma and the numeric pad's is a
    // full stop; the same tutor hits both depending on which field opened.
    expect(parseWeight("12,4")).toBe(12400);
    expect(parseWeight("12.4")).toBe(12400);
    expect(parseWeight("12")).toBe(12000);
    expect(parseWeight(" 12,4 ")).toBe(12400);
  });

  it("treats what is on the way to a number as not a number yet", () => {
    // A real keyboard fires one change per key, so every one of these arrives
    // before the value the tutor meant. Null is "still typing", not an error.
    expect(parseWeight("")).toBeNull();
    expect(parseWeight("12,")).toBeNull();
    expect(parseWeight(",")).toBeNull();
  });

  it("refuses what is not a weight", () => {
    expect(parseWeight("0")).toBeNull();
    expect(parseWeight("-3")).toBeNull();
    expect(parseWeight("doce")).toBeNull();
    expect(parseWeight("12,4,5")).toBeNull();
    // Past the column's own ceiling of 200kg.
    expect(parseWeight("201")).toBeNull();
    expect(parseWeight("200")).toBe(200000);
  });
});

describe("formatWeight", () => {
  it("reads as a household scale reads, with this locale's comma", () => {
    expect(formatWeight(12400)).toBe("12,4 kg");
    expect(formatWeight(12000)).toBe("12,0 kg");
    expect(formatWeight(12340)).toBe("12,3 kg");
    expect(formatWeight(12350)).toBe("12,4 kg");
    expect(formatWeight(900)).toBe("0,9 kg");
  });

  it("round-trips through the field it fills", () => {
    expect(weightInput(12400)).toBe("12,4");
    expect(parseWeight(weightInput(12400))).toBe(12400);
  });
});

describe("weightChange", () => {
  it("compares against the measurement before it", () => {
    const rows = [
      weighed("2026-09-11", 12400),
      weighed("2026-09-04", 12100),
      weighed("2026-08-28", 11900),
    ];
    expect(weightChange(rows)).toEqual({ grams: 300, since: "2026-09-04" });
    expect(weightChange(rows, 1)).toEqual({ grams: 200, since: "2026-08-28" });
  });

  it("says nothing at the first weigh-in", () => {
    // Not zero: "igual" would claim he has not changed since a measurement
    // that does not exist.
    expect(weightChange([weighed("2026-09-11", 12400)])).toBeNull();
    expect(weightChange([])).toBeNull();
  });
});

describe("formatChange", () => {
  it("leads with the sign, because the sign is the message", () => {
    expect(formatChange(300)).toBe("+300 g");
    expect(formatChange(-150)).toBe("−150 g");
    expect(formatChange(0)).toBe("igual");
    expect(formatChange(1200)).toBe("+1,2 kg");
    expect(formatChange(-2500)).toBe("−2,5 kg");
  });
});

describe("validateWeight", () => {
  const on = new Date(2026, 8, 11);

  it("accepts a weight", () => {
    expect(validateWeight({ measuredOn: on, grams: 12400 })).toEqual({});
  });

  it("asks for one when there is none", () => {
    expect(validateWeight({ measuredOn: on, grams: 0 }).grams).toBeTruthy();
    expect(validateWeight({ measuredOn: on, grams: -1 }).grams).toBeTruthy();
    expect(validateWeight({ measuredOn: on, grams: 12.5 }).grams).toBeTruthy();
  });

  it("refuses what the column would refuse", () => {
    expect(
      validateWeight({ measuredOn: on, grams: 200001 }).grams,
    ).toBeTruthy();
  });
});

describe("measuredKey", () => {
  it("reads the local day, not the UTC one", () => {
    // Local midnight is the previous day in UTC anywhere east of Greenwich,
    // so anything that serialises through an instant is a day out all evening.
    expect(measuredKey(new Date(2026, 8, 11, 0, 30))).toBe("2026-09-11");
    expect(measuredKey(new Date(2026, 8, 11, 23, 30))).toBe("2026-09-11");
    expect(measuredKey(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});
