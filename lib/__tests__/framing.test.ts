import {
  centredFrame,
  clampOffset,
  cropRect,
  coverScale,
  MAX_ZOOM,
  rezoom,
  type Natural,
} from "../framing";

const STAGE = 280;
const landscape: Natural = { width: 4000, height: 3000 };
const portrait: Natural = { width: 1080, height: 1920 };
const square: Natural = { width: 1000, height: 1000 };

describe("coverScale", () => {
  it("fits the shorter side to the stage", () => {
    expect(coverScale(landscape, STAGE)).toBeCloseTo(280 / 3000);
    expect(coverScale(portrait, STAGE)).toBeCloseTo(280 / 1080);
  });
});

describe("centredFrame", () => {
  it("centres the overflow on the long axis and leaves the short one flush", () => {
    const frame = centredFrame(landscape, STAGE);
    expect(frame.y).toBeCloseTo(0);
    expect(frame.x).toBeLessThan(0);

    const tall = centredFrame(portrait, STAGE);
    expect(tall.x).toBeCloseTo(0);
    expect(tall.y).toBeLessThan(0);
  });

  it("leaves a square image exactly flush", () => {
    expect(centredFrame(square, STAGE)).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});

describe("clampOffset", () => {
  it("never lets a gap open at an edge", () => {
    // Dragged far past the top-left and far past the bottom-right.
    expect(clampOffset(square, STAGE, 1, 500, 500)).toEqual({ x: 0, y: 0 });
    const pushed = clampOffset(square, STAGE, 2, -9999, -9999);
    expect(pushed.x).toBeCloseTo(-STAGE);
    expect(pushed.y).toBeCloseTo(-STAGE);
  });

  it("leaves a legitimate offset alone", () => {
    expect(clampOffset(square, STAGE, 2, -100, -50)).toEqual({
      x: -100,
      y: -50,
    });
  });
});

describe("rezoom", () => {
  it("keeps the middle of the stage in the middle", () => {
    const start = centredFrame(landscape, STAGE);
    const closer = rezoom(landscape, STAGE, start, 2);

    // The crop at both zooms is centred on the same point of the image.
    const a = cropRect(landscape, STAGE, start);
    const b = cropRect(landscape, STAGE, closer);
    expect(b.originX + b.size / 2).toBeCloseTo(a.originX + a.size / 2, 0);
    expect(b.originY + b.size / 2).toBeCloseTo(a.originY + a.size / 2, 0);
  });

  it("refuses to zoom out past cover, or in past the ceiling", () => {
    const start = centredFrame(square, STAGE);
    expect(rezoom(square, STAGE, start, 0.2).zoom).toBe(1);
    expect(rezoom(square, STAGE, start, 99).zoom).toBe(MAX_ZOOM);
  });

  it("pulls a panned frame back inside when zooming out", () => {
    const panned = { zoom: 3, x: -600, y: -600 };
    const out = rezoom(square, STAGE, panned, 1);
    expect(out).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});

describe("cropRect", () => {
  const cases: [string, Natural][] = [
    ["landscape", landscape],
    ["portrait", portrait],
    ["square", square],
  ];

  it.each(cases)("stays inside a %s image at every zoom", (_label, natural) => {
    for (const zoom of [1, 1.25, 2, 3, MAX_ZOOM]) {
      const frame = centredFrame(natural, STAGE, zoom);
      const rect = cropRect(natural, STAGE, frame);

      expect(rect.size).toBeGreaterThan(0);
      expect(rect.originX).toBeGreaterThanOrEqual(0);
      expect(rect.originY).toBeGreaterThanOrEqual(0);
      // The one failure that matters: asking the manipulator for a pixel the
      // image does not have, which it rejects outright.
      expect(rect.originX + rect.size).toBeLessThanOrEqual(natural.width);
      expect(rect.originY + rect.size).toBeLessThanOrEqual(natural.height);
    }
  });

  it("takes the whole short side at cover zoom", () => {
    expect(
      cropRect(landscape, STAGE, centredFrame(landscape, STAGE)).size,
    ).toBe(3000);
    expect(cropRect(portrait, STAGE, centredFrame(portrait, STAGE)).size).toBe(
      1080,
    );
  });

  it("halves the crop when the zoom doubles", () => {
    const frame = centredFrame(square, STAGE, 2);
    expect(cropRect(square, STAGE, frame).size).toBe(500);
  });

  it("survives a frame clamped hard against the far corner", () => {
    const frame = { zoom: 2, ...clampOffset(square, STAGE, 2, -9999, -9999) };
    const rect = cropRect(square, STAGE, frame);
    expect(rect.originX + rect.size).toBeLessThanOrEqual(square.width);
    expect(rect.originY + rect.size).toBeLessThanOrEqual(square.height);
  });
});
