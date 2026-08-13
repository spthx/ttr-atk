import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from 'react';
import {
  BATTLE_CAPITAL_COLUMN_COUNT,
  MAX_BATTLE_CAPITAL_COLUMN_LAYERS,
  getBattleCapitalOverflowTier,
  getBattleCapitalVisibleUnits,
  getCapitalColumnHeights,
  type MechanicalCapitalColumnFrame,
} from '../utils/battlePresentation';
import { resolveBattleCanvasDpr } from '../utils/battleCanvasQuality';
import {
  BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER,
  easeBattleCapitalRackDepth,
  resolveBattleCapitalCanvasLayout,
  resolveBattleCapitalStackGeometry,
  resolveBattleCapitalVisualLayers,
} from '../utils/battleCapitalCanvasLayout';
import casinoWideUrl from '../assets/battle/battlefield-casino-wide.webp';
import casinoMobileUrl from '../assets/battle/battlefield-casino-mobile.webp';
import './BattleCapitalCanvas.css';

export type BattleCapitalCanvasSide = 'player' | 'enemy';
export type BattleCapitalCanvasDirection =
  | BattleCapitalCanvasSide
  | 'even';
export type BattleCapitalCanvasDifficulty =
  | 'normal'
  | 'savage'
  | 'ultimate'
  | 'cruel';

/**
 * Structural subset of BattleModal's presentation frame. Existing preview
 * frames can be passed directly without exporting BattleModal's private type.
 */
export interface BattleCapitalCanvasPreviewFrame
  extends MechanicalCapitalColumnFrame {
  overflowTier?: number;
  presentationSerial?: number;
  presentedCapital?: number;
  packetSeed?: number;
  beatDurationMs?: number;
}

export interface BattleCapitalCanvasSideState {
  amount: number;
  marketPrice: number;
  /** Defaults to amount / marketPrice and affects decoration, never geometry. */
  capitalRatio?: number;
  previewFrame?: BattleCapitalCanvasPreviewFrame | null;
  rackFloorTier?: number;
  impact?: boolean;
}

export interface BattleCapitalCanvasProps {
  player: BattleCapitalCanvasSideState;
  enemy: BattleCapitalCanvasSideState;
  /** Current player ownership on the existing 0..100 battle scale. */
  ownershipPercent: number;
  pressureDirection?: BattleCapitalCanvasDirection;
  windSide?: BattleCapitalCanvasDirection;
  difficulty?: BattleCapitalCanvasDifficulty;
  compact?: boolean;
  frameRate?: 30 | 60;
  className?: string;
  style?: CSSProperties;
  /** Defaults to the device DPR. Useful for deterministic screenshot tests. */
  devicePixelRatio?: number;
}

interface NormalizedCapitalFrame {
  visibleUnits: number;
  columnHeights: number[];
  activeColumnIndices: number[];
  incomingBundleCopies: number;
  overflowTier: number;
  presentationSerial: number;
  packetSeed: number;
  packetProgress: number;
  beatDurationMs: number;
  rackDepth: number;
  stackDepth: number;
}

interface NormalizedCapitalSide {
  side: BattleCapitalCanvasSide;
  frame: NormalizedCapitalFrame;
  capitalRatio: number;
  impact: boolean;
}

export interface BattleCapitalCanvasScene {
  player: NormalizedCapitalSide;
  enemy: NormalizedCapitalSide;
  ownershipPercent: number;
  pressureDirection: BattleCapitalCanvasDirection;
  windSide: BattleCapitalCanvasDirection;
  difficulty: BattleCapitalCanvasDifficulty;
  compact: boolean;
}

export interface BattleCapitalCanvasMetrics {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  backingPixels: number;
}

interface CapitalPacketClock {
  key: string;
  startedAt: number;
}

interface CapitalRackClock {
  fromDepth: number;
  startedAt: number;
  targetDepth: number;
}

type BattleBackdropKind = 'wide' | 'mobile';

const BATTLE_BACKDROP_SOURCES: Record<BattleBackdropKind, string> = {
  wide: casinoWideUrl,
  mobile: casinoMobileUrl,
};
const battleBackdropCache = new Map<BattleBackdropKind, HTMLImageElement>();
const battleBackdropLoads = new Map<
  BattleBackdropKind,
  Promise<HTMLImageElement>
>();

const loadBattleBackdrop = (kind: BattleBackdropKind) => {
  const cached = battleBackdropCache.get(kind);
  if (cached) return Promise.resolve(cached);
  const pending = battleBackdropLoads.get(kind);
  if (pending) return pending;
  const load = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      battleBackdropCache.set(kind, image);
      battleBackdropLoads.delete(kind);
      resolve(image);
    };
    image.onerror = () => {
      battleBackdropLoads.delete(kind);
      reject(new Error(`Unable to decode ${kind} battle backdrop`));
    };
    image.src = BATTLE_BACKDROP_SOURCES[kind];
  });
  battleBackdropLoads.set(kind, load);
  return load;
};

