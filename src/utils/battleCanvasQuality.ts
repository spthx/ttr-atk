export const BATTLE_CANVAS_MAX_DPR = {
  30: 1.5,
  60: 2,
} as const;

/**
 * Keeps high-density phone screens from multiplying every Canvas2D paint.
 * This changes only backing resolution; CSS size and battle state stay intact.
 */
export const resolveBattleCanvasDpr = ({
  requestedDpr,
  frameRate,
}: {
  requestedDpr: number;
  frameRate: 30 | 60;
}) => {
  const normalizedDpr = Number.isFinite(requestedDpr)
    ? Math.max(0.25, requestedDpr)
    : 1;
  return Math.min(normalizedDpr, BATTLE_CANVAS_MAX_DPR[frameRate]);
};
