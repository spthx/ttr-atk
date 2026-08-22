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
import './BattleCapitalCanvas.css';

export type BattleCapitalCanvasSide = 'player' | 'enemy';
export type BattleCapitalCanvasDirection = BattleCapitalCanvasSide | 'even';
export type BattleCapitalCanvasDifficulty =
  | 'normal'
  | 'savage'
  | 'ultimate'
  | 'cruel';

export interface BattleCapitalCanvasPreviewFrame
  extends MechanicalCapitalColumnFrame {
  overflowTier?: number;
  presentationSerial?: number;
  presentedCapital?: number;
  packetSeed?: number;
  beatDurationMs?: number;
  strongBeat?: boolean;
}

export interface BattleCapitalCanvasSideState {
  amount: number;
  marketPrice: number;
  capitalRatio?: number;
  previewFrame?: BattleCapitalCanvasPreviewFrame | null;
  rackFloorDepth?: number;
  impact?: boolean;
}

export interface BattleCapitalCanvasProps {
  player: BattleCapitalCanvasSideState;
  enemy: BattleCapitalCanvasSideState;
  ownershipPercent: number;
  pressureDirection?: BattleCapitalCanvasDirection;
  windSide?: BattleCapitalCanvasDirection;
  difficulty?: BattleCapitalCanvasDifficulty;
  compact?: boolean;
  frameRate?: 30 | 60;
  className?: string;
  style?: CSSProperties;
  devicePixelRatio?: number;
}

