export const BATTLE_CAPITAL_CANVAS_ROW_COUNTS = [4, 5, 6, 7] as const;
export const BATTLE_CAPITAL_RACK_TWEEN_MS = 280;

const ROW_SPANS = [0.52, 0.7, 0.84, 0.9] as const;
const ROW_BASE_HEIGHT_SCALES = [1, 0.84, 0.68, 0.54] as const;
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
  const areaWidth = safeWidth * 0.476;
  const landscape = safeWidth / safeHeight >= 1.45;
  const columns: BattleCapitalCanvasColumnLayout[] = [];

  BATTLE_CAPITAL_CANVAS_ROW_COUNTS.forEach((count, depth) => {
    const span = ROW_SPANS[depth] * (landscape ? 0.84 : 1);
    const pitch = areaWidth * span / Math.max(1, count - 1);
    const coinWidth = clamp(pitch * (landscape ? 0.92 : 0.86), 12, 72);
    const coinHeight = clamp(coinWidth * 0.2, 4.5, 12);
    const layerStep = landscape
      ? clamp(safeHeight * 0.016, 2.1, 3.2)
      : clamp(safeHeight * 0.008, 2.7, 3.55);

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

  return { areaWidth, columns, landscape };
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

const getRackOffsets = (height: number, landscape: boolean) => {
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  if (landscape) {
    const compression = clamp(safeHeight * 0.12, 28.8, 40);
    return [0, compression, compression + 12.64, compression + 15.52, compression + 18.4];
  }
  const compression = clamp(safeHeight * 0.1, 36, 44.8);
  return [0, compression, compression + 15.04, compression + 19.2, compression + 23.36];
};

/** depth 0 is the normal rack; 1..4 are compressed overflow tiers 0..3. */
export const resolveBattleCapitalRackOffset = (
  height: number,
  landscape: boolean,
  depth: number
) => {
  const offsets = getRackOffsets(height, landscape);
  const safeDepth = clamp(depth, 0, offsets.length - 1);
  const lower = Math.floor(safeDepth);
  const upper = Math.ceil(safeDepth);
  const progress = safeDepth - lower;
  return offsets[lower] + (offsets[upper] - offsets[lower]) * progress;
};

export const easeBattleCapitalRackDepth = (
  fromDepth: number,
  toDepth: number,
  elapsedMs: number
) => {
  if (toDepth <= fromDepth) return toDepth;
  const progress = clamp(elapsedMs / BATTLE_CAPITAL_RACK_TWEEN_MS, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  return fromDepth + (toDepth - fromDepth) * eased;
};
