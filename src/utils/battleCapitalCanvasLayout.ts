export const BATTLE_CAPITAL_CANVAS_ROW_COUNTS = [4, 5, 6, 7] as const;
export const BATTLE_CAPITAL_RACK_TWEEN_MS = 180;
export const BATTLE_CAPITAL_RACK_SETTLE_MS = 40;
export const BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS =
  BATTLE_CAPITAL_RACK_TWEEN_MS + BATTLE_CAPITAL_RACK_SETTLE_MS;
export const BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER = 8;
export const BATTLE_CAPITAL_CONTINUOUS_DEPTH_DEADBAND = 0.15;

/**
 * Keeps the already-approved three-grade pile unchanged, then exposes every
 * later funding wave as additional physical depth. The small deadband absorbs
 * the fractional tail of the first full 300M-class fill, so that first scene
 * does not shift merely because the structural model became continuous.
 */
export const resolveBattleCapitalEffectiveDepth = (depth: number) => {
  const normalized = Math.max(0, Number.isFinite(depth) ? depth : 0);
  if (normalized <= 3) return normalized;
  return 3 + Math.max(
    0,
    normalized - 3 - BATTLE_CAPITAL_CONTINUOUS_DEPTH_DEADBAND
  );
};

export interface BattleCapitalHoardVerticalGeometry {
  tier: number;
  pileGlowCenterY: number;
  pileGlowRadiusY: number;
  moundCenterY: number;
  moundRadiusY: number;
  spillCenterYs: number[];
}

/**
 * Keeps every pre-pedestal decoration on the tray side of its baseline.
 * The silver rack is painted afterwards and therefore masks the lower edge;
 * no loose coin or glow may leak below it as a false second pile.
 */
export const resolveBattleCapitalHoardVerticalGeometry = ({
  baseY,
  fieldHeight,
  coinHeight,
  stackDepth,
  auraStrength,
}: {
  baseY: number;
  fieldHeight: number;
  coinHeight: number;
  stackDepth: number;
  auraStrength: number;
}): BattleCapitalHoardVerticalGeometry => {
  const tier = Math.floor(clamp(stackDepth + 1e-6, 0, 3));
  const safeCoinHeight = Math.max(0, coinHeight);
  const pileGlowRadiusY = Math.max(0, fieldHeight) *
    (0.06 + clamp(auraStrength, 0, 1) * 0.026);
  const moundRadiusY = tier > 0
    ? safeCoinHeight * (1.2 + tier * 0.35)
    : 0;
  const spillCenterYs = Array.from({ length: tier * 7 }, (_, index) => {
    const row = index % (tier + 2);
    // drawCoin extends 0.78 coin-heights below its supplied centre.
    return baseY - safeCoinHeight * (0.78 + row * 0.55);
  });
  return {
    tier,
    pileGlowCenterY: baseY - pileGlowRadiusY,
    pileGlowRadiusY,
    moundCenterY: baseY - moundRadiusY,
    moundRadiusY,
    spillCenterYs,
  };
};

// Keep every depth row on nearly the same coin pitch. The original trade
// screen reads as one dense treasury block, not four unrelated fan shapes.
const ROW_SPANS = [0.4, 0.53, 0.66, 0.8] as const;
const ROW_BASE_HEIGHT_SCALES = [1, 0.98, 0.96, 0.94] as const;
const ROW_BOTTOMS = [
  [24, 26, 26, 24],
  [16, 18, 19, 18, 16],
  [8, 10, 11, 11, 10, 8],
  [0, 1, 2, 2, 2, 1, 0],
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const progress = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export interface BattleCapitalCanvasColumnLayout {
  bottom: number;
  coinHeight: number;
  coinWidth: number;
  column: number;
  depth: number;
  layerStep: number;
  pitch: number;
  xRatio: number;
}

export interface BattleCapitalCanvasLayout {
  areaWidth: number;
  columns: BattleCapitalCanvasColumnLayout[];
  landscape: boolean;
  sideInset: number;
}

export interface BattleCapitalStackGeometry {
  baseY: number;
  floorY: number;
  safeTopY: number;
  scrollPx: number;
  visibleWindow: number;
}

/**
 * Resolves one dense four-row treasury tray. Column width follows row pitch,
 * so a wide phone gains larger coins instead of larger empty gaps.
 */
export const resolveBattleCapitalCanvasLayout = (
  width: number,
  height: number
): BattleCapitalCanvasLayout => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  // Two 44%-wide trays leave a deliberate 6% centre aisle for the VS/frontline.
  // This is especially important on tall phones where the former 47.6% trays
  // visually merged into one oversized pile.
  const areaWidth = safeWidth * 0.44;
  const sideInset = safeWidth * 0.03;
  const landscape = safeWidth / safeHeight >= 1.45;
  const columns: BattleCapitalCanvasColumnLayout[] = [];

  BATTLE_CAPITAL_CANVAS_ROW_COUNTS.forEach((count, depth) => {
    const span = ROW_SPANS[depth] * (landscape ? 0.84 : 1);
    const pitch = areaWidth * span / Math.max(1, count - 1);
    const coinWidth = clamp(
      Math.max(pitch * (landscape ? 0.98 : 1.03), safeWidth * 0.055),
      12,
      72
    );
    const coinHeight = clamp(coinWidth * 0.2, 4.5, 12);
    const layerStep = landscape
      ? clamp(safeHeight * 0.011, 1.8, 2.6)
      : clamp(safeHeight * 0.013, 4.4, 6.2);

    for (let column = 0; column < count; column += 1) {
      const centered = column - (count - 1) / 2;
      columns.push({
        bottom: ROW_BOTTOMS[depth][column],
        coinHeight,
        coinWidth,
        column,
        depth,
        layerStep,
        pitch,
        xRatio: 0.5 + centered * (pitch / areaWidth),
      });
    }
  });

  return { areaWidth, columns, landscape, sideInset };
};