interface NormalizedCapitalFrame {
  visibleUnits: number;
  columnHeights: number[];
  settledAfterColumnHeights: number[];
  bankedColumnHeights: number[];
  bankedPileCount: number;
  bankTransfer: boolean;
  bankTransferPages: number;
  activeColumnIndices: number[];
  incomingBundleCopies: number;
  incomingBundleLayers?: number;
  overflowTier: number;
  presentationSerial: number;
  packetSeed: number;
  packetProgress: number;
  beatDurationMs: number;
  strongBeat: boolean;
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

export interface BattleCapitalCanvasCssSize {
  width: number;
  height: number;
}

interface CapitalPacketClock {
  key: string;
  startedAt: number;
}

interface CoinColumnLayout {
  index: number;
  depth: number;
  x: number;
  baseY: number;
}

interface StaticCanvasCacheEntry {
  canvas: HTMLCanvasElement;
  key: string;
  backingWidth: number;
  backingHeight: number;
}

const staticCanvasCache = new WeakMap<HTMLCanvasElement, StaticCanvasCacheEntry>();

const ROW_COUNTS = [4, 5, 5, 4] as const;
const GOLD = {
  outline: '#3f2507',
  shadow: '#80510d',
  body: '#c88718',
  face: '#edae2b',
  light: '#ffe071',
} as const;
const TRAY = {
  outline: '#171026',
  shadow: '#302342',
  mid: '#655475',
  light: '#a59aaf',
  shine: '#d5cfda',
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const finiteNonNegative = (value: number, fallback = 0) =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

const snap = (value: number) => Math.round(value);

const normalizeHeights = (source: readonly number[]) =>
  Array.from({ length: BATTLE_CAPITAL_COLUMN_COUNT }, (_, index) =>
    Math.round(
      clamp(source[index] ?? 0, 0, MAX_BATTLE_CAPITAL_COLUMN_LAYERS)
    )
  );

const normalizeSide = (
  side: BattleCapitalCanvasSide,
  state: BattleCapitalCanvasSideState
): NormalizedCapitalSide => {
  const amount = finiteNonNegative(state.amount);
  const marketPrice = Math.max(1, finiteNonNegative(state.marketPrice, 1));
  const preview = state.previewFrame;
  const fallbackVisibleUnits = getBattleCapitalVisibleUnits(amount, marketPrice);
  const visibleUnits = Math.max(
    0,
    Math.round(preview?.visibleUnits ?? fallbackVisibleUnits)
  );
  const sourceHeights =
    preview?.columnHeights ?? getCapitalColumnHeights(visibleUnits);
  const columnHeights = normalizeHeights(sourceHeights);
  const settledAfterColumnHeights = normalizeHeights(
    preview?.settledAfterColumnHeights ?? sourceHeights
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

  return {
    side,
    capitalRatio: finiteNonNegative(
      state.capitalRatio ?? amount / marketPrice
    ),
    impact: state.impact === true,
    frame: {
      visibleUnits,
      columnHeights,
      settledAfterColumnHeights,
      // Compatibility fields stay neutral. The SFC display never banks pages
      // and never lowers either tray; tall columns simply clip at the top.
      bankedColumnHeights: Array(BATTLE_CAPITAL_COLUMN_COUNT).fill(0),
      bankedPileCount: 0,
      bankTransfer: false,
      bankTransferPages: 0,
      activeColumnIndices,
      incomingBundleCopies: 1,
      incomingBundleLayers:
        preview?.incomingBundleLayers === undefined
          ? undefined
          : Math.round(clamp(preview.incomingBundleLayers, 3, 6)),
      overflowTier: Math.round(
        clamp(
          preview?.overflowTier ??
            getBattleCapitalOverflowTier(amount, marketPrice),
          0,
          3
        )
      ),
      presentationSerial: Math.round(
        finiteNonNegative(preview?.presentationSerial ?? 0)
      ),
      packetSeed: Math.round(finiteNonNegative(preview?.packetSeed ?? 0)),
      packetProgress: activeColumnIndices.length > 0 ? 0 : 1,
      beatDurationMs: Math.max(1, preview?.beatDurationMs ?? 99),
      strongBeat: preview?.strongBeat === true,
      rackDepth: 0,
      stackDepth: 0,
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

export const getBattleCapitalCanvasSceneKey = (
  scene: BattleCapitalCanvasScene
) => JSON.stringify(scene);

const getCapitalPacketAnimationKey = (side: NormalizedCapitalSide) =>
  side.frame.activeColumnIndices.length > 0
    ? `${side.frame.presentationSerial}:${side.frame.packetSeed}:${side.frame.incomingBundleLayers ?? 0}:${side.frame.activeColumnIndices.join(',')}`
    : '';

const drawPixelArrowBands = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: BattleCapitalCanvasScene
) => {
  context.globalCompositeOperation = 'copy';
  context.fillStyle = '#b6ad91';
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';

  const boundary = clamp(width * scene.ownershipPercent / 100, 0, width);
  const chevronWidth = Math.max(22, snap(width / 10));
  context.globalAlpha = 0.62;
  for (let x = -chevronWidth; x < width + chevronWidth; x += chevronWidth) {
    const stripe = Math.floor((x + chevronWidth) / chevronWidth);
    context.fillStyle = stripe % 2 === 0 ? '#91ad91' : '#c4a4a1';
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + chevronWidth * 0.58, 0);
    context.lineTo(x + chevronWidth, height / 2);
    context.lineTo(x + chevronWidth * 0.58, height);
    context.lineTo(x, height);
    context.lineTo(x + chevronWidth * 0.42, height / 2);
    context.closePath();
    context.fill();
  }
  context.globalAlpha = 1;

  const laneHeight = Math.max(5, snap(height * 0.035));
  const arrowHead = Math.max(8, snap(width * 0.018));
  for (let lane = 0; lane < 6; lane += 1) {
    const y = height * (0.1 + lane * 0.135);
    const playerLane = lane % 2 === 1;
    context.fillStyle = playerLane ? '#a91e2f' : '#244f83';
    context.beginPath();
    if (playerLane) {
      context.moveTo(0, y);
      context.lineTo(boundary, y);
      context.lineTo(Math.min(width, boundary + arrowHead), y + laneHeight / 2);
      context.lineTo(boundary, y + laneHeight);
      context.lineTo(0, y + laneHeight);
    } else {
      context.moveTo(width, y);
      context.lineTo(boundary, y);
      context.lineTo(Math.max(0, boundary - arrowHead), y + laneHeight / 2);
      context.lineTo(boundary, y + laneHeight);
      context.lineTo(width, y + laneHeight);
    }
    context.closePath();
    context.fill();
    context.globalAlpha = 0.48;
    context.fillStyle = '#f2e5b7';
    context.fillRect(
      playerLane ? 0 : boundary,
      snap(y + 1),
      playerLane ? boundary : width - boundary,
      1
    );
    context.globalAlpha = 1;
  }
}

const getSideGeometry = (
  width: number,
  height: number,
  side: BattleCapitalCanvasSide
) => {
  const halfWidth = width / 2;
  const centerX = side === 'player' ? halfWidth * 0.5 : halfWidth * 1.5;
  const maximumTrayWidth = Math.min(halfWidth * 0.92, height * 1.42);
  const coinWidth = clamp(
    Math.min(maximumTrayWidth / 5, height * 0.115),
    9,
    40
  );
  const trayWidth = Math.min(maximumTrayWidth, coinWidth * 7.2);
  const coinHeight = clamp(coinWidth * 0.28, 3, 9);
  const layerStep = clamp(coinWidth * 0.115, 1.5, 4.25);
  const trayY = height * (width / Math.max(1, height) >= 1.45 ? 0.81 : 0.83);
  return {
    centerX,
    trayWidth,
    trayHeight: clamp(coinWidth * 1.18, 11, 34),
    trayY,
    coinWidth,
    coinHeight,
    layerStep,
  };
};

const buildColumnLayout = (
  width: number,
  height: number,
  side: BattleCapitalCanvasSide
) => {
  const geometry = getSideGeometry(width, height, side);
  const columns: CoinColumnLayout[] = [];
  let index = 0;
  ROW_COUNTS.forEach((count, depth) => {
    const pitch = geometry.coinWidth * 0.93;
    const rowWidth = pitch * (count - 1);
    const rowBaseY =
      geometry.trayY - geometry.coinHeight * (5.9 - depth * 1.65);
    for (let column = 0; column < count; column += 1) {
      columns.push({
        index,
        depth,
        x: geometry.centerX - rowWidth / 2 + column * pitch,
        baseY: rowBaseY,
      });
      index += 1;
    }
  });
  return { ...geometry, columns };
};

const drawTrayBack = (
  context: CanvasRenderingContext2D,
  centerX: number,
  trayY: number,
  trayWidth: number,
  trayHeight: number
) => {
  context.fillStyle = TRAY.outline;
  context.beginPath();
  context.ellipse(
    snap(centerX),
    snap(trayY),
    snap(trayWidth / 2 + 2),
    snap(trayHeight / 2 + 2),
    0,
    0,
    Math.PI * 2
  );
  context.fill();
  context.fillStyle = TRAY.mid;
  context.beginPath();
  context.ellipse(centerX, trayY, trayWidth / 2, trayHeight / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = TRAY.shadow;
  context.beginPath();
  context.ellipse(centerX, trayY + trayHeight * 0.08, trayWidth * 0.4, trayHeight * 0.32, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = TRAY.light;
  context.lineWidth = 1;
  for (let index = 0; index < 12; index += 1) {
    const angle = Math.PI + Math.PI * index / 11;
    context.beginPath();
    context.moveTo(centerX, trayY + trayHeight * 0.08);
    context.lineTo(
      centerX + Math.cos(angle) * trayWidth * 0.47,
      trayY + Math.sin(angle) * trayHeight * 0.42
    );
    context.stroke();
  }
};

const drawTrayFront = (
  context: CanvasRenderingContext2D,
  centerX: number,
  trayY: number,
  trayWidth: number,
  trayHeight: number
) => {
  context.strokeStyle = TRAY.shine;
  context.lineWidth = Math.max(1, snap(trayHeight * 0.12));
  context.beginPath();
  context.ellipse(centerX, trayY, trayWidth / 2, trayHeight / 2, 0, 0.08, Math.PI - 0.08);
  context.stroke();
  context.strokeStyle = TRAY.outline;
  context.lineWidth = Math.max(1, snap(trayHeight * 0.16));
  context.beginPath();
  context.ellipse(centerX, trayY + 1, trayWidth / 2, trayHeight / 2, 0, 0.08, Math.PI - 0.08);
  context.stroke();
  context.strokeStyle = TRAY.light;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(centerX, trayY - 1, trayWidth * 0.48, trayHeight * 0.42, 0, Math.PI + 0.08, Math.PI * 2 - 0.08);
  context.stroke();
};

const drawCoinRoll = (
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  width: number,
  coinHeight: number,
  layerStep: number,
  layers: number,
  clipTopY = 0
) => {
  const normalizedLayers = Math.max(0, Math.round(layers));
  if (normalizedLayers <= 0) return;
  const bodyHeight = coinHeight + (normalizedLayers - 1) * layerStep;
  const topY = baseY - bodyHeight;
  const left = snap(x - width / 2);
  const bodyWidth = Math.max(2, snap(width));
  const bodyTop = Math.max(snap(clipTopY), snap(topY + coinHeight * 0.45));
  const bodyBottom = snap(baseY - coinHeight * 0.38);

  if (bodyBottom < clipTopY) return;

  context.fillStyle = GOLD.outline;
  context.fillRect(left - 1, bodyTop - 1, bodyWidth + 2, Math.max(2, bodyBottom - bodyTop + 2));
  context.fillStyle = GOLD.shadow;
  context.fillRect(left, bodyTop, bodyWidth, Math.max(1, bodyBottom - bodyTop));
  context.fillStyle = GOLD.body;
  context.fillRect(left + 2, bodyTop, Math.max(1, bodyWidth - 5), Math.max(1, bodyBottom - bodyTop));
  context.fillStyle = GOLD.light;
  context.fillRect(left + 2, bodyTop, Math.max(1, snap(width * 0.12)), Math.max(1, bodyBottom - bodyTop));
  context.fillStyle = GOLD.outline;
  context.fillRect(left + bodyWidth - 3, bodyTop, 3, Math.max(1, bodyBottom - bodyTop));

  context.strokeStyle = GOLD.shadow;
  context.lineWidth = 1;
  const visibleSeamCount = Math.min(
    normalizedLayers - 1,
    Math.max(
      0,
      Math.floor((baseY - coinHeight * 0.42 - clipTopY) / layerStep)
    )
  );
  for (let layer = 1; layer <= visibleSeamCount; layer += 1) {
    const seamY = snap(baseY - coinHeight * 0.42 - layer * layerStep);
    context.beginPath();
    context.moveTo(left + 1, seamY);
    context.lineTo(left + bodyWidth - 1, seamY);
    context.stroke();
    if (layer % 2 === 0) {
      context.fillStyle = GOLD.face;
      context.fillRect(left + 3, seamY - 1, Math.max(1, bodyWidth - 7), 1);
    }
  }

  if (topY + coinHeight < clipTopY) return;

  context.fillStyle = GOLD.outline;
  context.beginPath();
  context.ellipse(snap(x), snap(topY + coinHeight * 0.42), width / 2 + 1, coinHeight / 2 + 1, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = GOLD.face;
  context.beginPath();
  context.ellipse(snap(x), snap(topY + coinHeight * 0.35), width / 2, coinHeight / 2, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = GOLD.light;
  context.beginPath();
  context.ellipse(snap(x - width * 0.08), snap(topY + coinHeight * 0.23), width * 0.3, coinHeight * 0.22, 0, Math.PI, Math.PI * 2);
  context.fill();
};

const drawCapitalSideBase = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: NormalizedCapitalSide
) => {
  const geometry = buildColumnLayout(width, height, side.side);
  drawTrayBack(
    context,
    geometry.centerX,
    geometry.trayY,
    geometry.trayWidth,
    geometry.trayHeight
  );

  geometry.columns.forEach((column) => {
    drawCoinRoll(
      context,
      column.x,
      column.baseY,
      geometry.coinWidth,
      geometry.coinHeight,
      geometry.layerStep,
      side.frame.columnHeights[column.index] ?? 0
    );
  });
};

const drawCapitalSideIncoming = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: NormalizedCapitalSide
) => {
  const geometry = buildColumnLayout(width, height, side.side);
  const active = new Set(side.frame.activeColumnIndices);
  geometry.columns.forEach((column) => {
    if (!active.has(column.index)) return;
    const before = side.frame.columnHeights[column.index] ?? 0;
    const after = side.frame.settledAfterColumnHeights[column.index] ?? before;
    const addedLayers = Math.max(1, after - before);
    const bundleLayers = Math.max(
      3,
      Math.min(6, side.frame.incomingBundleLayers ?? addedLayers)
    );
    const landingBaseY = column.baseY - before * geometry.layerStep;
    const startBaseY = Math.min(
      -geometry.coinHeight,
      landingBaseY - height * 0.22 - bundleLayers * geometry.layerStep
    );
    // The SFC animation exposes three coarse positions at 30fps rather than a
    // smooth physics arc. Keep the final sample exact so rolls merge cleanly.
    const rawProgress = clamp(side.frame.packetProgress, 0, 1);
    const laneDelay = ((column.index + side.frame.packetSeed) % 3) * 0.08;
    const laneProgress = clamp(
      (rawProgress - laneDelay) / Math.max(0.01, 1 - laneDelay),
      0,
      1
    );
    const steppedProgress = laneProgress >= 1
      ? 1
      : Math.floor(laneProgress * 3) / 3;
    const packetBaseY =
      startBaseY + (landingBaseY - startBaseY) * steppedProgress;
    drawCoinRoll(
      context,
      column.x,
      packetBaseY,
      geometry.coinWidth,
      geometry.coinHeight,
      geometry.layerStep,
      bundleLayers
    );
  });
};

const drawCapitalSideTrayFront = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: NormalizedCapitalSide
) => {
  const geometry = buildColumnLayout(width, height, side.side);
  drawTrayFront(
    context,
    geometry.centerX,
    geometry.trayY,
    geometry.trayWidth,
    geometry.trayHeight
  );
};

const getStaticSceneKey = (scene: BattleCapitalCanvasScene) =>
  JSON.stringify({
    ownershipPercent: scene.ownershipPercent,
    pressureDirection: scene.pressureDirection,
    windSide: scene.windSide,
    difficulty: scene.difficulty,
    compact: scene.compact,
    player: scene.player.frame.columnHeights,
    enemy: scene.enemy.frame.columnHeights,
  });

const getCanvasCssSize = (
  canvas: HTMLCanvasElement,
  override: BattleCapitalCanvasCssSize | null = null
) => {
  if (override) {
    return {
      width: Math.max(1, override.width),
      height: Math.max(1, override.height),
    };
  }
  const bounds = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, bounds.width || canvas.clientWidth || 1),
    height: Math.max(1, bounds.height || canvas.clientHeight || 1),
  };
};

export const paintBattleCapitalCanvas = (
  canvas: HTMLCanvasElement,
  scene: BattleCapitalCanvasScene,
  {
    devicePixelRatio,
    frameRate = 30,
    backgroundImage: _backgroundImage = null,
    cssSize = null,
  }: Pick<BattleCapitalCanvasProps, 'devicePixelRatio' | 'frameRate'> & {
    backgroundImage?: HTMLImageElement | null;
    cssSize?: BattleCapitalCanvasCssSize | null;
  } = {}
): BattleCapitalCanvasMetrics | null => {
  const { width, height } = getCanvasCssSize(canvas, cssSize);
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
  const staticKey = getStaticSceneKey(scene);
  let cached = staticCanvasCache.get(canvas);
  if (
    !cached ||
    cached.key !== staticKey ||
    cached.backingWidth !== backingWidth ||
    cached.backingHeight !== backingHeight
  ) {
    const cacheCanvas =
      cached?.canvas ?? canvas.ownerDocument.createElement('canvas');
    cacheCanvas.width = backingWidth;
    cacheCanvas.height = backingHeight;
    const cacheContext = cacheCanvas.getContext('2d', { alpha: false });
    if (!cacheContext) return null;
    cacheContext.setTransform(
      backingWidth / width,
      0,
      0,
      backingHeight / height,
      0,
      0
    );
    cacheContext.imageSmoothingEnabled = false;
    drawPixelArrowBands(cacheContext, width, height, scene);
    drawCapitalSideBase(cacheContext, width, height, scene.player);
    drawCapitalSideBase(cacheContext, width, height, scene.enemy);
    cached = {
      canvas: cacheCanvas,
      key: staticKey,
      backingWidth,
      backingHeight,
    };
    staticCanvasCache.set(canvas, cached);
  }

  // A late-game field can contain thousands of one-coin seam lines. Cache the
  // completed field once per authored wave; animation frames then draw only
  // the short falling rolls and the two inexpensive tray fronts.
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(cached.canvas, 0, 0);
  context.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0);
  drawCapitalSideIncoming(context, width, height, scene.player);
  drawCapitalSideIncoming(context, width, height, scene.enemy);
  drawCapitalSideTrayFront(context, width, height, scene.player);
  drawCapitalSideTrayFront(context, width, height, scene.enemy);

  const renderDpr = dpr.toFixed(2);
  const backingPixels = String(backingWidth * backingHeight);
  if (canvas.dataset.renderDpr !== renderDpr) canvas.dataset.renderDpr = renderDpr;
  if (canvas.dataset.backingPixels !== backingPixels) {
    canvas.dataset.backingPixels = backingPixels;
  }
  return {
    cssWidth: width,
    cssHeight: height,
    devicePixelRatio: dpr,
    backingPixels: backingWidth * backingHeight,
  };
};

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
  const canvasSizeRef = useRef<BattleCapitalCanvasCssSize | null>(null);
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
  const packetClockRef = useRef<Record<BattleCapitalCanvasSide, CapitalPacketClock>>({
    player: { key: '', startedAt: 0 },
    enemy: { key: '', startedAt: 0 },
  });
  sceneRef.current = scene;

  const repaint = useCallback((sceneToPaint: BattleCapitalCanvasScene) => {
    if (!canvasRef.current) return;
    paintBattleCapitalCanvas(canvasRef.current, sceneToPaint, {
      devicePixelRatio,
      frameRate,
      cssSize: canvasSizeRef.current,
    });
  }, [devicePixelRatio, frameRate]);

  useEffect(() => {
    let animationFrame = 0;
    let disposed = false;
    let lastPaintAt = Number.NEGATIVE_INFINITY;
    const effectStartedAt = performance.now();
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    for (const side of ['player', 'enemy'] as const) {
      const key = getCapitalPacketAnimationKey(scene[side]);
      if (packetClockRef.current[side].key !== key) {
        packetClockRef.current[side] = { key, startedAt: effectStartedAt };
      }
    }

    const project = (now: number): BattleCapitalCanvasScene => {
      const projectSide = (side: NormalizedCapitalSide): NormalizedCapitalSide => ({
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
        },
      });
      return {
        ...scene,
        player: projectSide(scene.player),
        enemy: projectSide(scene.enemy),
      };
    };

    const tick = (now: number) => {
      if (disposed) return;
      const projected = project(now);
      let paintedThisTick = false;
      if (now - lastPaintAt >= 1_000 / frameRate - 0.5) {
        repaint(projected);
        lastPaintAt = now;
        paintedThisTick = true;
      }
      const active = (['player', 'enemy'] as const).some(
        (side) => projected[side].frame.packetProgress < 1
      );
      if (active) animationFrame = window.requestAnimationFrame(tick);
      else if (!paintedThisTick) repaint(projected);
    };
    repaint(project(effectStartedAt));
    if (!reducedMotion && (['player', 'enemy'] as const).some(
      (side) => scene[side].frame.activeColumnIndices.length > 0
    )) {
      animationFrame = window.requestAnimationFrame(tick);
    }
    return () => {
      disposed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [repaint, sceneKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const bounds = canvas.getBoundingClientRect();
      canvasSizeRef.current = {
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height),
      };
      repaint(sceneRef.current);
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [repaint]);

  return (
    <canvas
      ref={canvasRef}
      className={`battle-capital-canvas ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  );
};

export default BattleCapitalCanvas;