const SIDE_COLORS = {
  player: {
    edge: '#65d9ff',
    glow: 'rgba(75, 206, 255, .2)',
    coinLight: '#fff0a9',
    coinMid: '#d69a2e',
    coinDark: '#76501c',
  },
  enemy: {
    edge: '#ff708d',
    glow: 'rgba(255, 61, 101, .28)',
    coinLight: '#ffc2b8',
    coinMid: '#dc3d49',
    coinDark: '#68131f',
  },
} as const;

const DIFFICULTY_COLORS: Record<
  BattleCapitalCanvasDifficulty,
  { top: string; bottom: string; accent: string }
> = {
  normal: { top: '#071622', bottom: '#02070c', accent: '#2b7894' },
  savage: { top: '#151024', bottom: '#06040c', accent: '#8560c8' },
  ultimate: { top: '#160d24', bottom: '#05030b', accent: '#c26bda' },
  cruel: { top: '#210b13', bottom: '#070205', accent: '#bd3957' },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const finiteNonNegative = (value: number, fallback = 0) =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

const normalizeSide = (
  side: BattleCapitalCanvasSide,
  state: BattleCapitalCanvasSideState
): NormalizedCapitalSide => {
  const amount = finiteNonNegative(state.amount);
  const marketPrice = Math.max(1, finiteNonNegative(state.marketPrice, 1));
  const fallbackVisibleUnits = getBattleCapitalVisibleUnits(
    amount,
    marketPrice
  );
  const preview = state.previewFrame;
  const visibleUnits = Math.max(
    0,
    Math.round(preview?.visibleUnits ?? fallbackVisibleUnits)
  );
  const sourceHeights =
    preview?.columnHeights ?? getCapitalColumnHeights(visibleUnits);
  const columnHeights = Array.from(
    { length: BATTLE_CAPITAL_COLUMN_COUNT },
    (_, index) =>
      Math.round(
        clamp(
          sourceHeights[index] ?? 0,
          0,
          MAX_BATTLE_CAPITAL_COLUMN_LAYERS
        )
      )
  );
  const activeColumnIndices = Array.from(
    new Set(
      (preview?.activeColumnIndices ?? []).filter(
        (index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < BATTLE_CAPITAL_COLUMN_COUNT
      )
    )
  );
  const overflowTier = Math.round(
    clamp(
      Math.max(
        preview?.overflowTier ??
          getBattleCapitalOverflowTier(amount, marketPrice),
        state.rackFloorTier ?? 0
      ),
      0,
      3
    )
  );

  return {
    side,
    capitalRatio: finiteNonNegative(
      state.capitalRatio ?? amount / marketPrice
    ),
    impact: state.impact === true,
    frame: {
      visibleUnits,
      columnHeights,
      activeColumnIndices,
      incomingBundleCopies: Math.round(
        clamp(preview?.incomingBundleCopies ?? 1, 1, 3)
      ),
      overflowTier,
      presentationSerial: Math.round(
        finiteNonNegative(preview?.presentationSerial ?? 0)
      ),
      packetSeed: Math.round(finiteNonNegative(preview?.packetSeed ?? 0)),
      packetProgress: activeColumnIndices.length > 0 ? 0 : 1,
      beatDurationMs: Math.max(1, preview?.beatDurationMs ?? 90),
      rackDepth: clamp(
        preview?.rackDepth ?? Math.max(overflowTier, state.rackFloorTier ?? 0),
        0,
        3
      ),
      stackDepth: clamp(
        preview?.stackDepth ?? Math.max(overflowTier, state.rackFloorTier ?? 0),
        0,
        3
      ),
    },
  };
};

export const createBattleCapitalCanvasScene = ({
  player,
  enemy,
  ownershipPercent,
  pressureDirection = 'even',
  windSide = 'even',
  difficulty = 'normal',
  compact = false,
}: Pick<
  BattleCapitalCanvasProps,
  | 'player'
  | 'enemy'
  | 'ownershipPercent'
  | 'pressureDirection'
  | 'windSide'
  | 'difficulty'
  | 'compact'
>): BattleCapitalCanvasScene => ({
  player: normalizeSide('player', player),
  enemy: normalizeSide('enemy', enemy),
  ownershipPercent: clamp(ownershipPercent, 0, 100),
  pressureDirection,
  windSide,
  difficulty,
  compact,
});

/** Stable across React renders that carry identical visual state. */
export const getBattleCapitalCanvasSceneKey = (
  scene: BattleCapitalCanvasScene
) => JSON.stringify(scene);

const getCapitalPacketAnimationKey = (side: NormalizedCapitalSide) =>
  side.frame.activeColumnIndices.length > 0
    ? `${side.frame.presentationSerial}:${side.frame.packetSeed}:${side.frame.incomingBundleCopies}:${side.frame.activeColumnIndices.join(',')}`
    : '';

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
};

const deterministicNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return value - Math.floor(value);
};