export const resolveBattleCapitalVisualLayers = ({
  layers,
  depth,
  maxRawLayers,
  variation,
}: {
  layers: number;
  depth: number;
  maxRawLayers: number;
  variation: number;
}) => {
  if (layers <= 0) return 0;
  const wallProgress = smoothstep(22, 36, maxRawLayers);
  const rowBase = ROW_BASE_HEIGHT_SCALES[depth] ?? 1;
  const rowScale = rowBase + (1 - rowBase) * wallProgress;
  const normalizedVariation = clamp(variation, 0.85, 1.15);
  const settledVariation =
    normalizedVariation + (1 - normalizedVariation) * wallProgress;
  return Math.max(1, Math.round(layers * rowScale * settledVariation));
};

/**
 * Keeps the treasury on its visible floor until the tallest completed column
 * reaches the upper safe line. The first true overflow preserves the reviewed
 * screen-relative stop; later continuous depth moves the old treasury by the
 * exact height of each additional eight-layer bank. The DOM command lane is
 * excluded from the Canvas height, so the first drop keeps its visible plate,
 * while genuinely larger repeated funding may continue behind that lower band.
 * Content safety is measured after the authored drop to avoid counting the same
 * pile height twice.
 */
export const resolveBattleCapitalStackGeometry = (
  height: number,
  landscape: boolean,
  tallestColumnExtent: number,
  rackDepth = 0
): BattleCapitalStackGeometry => {
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const floorY = safeHeight * (landscape ? 0.76 : 0.78);
  // The Canvas is behind the semantic DOM gauge/readout, so a landscape wall
  // may extend behind that compact overlay. Keeping only a small clip margin
  // lets a full 36-layer wall fit without pre-burying its pedestal.
  const safeTopY = safeHeight * (landscape ? 0.06 : 0.22);
  const visibleWindow = floorY - safeTopY;
  const effectiveRackDepth = resolveBattleCapitalEffectiveDepth(rackDepth);
  // The first overflow keeps the approved, clearly readable 14% drop. The next
  // two legacy grades remain compact; continuous depth beyond them is handled
  // below in actual eight-layer increments.
  const rackStops = landscape
    ? [0, safeHeight * 0.14, safeHeight * 0.16, safeHeight * 0.175]
    : [0, safeHeight * 0.14, safeHeight * 0.16, safeHeight * 0.175];
  const boundedLegacyDepth = Math.min(3, effectiveRackDepth);
  const lowerStop = Math.floor(boundedLegacyDepth);
  const upperStop = Math.ceil(boundedLegacyDepth);
  const stopProgress = boundedLegacyDepth - lowerStop;
  const legacyRackScroll =
    rackStops[lowerStop] +
    (rackStops[upperStop] - rackStops[lowerStop]) * stopProgress;
  const overflowLayerStep = landscape
    ? clamp(safeHeight * 0.011, 1.8, 2.6)
    : clamp(safeHeight * 0.013, 4.4, 6.2);
  const continuousRackScroll =
    Math.max(0, effectiveRackDepth - 3) *
    BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER *
    overflowLayerStep;
  const legacyColumnExtent = Math.max(
    0,
    (Number.isFinite(tallestColumnExtent) ? tallestColumnExtent : 0) -
      continuousRackScroll
  );
  const legacyContentSafetyScroll = Math.max(
    0,
    legacyColumnExtent - (visibleWindow + legacyRackScroll)
  );
  const rackHeight = clamp(safeHeight * 0.04, 7, 14);
  const maximumVisibleLegacyScroll = Math.max(
    0,
    safeHeight - floorY - rackHeight * 1.16 - 1
  );
  // Keep the already-approved first 300M-class treasury and its silver rim at
  // the old visible cap. Only mass beyond that three-grade scene is allowed to
  // carry the same physical tray farther behind the lower information band.
  const legacyScroll = Math.min(
    legacyContentSafetyScroll + legacyRackScroll,
    maximumVisibleLegacyScroll
  );
  const scrollPx = legacyScroll + continuousRackScroll;
  return {
    baseY: floorY + scrollPx,
    floorY,
    safeTopY,
    scrollPx,
    visibleWindow,
  };
};

export const easeBattleCapitalRackDepth = (
  fromDepth: number,
  toDepth: number,
  elapsedMs: number
) => {
  if (toDepth <= fromDepth) return toDepth;
  const progress = clamp(elapsedMs / BATTLE_CAPITAL_RACK_TWEEN_MS, 0, 1);
  // The reference tray starts deliberately, then gathers speed as the
  // completed mountain slips behind the lower account band.
  const eased = progress * progress;
  return fromDepth + (toDepth - fromDepth) * eased;
};
