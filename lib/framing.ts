/**
 * The maths behind framing a photo inside a square stage.
 *
 * Pure and separate from the component that uses it, because it is the part
 * that can be wrong invisibly: an off-by-one in the crop rectangle does not
 * throw, it quietly cuts the dog's ear off, and the only way to catch that is
 * arithmetic that can be checked without a screen.
 *
 * The model: a square **stage** of `stage` dp shows part of an image whose
 * natural size is `natural`. `zoom` 1 means the image just covers the stage
 * (the smaller side fits exactly); higher means closer. `x` and `y` are the
 * image's top-left corner relative to the stage's, in dp, and are always
 * negative or zero — the stage must stay covered, so there is never a gap.
 */

export type Natural = { width: number; height: number };

export type Frame = {
  /** 1 = the image just covers the stage. */
  zoom: number;
  /** The image's top-left corner relative to the stage's, in dp. */
  x: number;
  y: number;
};

/** How far a zoom can go before the crop is more pixels than the photo has. */
export const MAX_ZOOM = 4;

/** The scale at which the image exactly covers a square stage. */
export function coverScale(natural: Natural, stage: number): number {
  return stage / Math.min(natural.width, natural.height);
}

function displayed(natural: Natural, stage: number, zoom: number) {
  const scale = coverScale(natural, stage) * zoom;
  return {
    scale,
    width: natural.width * scale,
    height: natural.height * scale,
  };
}

/** Keeps the stage covered: no gap at any edge, whatever the drag asked for. */
export function clampOffset(
  natural: Natural,
  stage: number,
  zoom: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const size = displayed(natural, stage, zoom);
  return {
    x: Math.min(0, Math.max(stage - size.width, x)),
    y: Math.min(0, Math.max(stage - size.height, y)),
  };
}

/** The image centred at the given zoom. */
export function centredFrame(natural: Natural, stage: number, zoom = 1): Frame {
  const size = displayed(natural, stage, zoom);
  return {
    zoom,
    x: (stage - size.width) / 2,
    y: (stage - size.height) / 2,
  };
}

/**
 * Changes the zoom without moving what the tutor is looking at.
 *
 * Zooming about the stage's centre rather than about a pinch's midpoint: it is
 * one rule for the buttons and the gesture alike, and it is the one a tutor can
 * predict — the thing in the middle of the circle stays in the middle.
 */
export function rezoom(
  natural: Natural,
  stage: number,
  frame: Frame,
  zoom: number,
): Frame {
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const before = displayed(natural, stage, frame.zoom);
  const after = displayed(natural, stage, next);

  // Where the centre of the stage falls in the image, in image pixels.
  const cx = (-frame.x + stage / 2) / before.scale;
  const cy = (-frame.y + stage / 2) / before.scale;

  const { x, y } = clampOffset(
    natural,
    stage,
    next,
    stage / 2 - cx * after.scale,
    stage / 2 - cy * after.scale,
  );
  return { zoom: next, x, y };
}

/**
 * The square to cut out of the source, in the source's own pixels.
 *
 * The side rounds to the nearest pixel and is then capped at the image's
 * shorter side, and each origin is capped so that origin + side lands on the
 * edge at worst. Both caps matter: a crop reaching one pixel past the image is
 * one the native manipulator rejects outright, and flooring instead would give
 * away a pixel every time the division lands on 499.99999999999994.
 */
export function cropRect(
  natural: Natural,
  stage: number,
  frame: Frame,
): { originX: number; originY: number; size: number } {
  const { scale } = displayed(natural, stage, frame.zoom);
  const size = Math.min(
    Math.round(stage / scale),
    natural.width,
    natural.height,
  );
  return {
    originX: Math.min(
      Math.max(0, Math.round(-frame.x / scale)),
      natural.width - size,
    ),
    originY: Math.min(
      Math.max(0, Math.round(-frame.y / scale)),
      natural.height - size,
    ),
    size,
  };
}