const drawBackdrop = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: BattleCapitalCanvasScene,
  backgroundImage: HTMLImageElement | null
) => {
  const colors = DIFFICULTY_COLORS[scene.difficulty];
  context.globalCompositeOperation = 'copy';
  if (
    backgroundImage?.complete &&
    backgroundImage.naturalWidth > 0 &&
    backgroundImage.naturalHeight > 0
  ) {
    const sourceRatio =
      backgroundImage.naturalWidth / backgroundImage.naturalHeight;
    const targetRatio = width / height;
    let sourceWidth = backgroundImage.naturalWidth;
    let sourceHeight = backgroundImage.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    if (sourceRatio > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (backgroundImage.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / targetRatio;
      sourceY = (backgroundImage.naturalHeight - sourceHeight) / 2;
    }
    context.drawImage(
      backgroundImage,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height
    );
  } else {
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, colors.top);
    background.addColorStop(1, colors.bottom);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.globalCompositeOperation = 'source-over';

  const frontX = width * (scene.ownershipPercent / 100);
  const playerTerritory = context.createLinearGradient(0, 0, frontX, 0);
  playerTerritory.addColorStop(0, 'rgba(14, 165, 233, .18)');
  playerTerritory.addColorStop(1, 'rgba(125, 225, 255, .08)');
  context.fillStyle = playerTerritory;
  context.fillRect(0, 0, frontX, height);
  const enemyTerritory = context.createLinearGradient(frontX, 0, width, 0);
  enemyTerritory.addColorStop(0, 'rgba(255, 162, 179, .08)');
  enemyTerritory.addColorStop(1, 'rgba(225, 29, 72, .18)');
  context.fillStyle = enemyTerritory;
  context.fillRect(frontX, 0, width - frontX, height);

  // The battlefield itself must communicate which side is winning. This is a
  // static snapshot tied to ownership updates, not a continuous ambient loop.
  const frontlineWidth = clamp(width * 0.026, 7, 18);
  const frontlineGlow = context.createLinearGradient(
    frontX - frontlineWidth,
    0,
    frontX + frontlineWidth,
    0
  );
  frontlineGlow.addColorStop(0, 'rgba(64, 211, 255, 0)');
  frontlineGlow.addColorStop(0.42, 'rgba(132, 231, 255, .45)');
  frontlineGlow.addColorStop(0.5, 'rgba(255, 244, 190, .92)');
  frontlineGlow.addColorStop(0.58, 'rgba(255, 121, 151, .45)');
  frontlineGlow.addColorStop(1, 'rgba(255, 75, 114, 0)');
  context.fillStyle = frontlineGlow;
  context.fillRect(frontX - frontlineWidth, 0, frontlineWidth * 2, height);
  context.strokeStyle = 'rgba(255, 246, 204, .78)';
  context.lineWidth = clamp(width * 0.004, 1.5, 3);
  context.beginPath();
  context.moveTo(frontX, height * 0.12);
  context.lineTo(frontX, height * 0.91);
  context.stroke();

  if (scene.pressureDirection !== 'even') {
    const playerPush = scene.pressureDirection === 'player';
    const direction = playerPush ? 1 : -1;
    const pressureColor = playerPush
      ? 'rgba(88, 218, 255, .52)'
      : 'rgba(255, 103, 139, .52)';
    const chevronWidth = clamp(width * 0.04, 10, 25);
    context.strokeStyle = pressureColor;
    context.lineWidth = clamp(width * 0.006, 2, 4);
    context.lineCap = 'round';
    for (let row = 0; row < 5; row += 1) {
      const y = height * (0.22 + row * 0.13);
      for (let step = 1; step <= 3; step += 1) {
        const tipX = frontX - direction * chevronWidth * (step + 0.12);
        context.beginPath();
        context.moveTo(tipX - direction * chevronWidth, y - chevronWidth * 0.52);
        context.lineTo(tipX, y);
        context.lineTo(tipX - direction * chevronWidth, y + chevronWidth * 0.52);
        context.stroke();
      }
    }
    context.lineCap = 'butt';
  }

  if (scene.windSide !== 'even') {
    const playerWind = scene.windSide === 'player';
    const startX = playerWind ? width * 0.02 : width * 0.98;
    const endX = playerWind ? width * 0.63 : width * 0.37;
    context.strokeStyle = playerWind
      ? 'rgba(88, 218, 255, .2)'
      : 'rgba(255, 103, 139, .2)';
    context.lineWidth = Math.max(1, height * 0.009);
    for (let index = 0; index < 3; index += 1) {
      const offset = index * height * 0.055;
      context.beginPath();
      context.moveTo(startX, height * 0.32 + offset);
      context.quadraticCurveTo(
        width * 0.5,
        height * (0.2 + index * 0.035),
        endX,
        height * 0.38 + offset
      );
      context.stroke();
    }
  }
};

const drawCoin = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  side: BattleCapitalCanvasSide,
  alpha = 1
) => {
  const colors = SIDE_COLORS[side];
  context.globalAlpha = alpha;
  context.fillStyle = colors.coinDark;
  context.beginPath();
  context.ellipse(x, y + height * 0.28, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colors.coinMid;
  context.beginPath();
  context.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = colors.coinLight;
  context.lineWidth = Math.max(0.75, height * 0.18);
  context.beginPath();
  context.ellipse(x, y - height * 0.05, width * 0.34, height * 0.28, 0, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
};

const drawOverflowHoard = (
  context: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  areaWidth: number,
  side: NormalizedCapitalSide,
  coinWidth: number,
  coinHeight: number
) => {
  // Only coins that have actually completed their reload may spill around the
  // pedestal. The target tier is known before its packets arrive, so using it
  // here made loose coins appear on the old floor ahead of the descending pile.
  const tier = Math.floor(side.frame.stackDepth + 1e-6);
  if (tier <= 0) return;

  const colors = SIDE_COLORS[side.side];
  const moundWidth = areaWidth * (0.42 + tier * 0.1);
  context.fillStyle = colors.glow;
  context.beginPath();
  context.ellipse(
    centerX,
    baseY + coinHeight,
    moundWidth / 2,
    coinHeight * (1.2 + tier * 0.35),
    0,
    0,
    Math.PI * 2
  );
  context.fill();

  const spillCount = tier * 7;
  for (let index = 0; index < spillCount; index += 1) {
    const seed =
      side.frame.packetSeed +
      side.frame.presentationSerial * 97 +
      index * 41 +
      (side.side === 'player' ? 7 : 19);
    const spread = deterministicNoise(seed) - 0.5;
    const row = index % (tier + 2);
    drawCoin(
      context,
      centerX + spread * moundWidth,
      baseY + row * coinHeight * 0.55,
      coinWidth * (0.74 + deterministicNoise(seed + 3) * 0.25),
      coinHeight,
      side.side,
      0.72 + deterministicNoise(seed + 5) * 0.22
    );
  }
};

const drawCoinColumn = (
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  width: number,
  coinHeight: number,
  layerStep: number,
  layers: number,
  side: BattleCapitalCanvasSide,
  active: boolean
) => {
  if (layers <= 0) return;
  const colors = SIDE_COLORS[side];
  const bandShadow = side === 'player' ? '#4b2d0b' : '#430b17';
  const bandGlint = side === 'player' ? '#f5bd46' : '#ff7780';
  const activeCoinEdge = side === 'player' ? '#f5bd46' : '#ff7780';
  const bodyHeight = coinHeight + Math.max(0, layers - 1) * layerStep;
  const topY = baseY - bodyHeight;
  context.save();
  context.shadowColor = active
    ? activeCoinEdge
    : 'rgba(255, 192, 64, .38)';
  context.shadowBlur = active ? width * 0.72 : width * 0.28;
  context.shadowOffsetY = Math.max(1, coinHeight * 0.3);
  const gradient = context.createLinearGradient(
    x - width / 2,
    0,
    x + width / 2,
    0
  );
  gradient.addColorStop(0, bandShadow);
  gradient.addColorStop(0.16, colors.coinDark);
  gradient.addColorStop(0.46, colors.coinMid);
  gradient.addColorStop(0.7, colors.coinLight);
  gradient.addColorStop(0.84, bandGlint);
  gradient.addColorStop(1, colors.coinDark);
  context.fillStyle = gradient;
  roundedRect(
    context,
    x - width / 2,
    topY,
    width,
    bodyHeight + coinHeight * 0.12,
    Math.min(width * 0.16, coinHeight * 0.5)
  );
  context.fill();
  context.shadowBlur = 0;

  const seamCount = Math.min(15, Math.max(0, layers - 1));
  if (seamCount > 0) {
    context.lineWidth = Math.max(0.65, coinHeight * 0.1);
    for (let seam = 1; seam <= seamCount; seam += 1) {
      const seamY = topY + (bodyHeight * seam) / (seamCount + 1);
      context.strokeStyle = side === 'player'
        ? 'rgba(62, 31, 5, .65)'
        : 'rgba(70, 6, 18, .72)';
      context.beginPath();
      context.moveTo(x - width / 2, seamY);
      context.lineTo(x + width / 2, seamY);
      context.stroke();
      context.strokeStyle = side === 'player'
        ? 'rgba(255, 224, 125, .42)'
        : 'rgba(255, 184, 175, .46)';
      context.beginPath();
      context.moveTo(x - width * 0.44, seamY + Math.max(0.65, coinHeight * 0.12));
      context.lineTo(x + width * 0.4, seamY + Math.max(0.65, coinHeight * 0.12));
      context.stroke();
    }
  }

  context.fillStyle = colors.coinDark;
  context.beginPath();
  context.ellipse(x, baseY, width / 2, coinHeight / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = active ? colors.coinLight : colors.coinMid;
  context.beginPath();
  context.ellipse(x, topY, width / 2, coinHeight / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = active ? activeCoinEdge : colors.coinLight;
  context.lineWidth = active ? 1.65 : 1;
  context.stroke();
  context.strokeStyle = side === 'player'
    ? 'rgba(111, 61, 8, .72)'
    : 'rgba(112, 13, 29, .78)';
  context.lineWidth = Math.max(0.7, coinHeight * 0.13);
  context.beginPath();
  context.ellipse(
    x,
    topY - coinHeight * 0.04,
    width * 0.29,
    coinHeight * 0.27,
    0,
    0,
    Math.PI * 2
  );
  context.stroke();
  context.fillStyle = 'rgba(255, 249, 202, .9)';
  context.beginPath();
  context.ellipse(
    x - width * 0.17,
    topY - coinHeight * 0.18,
    width * 0.09,
    coinHeight * 0.08,
    -0.3,
    0,
    Math.PI * 2
  );
  context.fill();
  context.restore();
};

const drawCapitalSide = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: NormalizedCapitalSide
) => {
  const playerSide = side.side === 'player';
  const layout = resolveBattleCapitalCanvasLayout(width, height);
  const { areaWidth, sideInset } = layout;
  const areaLeft = playerSide ? sideInset : width * 0.5 + sideInset;
  const centerX = areaLeft + areaWidth / 2;
  const representativeColumn = layout.columns.at(-1) ?? layout.columns[0];
  const coinWidth = representativeColumn.coinWidth;
  const coinHeight = representativeColumn.coinHeight;
  const activeColumns = new Set(side.frame.activeColumnIndices);
  const maxRawLayers = Math.max(0, ...side.frame.columnHeights);
  const overflowLayers =
    side.frame.stackDepth * BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER;
  const renderedColumns = layout.columns.map((column, index) => {
    const layers = side.frame.columnHeights[index] ?? 0;
    const stackVariation = 0.98 + deterministicNoise(index * 37 + 11) * 0.04;
    const baseVisualLayers = resolveBattleCapitalVisualLayers({
      layers,
      depth: column.depth,
      maxRawLayers,
      variation: stackVariation,
    });
    const visualLayers =
      baseVisualLayers > 0 ? baseVisualLayers + overflowLayers : 0;
    const depthScale = 0.97 + column.depth * 0.01;
    const renderedCoinHeight = column.coinHeight * depthScale;
    const renderedLayerStep = column.layerStep * depthScale;
    const bodyHeight =
      visualLayers <= 0
        ? 0
        : renderedCoinHeight +
          Math.max(0, visualLayers - 1) * renderedLayerStep;
    const baselineLift =
      (column.bottom / 100) * height * 0.19 + column.depth * 0.25;
    return {
      column,
      index,
      visualLayers,
      renderedCoinWidth: column.coinWidth * depthScale,
      renderedCoinHeight,
      renderedLayerStep,
      bodyHeight,
      baselineLift,
    };
  });
  const tallestColumnExtent = Math.max(
    0,
    ...renderedColumns.map(({ bodyHeight, baselineLift }) =>
      bodyHeight > 0 ? bodyHeight + baselineLift : 0
    )
  );
  const stackGeometry = resolveBattleCapitalStackGeometry(
    height,
    layout.landscape,
    tallestColumnExtent,
    side.frame.rackDepth
  );
  const { baseY, safeTopY } = stackGeometry;

  const auraStrength = clamp(Math.log2(side.capitalRatio + 1) / 5, 0, 1);
  const pileGlow = context.createRadialGradient(
    centerX,
    baseY - height * 0.07,
    0,
    centerX,
    baseY - height * 0.07,
    areaWidth * 0.54
  );
  pileGlow.addColorStop(0, side.side === 'player'
    ? 'rgba(255, 218, 90, .38)'
    : 'rgba(255, 185, 74, .34)');
  pileGlow.addColorStop(0.54, SIDE_COLORS[side.side].glow);
  pileGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pileGlow;
  context.globalAlpha = 0.58 + auraStrength * 0.4;
  context.beginPath();
  context.ellipse(
    centerX,
    baseY + coinHeight,
    areaWidth * (0.43 + auraStrength * 0.11),
    height * (0.06 + auraStrength * 0.026),
    0,
    0,
    Math.PI * 2
  );
  context.fill();
  context.globalAlpha = 1;

  drawOverflowHoard(
    context,
    centerX,
    baseY,
    areaWidth,
    side,
    coinWidth,
    coinHeight
  );

  const rackWidth = areaWidth * 0.94;
  const rackHeight = clamp(height * 0.04, 7, 14);
  const rackGradient = context.createLinearGradient(0, baseY, 0, baseY + rackHeight);
  rackGradient.addColorStop(0, '#d7dee2');
  rackGradient.addColorStop(0.2, '#697984');
  rackGradient.addColorStop(0.64, '#28353d');
  rackGradient.addColorStop(1, '#0a1115');
  context.beginPath();
  context.ellipse(
    centerX,
    baseY + rackHeight * 0.34,
    rackWidth / 2,
    rackHeight * 0.82,
    0,
    0,
    Math.PI * 2
  );
  context.fillStyle = rackGradient;
  context.fill();
  context.strokeStyle = SIDE_COLORS[side.side].edge;
  context.globalAlpha = 0.68;
  context.lineWidth = 1.25;
  context.stroke();
  context.beginPath();
  context.ellipse(
    centerX,
    baseY,
    rackWidth * 0.49,
    rackHeight * 0.42,
    0,
    0,
    Math.PI * 2
  );
  context.fillStyle = 'rgba(226, 232, 240, .2)';
  context.fill();
  context.globalAlpha = 1;

  for (const {
    column,
    index,
    visualLayers,
    renderedCoinWidth,
    renderedCoinHeight,
    renderedLayerStep,
    bodyHeight,
    baselineLift,
  } of renderedColumns) {
    const mirroredPosition = playerSide ? column.xRatio : 1 - column.xRatio;
    const x = areaLeft + mirroredPosition * areaWidth;
    const columnBaseY = baseY - baselineLift;
    drawCoinColumn(
      context,
      x,
      columnBaseY,
      renderedCoinWidth,
      renderedCoinHeight,
      renderedLayerStep,
      visualLayers,
      side.side,
      activeColumns.has(index)
    );

    if (activeColumns.has(index)) {
      const packetOrder = side.frame.activeColumnIndices.indexOf(index);
      for (
        let copyIndex = 0;
        copyIndex < side.frame.incomingBundleCopies;
        copyIndex += 1
      ) {
        const packetLayers =
          3 +
          Math.abs(side.frame.packetSeed + index * 3 + copyIndex * 17) % 3;
        const delay = Math.min(
          0.22,
          Math.max(0, packetOrder) * 0.025 + copyIndex * 0.065
        );
        const staggeredProgress = clamp(
          (side.frame.packetProgress - delay) / Math.max(0.01, 1 - delay),
          0,
          1
        );
        const easedProgress = 1 - Math.pow(1 - staggeredProgress, 2.4);
        const packetHeight =
          renderedCoinHeight +
          Math.max(0, packetLayers - 1) * renderedLayerStep;
        const landingBaseY = columnBaseY - bodyHeight;
        // Start below the semantic gauge/readout band instead of dropping coins
        // behind it. The pile still has the full remaining field to gather speed.
        const startBaseY = safeTopY + packetHeight;
        const packetBaseY =
          startBaseY + (landingBaseY - startBaseY) * easedProgress;
        const unmergedWave = 1 - Math.pow(staggeredProgress, 4);
        const copyOffset =
          (copyIndex - (side.frame.incomingBundleCopies - 1) / 2) *
          renderedCoinWidth *
          0.16 *
          unmergedWave;
        const copyTrail =
          copyIndex *
          (packetHeight + renderedCoinHeight * 0.5) *
          unmergedWave;
        drawCoinColumn(
          context,
          x + copyOffset,
          packetBaseY + copyTrail,
          renderedCoinWidth,
          renderedCoinHeight,
          renderedLayerStep,
          packetLayers,
          side.side,
          true
        );
      }
    }
  }

  if (side.impact) {
    context.strokeStyle = SIDE_COLORS[side.side].edge;
    context.globalAlpha = 0.48;
    context.lineWidth = 1.5;
    for (let ring = 0; ring < 2; ring += 1) {
      context.beginPath();
      context.ellipse(
        centerX,
        baseY - height * 0.07,
        areaWidth * (0.22 + ring * 0.08),
        height * (0.12 + ring * 0.045),
        0,
        Math.PI * 1.08,
        Math.PI * 1.92
      );
      context.stroke();
    }
    context.globalAlpha = 1;
  }

};

const drawCenterClash = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  direction: BattleCapitalCanvasDirection
) => {
  const centerX = width / 2;
  const centerY = height * 0.59;
  const radius = clamp(Math.min(width, height) * 0.055, 8, 17);
  context.fillStyle = 'rgba(3, 7, 11, .88)';
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle =
    direction === 'player'
      ? SIDE_COLORS.player.edge
      : direction === 'enemy'
        ? SIDE_COLORS.enemy.edge
        : '#d8c88e';
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = '#f1e5b9';
  context.font = `700 ${clamp(radius * 0.82, 8, 12)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('VS', centerX, centerY + 0.5);
};

const getCanvasCssSize = (canvas: HTMLCanvasElement) => {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width || canvas.clientWidth || 720));
  const height = Math.max(
    1,
    Math.round(bounds.height || canvas.clientHeight || width * (7 / 16))
  );
  return { width, height };
};

/** Paints one complete, opaque frame. It never schedules another frame. */
export const paintBattleCapitalCanvas = (
  canvas: HTMLCanvasElement,
  scene: BattleCapitalCanvasScene,
  {
    devicePixelRatio,
    frameRate = 30,
    backgroundImage = null,
  }: Pick<BattleCapitalCanvasProps, 'devicePixelRatio' | 'frameRate'> & {
    backgroundImage?: HTMLImageElement | null;
  } = {}
): BattleCapitalCanvasMetrics | null => {
  const { width, height } = getCanvasCssSize(canvas);
  const nativeDpr =
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const requestedDpr = Number.isFinite(devicePixelRatio)
    ? devicePixelRatio as number
    : nativeDpr;
  const dpr = resolveBattleCanvasDpr({ requestedDpr, frameRate });
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  const context = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  });
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  drawBackdrop(context, width, height, scene, backgroundImage);
  drawCapitalSide(context, width, height, scene.player);
  drawCapitalSide(context, width, height, scene.enemy);
  drawCenterClash(context, width, height, scene.pressureDirection);

  canvas.dataset.renderDpr = dpr.toFixed(2);
  canvas.dataset.backingPixels = String(backingWidth * backingHeight);
  return {
    cssWidth: width,
    cssHeight: height,
    devicePixelRatio: dpr,
    backingPixels: backingWidth * backingHeight,
  };
};

/**
 * Snapshot renderer for the capital field. BattleModal retains the authoritative
 * timeline and state; this leaf schedules only bounded packet interpolation,
 * while an idle battle consumes no animation frames here.
 */
export const BattleCapitalCanvas = ({
  player,
  enemy,
  ownershipPercent,
  pressureDirection = 'even',
  windSide = 'even',
  difficulty = 'normal',
  compact = false,
  frameRate = 30,
  className = '',
  style,
  devicePixelRatio,
}: BattleCapitalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundsRef = useRef<{
    wide: HTMLImageElement | null;
    mobile: HTMLImageElement | null;
  }>({ wide: null, mobile: null });
  const mountedRef = useRef(true);
  const paintedSceneRef = useRef<BattleCapitalCanvasScene | null>(null);
  const packetClockRef = useRef<
    Record<BattleCapitalCanvasSide, CapitalPacketClock>
  >({
    player: { key: '', startedAt: 0 },
    enemy: { key: '', startedAt: 0 },
  });
  const rackClockRef = useRef<
    Record<BattleCapitalCanvasSide, CapitalRackClock>
  >({
    player: { fromDepth: 0, startedAt: 0, targetDepth: 0 },
    enemy: { fromDepth: 0, startedAt: 0, targetDepth: 0 },
  });
  const scene = createBattleCapitalCanvasScene({
    player,
    enemy,
    ownershipPercent,
    pressureDirection,
    windSide,
    difficulty,
    compact,
  });
  const sceneKey = getBattleCapitalCanvasSceneKey(scene);
  const sceneRef = useRef(scene);
  const renderOptionsRef = useRef({ devicePixelRatio, frameRate });
  sceneRef.current = scene;
  renderOptionsRef.current = { devicePixelRatio, frameRate };

  const repaint = useCallback((sceneOverride?: BattleCapitalCanvasScene) => {
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const backgroundImage =
      bounds.width <= 620
        ? backgroundsRef.current.mobile
        : backgroundsRef.current.wide;
    const sceneToPaint =
      sceneOverride ?? paintedSceneRef.current ?? sceneRef.current;
    paintedSceneRef.current = sceneToPaint;
    paintBattleCapitalCanvas(
      canvasRef.current,
      sceneToPaint,
      { ...renderOptionsRef.current, backgroundImage }
    );
  }, []);

  const ensureResponsiveBackdrop = useCallback(
    (width: number) => {
      if (typeof Image === 'undefined') return;
      const kind: BattleBackdropKind = width <= 620 ? 'mobile' : 'wide';
      if (backgroundsRef.current[kind]) return;
      void loadBattleBackdrop(kind)
        .then((image) => {
          if (!mountedRef.current) return;
          backgroundsRef.current[kind] = image;
          repaint();
        })
        .catch(() => {
          // The opaque gradient frame remains a complete fallback if decoding
          // fails; a later mount may retry because failed loads are not cached.
        });
    },
    [repaint]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let lastPaintAt = Number.NEGATIVE_INFINITY;
    let disposed = false;
    const effectStartedAt = performance.now();
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const hasPackets = (['player', 'enemy'] as const).some(
      (side) => scene[side].frame.activeColumnIndices.length > 0
    );
    const readRackDepth = (clock: CapitalRackClock, now: number) =>
      reducedMotion
        ? clock.targetDepth
        : easeBattleCapitalRackDepth(
            clock.fromDepth,
            clock.targetDepth,
            now - clock.startedAt
          );
    for (const side of ['player', 'enemy'] as const) {
      const packetKey = getCapitalPacketAnimationKey(scene[side]);
      if (packetClockRef.current[side].key !== packetKey) {
        packetClockRef.current[side] = {
          key: packetKey,
          startedAt: effectStartedAt,
        };
      }
      const rackClock = rackClockRef.current[side];
      const targetDepth = scene[side].frame.rackDepth;
      if (targetDepth > rackClock.targetDepth) {
        rackClockRef.current[side] = {
          fromDepth: readRackDepth(rackClock, effectStartedAt),
          startedAt: effectStartedAt,
          targetDepth,
        };
      } else if (targetDepth < rackClock.targetDepth) {
        rackClockRef.current[side] = {
          fromDepth: targetDepth,
          startedAt: effectStartedAt,
          targetDepth,
        };
      }
    }
    const hasRackMotion = (['player', 'enemy'] as const).some((side) => {
      const clock = rackClockRef.current[side];
      return readRackDepth(clock, effectStartedAt) < clock.targetDepth - 0.001;
    });
    const intervalMs = 1_000 / frameRate;

    const project = (now: number): BattleCapitalCanvasScene => {
      const projectSide = (side: NormalizedCapitalSide) => ({
        ...side,
        frame: {
          ...side.frame,
          packetProgress:
            side.frame.activeColumnIndices.length === 0 || reducedMotion
              ? 1
              : clamp(
                  (now - packetClockRef.current[side.side].startedAt) /
                    side.frame.beatDurationMs,
                  0,
                  1
                ),
          rackDepth: readRackDepth(rackClockRef.current[side.side], now),
        },
      });
      return {
        ...scene,
        player: projectSide(scene.player),
        enemy: projectSide(scene.enemy),
      };
    };

    const tick = (now: number) => {
      animationFrame = 0;
      if (disposed || document.hidden) return;
      if (now - lastPaintAt >= intervalMs - 0.5) {
        lastPaintAt = now;
        const projected = project(now);
        repaint(projected);
        const complete = (['player', 'enemy'] as const).every(
          (side) => {
            const packetComplete =
              projected[side].frame.activeColumnIndices.length === 0 ||
              projected[side].frame.packetProgress >= 1;
            const rackComplete =
              projected[side].frame.rackDepth >=
              rackClockRef.current[side].targetDepth - 0.001;
            return packetComplete && rackComplete;
          }
        );
        if (complete) return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    const resume = () => {
      if (disposed || document.hidden || animationFrame) return;
      if ((hasPackets || hasRackMotion) && !reducedMotion) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        repaint(project(performance.now()));
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
      resume();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    resume();
    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [frameRate, repaint, sceneKey, devicePixelRatio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    ensureResponsiveBackdrop(canvas.getBoundingClientRect().width);
    return () => {
      backgroundsRef.current = { wide: null, mobile: null };
    };
  }, [ensureResponsiveBackdrop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const handleResize = () => {
      ensureResponsiveBackdrop(canvas.getBoundingClientRect().width);
      repaint();
    };
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(handleResize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [ensureResponsiveBackdrop, repaint]);

  return (
    <canvas
      ref={canvasRef}
      className={`battle-capital-canvas ${className}`.trim()}
      data-compact={compact ? 'true' : 'false'}
      data-renderer="canvas2d-snapshot"
      aria-hidden="true"
      style={style}
    />
  );
};
