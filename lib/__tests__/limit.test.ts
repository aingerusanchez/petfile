import { atLimit, clampToLimit, NOTE_LIMIT, showsCounter } from "../limit";

describe("clampToLimit", () => {
  it("takes whatever fits", () => {
    expect(clampToLimit("abc", "abcd", 10)).toBe("abcd");
  });

  it("takes a character typed exactly onto the limit, and not the next", () => {
    expect(clampToLimit("abcd", "abcde", 5)).toBe("abcde");
    expect(clampToLimit("abcde", "abcdef", 5)).toBe("abcde");
  });

  it("cuts a paste at the limit", () => {
    expect(clampToLimit("abc", "abcXXXXXXX", 5)).toBe("abcXX");
  });

  it("cuts a paste where it landed, not at the end of the note", () => {
    // "ab|cd" with "XXXX" pasted at the bar, limit 6: two of them fit, and
    // "cd" — what was already there — survives.
    expect(clampToLimit("abcd", "abXXXXcd", 6)).toBe("abXXcd");
  });

  it("never splits an emoji in two", () => {
    // 💩 is two UTF-16 units; one unit of room would keep half of it.
    expect(clampToLimit("abc", "abc💩", 4)).toBe("abc");
    expect(clampToLimit("abc", "abc💩", 5)).toBe("abc💩");
  });

  describe("a note already past the limit", () => {
    const old = "x".repeat(NOTE_LIMIT + 100);

    it("can be shortened", () => {
      expect(clampToLimit(old, old.slice(0, -1), NOTE_LIMIT)).toBe(
        old.slice(0, -1),
      );
    });

    it("can have a word swapped for one as long", () => {
      const swapped = "y" + old.slice(1);
      expect(clampToLimit(old, swapped, NOTE_LIMIT)).toBe(swapped);
    });

    it("cannot grow", () => {
      expect(clampToLimit(old, old + "z", NOTE_LIMIT)).toBe(old);
      expect(clampToLimit(old, "z" + old, NOTE_LIMIT)).toBe(old);
    });

    it("is returned whole when nothing about it changed", () => {
      expect(clampToLimit(old, old, NOTE_LIMIT)).toBe(old);
    });
  });
});

describe("the counter", () => {
  it("stays out of the way of an ordinary note", () => {
    expect(showsCounter(0, 500)).toBe(false);
    expect(showsCounter(72, 500)).toBe(false);
    expect(showsCounter(399, 500)).toBe(false);
  });

  it("appears at 80% of the limit, and stays", () => {
    expect(showsCounter(400, 500)).toBe(true);
    expect(showsCounter(500, 500)).toBe(true);
    expect(showsCounter(612, 500)).toBe(true);
  });

  it("calls a field full at the limit, and an over-length note too", () => {
    expect(atLimit(499, 500)).toBe(false);
    expect(atLimit(500, 500)).toBe(true);
    expect(atLimit(612, 500)).toBe(true);
  });
});
