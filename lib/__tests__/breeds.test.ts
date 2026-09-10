import {
  foldForSearch,
  isKnownBreed,
  meansMixedBreed,
  searchBreeds,
} from "../breeds";

describe("foldForSearch", () => {
  it("strips accents and case so phone-keyboard input matches", () => {
    expect(foldForSearch("Pastor Alemán")).toBe("pastor aleman");
    expect(foldForSearch("Bóxer")).toBe("boxer");
    expect(foldForSearch("  Beagle  ")).toBe("beagle");
  });
});

describe("searchBreeds", () => {
  it("returns nothing for an empty query", () => {
    expect(searchBreeds("")).toEqual([]);
    expect(searchBreeds("   ")).toEqual([]);
  });

  it("matches without accents", () => {
    expect(searchBreeds("aleman")).toContain("Pastor Alemán");
  });

  it("puts prefix matches before substring matches", () => {
    const results = searchBreeds("bo");
    const bobtail = results.indexOf("Bobtail");
    const bullmastiff = results.indexOf("Bullmastiff");
    expect(bobtail).toBeGreaterThanOrEqual(0);
    if (bullmastiff >= 0) expect(bobtail).toBeLessThan(bullmastiff);
  });

  it("does not suggest the value the user has already typed exactly", () => {
    expect(searchBreeds("Beagle")).not.toContain("Beagle");
  });

  it("respects the limit", () => {
    expect(searchBreeds("a", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("isKnownBreed", () => {
  it("accepts a known breed however it is cased or accented", () => {
    expect(isKnownBreed("husky siberiano")).toBe(true);
    expect(isKnownBreed("Pastor Aleman")).toBe(true);
  });

  it("rejects free text that is not on the list", () => {
    expect(isKnownBreed("Perro de mi barrio")).toBe(false);
    expect(isKnownBreed("")).toBe(false);
  });
});

describe("meansMixedBreed", () => {
  it('recognises the ways a tutor says "mixed" in the breed field', () => {
    expect(meansMixedBreed("Mestizo")).toBe(true);
    expect(meansMixedBreed("mestiza")).toBe(true);
    expect(meansMixedBreed("  CRUCE ")).toBe(true);
    expect(meansMixedBreed("sin raza")).toBe(true);
    // Folded like every other breed comparison, so an accent cannot slip past.
    expect(meansMixedBreed("desconocída")).toBe(true);
  });

  it("leaves real breeds alone", () => {
    expect(meansMixedBreed("Husky Siberiano")).toBe(false);
    expect(meansMixedBreed("Pastor Alemán")).toBe(false);
    // A breed the list does not know is still a breed, not a mixed answer.
    expect(meansMixedBreed("Perro de mi barrio")).toBe(false);
    expect(meansMixedBreed(null)).toBe(false);
    expect(meansMixedBreed("")).toBe(false);
  });

  it("is absent from the suggestion list, so the app never offers it as one", () => {
    expect(searchBreeds("mestizo")).toEqual([]);
    expect(isKnownBreed("Mestizo")).toBe(false);
  });
});
