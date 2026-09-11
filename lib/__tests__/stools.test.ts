import {
  describeStools,
  MAX_STOOLS,
  NO_STOOLS,
  readStools,
  STOOL_IDEAL,
  STOOL_SCALE,
  writeStools,
} from "../stools";

describe("the scale", () => {
  it("anchors health in the middle, not at an end", () => {
    // The whole point of the re-anchoring: a dry, hard stool is a signal too,
    // and on a "perfect → diarrhoea" scale it would score as perfect.
    expect(STOOL_IDEAL).toBe(2);
    expect(STOOL_SCALE[0].label).toBe("Dura");
    expect(STOOL_SCALE.at(-1)?.label).toBe("Diarrea");
    expect(STOOL_SCALE).toHaveLength(5);
  });

  it("is declared worst-last, and the row reverses it for the thumb", () => {
    // The data keeps the natural order; only the palette runs 5 to 1, so
    // anything that reads the scale as data is not reading it backwards.
    expect(STOOL_SCALE.map((step) => step.value)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("readStools", () => {
  it("reads what a walk stored", () => {
    expect(readStools({ stools: [2, 4] })).toEqual([2, 4]);
  });

  it("has nothing to read on a walk that recorded nothing", () => {
    expect(readStools(null)).toEqual(NO_STOOLS);
    expect(readStools({})).toEqual(NO_STOOLS);
    expect(readStools({ what: "Pienso" })).toEqual(NO_STOOLS);
  });

  it("drops anything that is not a value on the scale", () => {
    // `details` is written by this app and by nothing else, but it is still
    // the one place a row can carry a shape the code did not expect.
    expect(readStools({ stools: [2, "mucho", 0, 6, 3.5, null, 5] })).toEqual([
      2, 5,
    ]);
  });

  it("refuses a blob that is not even a list", () => {
    expect(readStools({ stools: "dos" })).toEqual(NO_STOOLS);
  });

  it("ignores the flags an older build may have written", () => {
    // Mucus and blood were two checkboxes for one build. They were friction on
    // the path everybody takes for the sake of the one they almost never do,
    // and they belong to an incident or to the health tab.
    expect(readStools({ stools: [3], mucus: true, blood: true })).toEqual([3]);
  });

  it("caps what one walk can hold", () => {
    const many = Array.from({ length: MAX_STOOLS + 3 }, () => 2);
    expect(readStools({ stools: many })).toHaveLength(MAX_STOOLS);
  });
});

describe("writeStools", () => {
  it("writes nothing at all when there is nothing to say", () => {
    // Absent, not empty: "we did not look" and "there was nothing" are the
    // same fact, because nobody is asked.
    expect(writeStools(NO_STOOLS)).toEqual({});
  });

  it("survives the round trip", () => {
    expect(readStools(writeStools([1, 3, 5]))).toEqual([1, 3, 5]);
  });

  it("keeps the order they were tapped in, duplicates and all", () => {
    expect(writeStools([2, 2, 5])).toEqual({ stools: [2, 2, 5] });
  });
});

describe("describeStools", () => {
  it("says it the way somebody would", () => {
    expect(describeStools([2])).toBe("una kaka: perfecta");
    expect(describeStools([2, 3])).toBe("2 kakas: perfecta, blanda");
  });

  it("has nothing to say about a walk with none", () => {
    expect(describeStools(NO_STOOLS)).toBeNull();
  });
});
