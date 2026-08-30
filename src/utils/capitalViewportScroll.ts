/** Presentation only: never feeds capital, ownership, cooldowns or AI. */
export const CAPITAL_SCROLL_TOP_FRACTION = 0.15;
export const CAPITAL_SCROLL_STEP_FRACTION = 0.24;

export function resolveCapitalViewportScroll({
  height, coinHeight, layerStep, rowBases, before, after, progress,
}: {
  height: number;
  coinHeight: number;
  layerStep: number;
  rowBases: readonly number[];
  before: readonly number[];
  after: readonly number[];
  progress: number;
}) {
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const stepPx = Math.max(1, Math.round(safeHeight * CAPITAL_SCROLL_STEP_FRACTION));
  const ceilingY = safeHeight * CAPITAL_SCROLL_TOP_FRACTION;
  const offsetFor = (layers: readonly number[]) => {
    let top = Number.POSITIVE_INFINITY;
    layers.forEach((value, index) => {
      const count = Math.max(0, Number.isFinite(value) ? value : 0);
      if (count <= 0) return;
      // Every positive logical unit includes seven additional visible seams.
      top = Math.min(top, (rowBases[index] ?? safeHeight) -
        (count + 6) * layerStep - coinHeight);
    });
    const overflow = Math.max(0, ceilingY - top);
    return Math.ceil(overflow / stepPx) * stepPx;
  };
  const beforeOffsetPx = offsetFor(before);
  const targetOffsetPx = offsetFor(after);
  const t = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  const eased = t * t * (3 - 2 * t);
  return {
    ceilingY, stepPx, beforeOffsetPx, targetOffsetPx,
    offsetPx: beforeOffsetPx + (targetOffsetPx - beforeOffsetPx) * eased,
    descending: targetOffsetPx > beforeOffsetPx && t < 1,
  };
}
