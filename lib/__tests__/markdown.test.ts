import { parseBlocks } from "../markdown";

describe("parseBlocks", () => {
  it("reads a numbered list as one block of items, markers stripped", () => {
    expect(parseBlocks("1. Primero\n2. Luego\n3. Al final")).toEqual([
      { kind: "numbers", items: ["Primero", "Luego", "Al final"] },
    ]);
  });

  it("keeps the items of a list typed 1, 1, 1 — the numbers are drawn, not read", () => {
    const [block] = parseBlocks("1. a\n1. b\n1. c");
    expect(block).toEqual({ kind: "numbers", items: ["a", "b", "c"] });
  });

  it("keeps the items of a list that lost one in an edit (1, 3, 4)", () => {
    const [block] = parseBlocks("1. a\n3. b\n4. c");
    expect(block).toEqual({ kind: "numbers", items: ["a", "b", "c"] });
  });

  it("takes multi-digit markers", () => {
    const [block] = parseBlocks("9. nueve\n10. diez\n11. once");
    expect(block).toEqual({
      kind: "numbers",
      items: ["nueve", "diez", "once"],
    });
  });

  it("folds a continuation line into the item it follows", () => {
    const [block] = parseBlocks("1. Un comprimido\n   con la comida\n2. Agua");
    expect(block).toEqual({
      kind: "numbers",
      items: ["Un comprimido con la comida", "Agua"],
    });
  });

  it("folds a continuation line nobody indented, because nobody does", () => {
    const [block] = parseBlocks("1. Un comprimido\ncon la comida\n2. Agua");
    expect(block).toEqual({
      kind: "numbers",
      items: ["Un comprimido con la comida", "Agua"],
    });
  });

  it("still reads a bulleted list", () => {
    expect(parseBlocks("- Una cosa\n- Y otra")).toEqual([
      { kind: "bullets", items: ["Una cosa", "Y otra"] },
    ]);
  });

  it("does not mistake a number without its dot-and-space for a list", () => {
    expect(parseBlocks("2026 fue un año")).toEqual([
      { kind: "paragraph", text: "2026 fue un año" },
    ]);
    expect(parseBlocks("1.5 mg al día")).toEqual([
      { kind: "paragraph", text: "1.5 mg al día" },
    ]);
  });

  it("leaves a year where the tutor typed it", () => {
    // `\d+` made this a one-item list, and the renderer draws the marker from
    // position: the 2026 vanished and a `1.` took its place.
    expect(parseBlocks("2026. Un año raro")).toEqual([
      { kind: "paragraph", text: "2026. Un año raro" },
    ]);
    expect(parseBlocks("100. cosas que hacer")).toEqual([
      { kind: "paragraph", text: "100. cosas que hacer" },
    ]);
  });

  it("only opens a numbered list at the start of a block", () => {
    expect(parseBlocks("Pautas:\n1. Una")).toEqual([
      { kind: "paragraph", text: "Pautas:\n1. Una" },
    ]);
  });

  it("separates blocks on blank lines, each with its own shape", () => {
    expect(parseBlocks("## Pauta\n\n1. Uno\n2. Dos\n\n- a\n\nFin.")).toEqual([
      { kind: "heading", text: "Pauta" },
      { kind: "numbers", items: ["Uno", "Dos"] },
      { kind: "bullets", items: ["a"] },
      { kind: "paragraph", text: "Fin." },
    ]);
  });
});
