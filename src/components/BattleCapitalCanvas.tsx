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
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS,
  BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT,
  resolveBattleCapitalSfcColumnX,
  resolveBattleCapitalSfcIncomingLogicalLayers,
  resolveBattleCapitalSfcRenderedCoinLayers,
  resolveBattleCapitalSfcRowBaseY,
  resolveBattleCapitalSfcSideGeometry,
} from '../utils/battleCapitalCanvasLayout';
import capitalCoinSpriteUrl from '../assets/battle/capital-coin-sfc.png';
import capitalPedestalSpriteUrl from '../assets/battle/capital-pedestal-sfc.png';
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

export interface BattleCapitalCanvasSprites {
  coin: HTMLImageElement;
  pedestal: HTMLImageElement;
}

const staticCanvasCache = new WeakMap<HTMLCanvasElement, StaticCanvasCacheEntry>();

const ROW_COUNTS = BATTLE_CAPITAL_CANVAS_ROW_COUNTS;
// Crop away generated transparent padding before each sprite is scaled. This
// keeps the same measured SFC proportions on every viewport and DPR.
const COIN_SPRITE_CROP = {
  x: 130,
  y: 37,
  width: 1847,
  height: 710,
} as const;
const PEDESTAL_SPRITE_CROP = {
  x: 313,
  y: 59,
  width: 1668,
  height: 631,
} as const;
// Preserve every source pixel's aspect ratio while making the pedestal as
// broad as the SFC dais. Only a narrow straight centre strip repeats between
// the untouched curved caps; no visible slice is non-uniformly stretched.
const PEDESTAL_SPRITE_CENTER_WIDTH = 64;
const PEDESTAL_SPRITE_CAP_WIDTH =
  (PEDESTAL_SPRITE_CROP.width - PEDESTAL_SPRITE_CENTER_WIDTH) / 2;
const PEDESTAL_SPRITE_CENTER_TILE_COUNT = 12;
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
      beatDurationMs: Math.max(1, preview?.beatDurationMs ?? 165),
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

const buildColumnLayout = (
  width: number,
  height: number,
  side: BattleCapitalCanvasSide
) => {
  const geometry = resolveBattleCapitalSfcSideGeometry(width, height, side);
  const columns: CoinColumnLayout[] = [];
  let index = 0;
  ROW_COUNTS.forEach((count, depth) => {
    const pitch = geometry.coinWidth * 0.9;
    const rowBaseY = resolveBattleCapitalSfcRowBaseY(
      geometry.pedestalTopY,
      geometry.pedestalHeight,
      depth
    );
    for (let column = 0; column < count; column += 1) {
      columns.push({
        index,
        depth,
        x: resolveBattleCapitalSfcColumnX({
          centerX: geometry.centerX,
          pitch,
          count,
          column,
          mirrored: side === 'enemy',
        }),
        baseY: rowBaseY,
      });
      index += 1;
    }
  });
  return { ...geometry, columns };
};

const drawWidePedestalSlice = (
  context: CanvasRenderingContext2D,
  pedestal: HTMLImageElement,
  geometry: ReturnType<typeof buildColumnLayout>,
  sourceY: number,
  sourceHeight: number,
  destinationY: number,
  destinationHeight: number
) => {
  const sourceSlices = [
    {
      x: PEDESTAL_SPRITE_CROP.x,
      width: PEDESTAL_SPRITE_CAP_WIDTH,
    },
    ...Array.from({ length: PEDESTAL_SPRITE_CENTER_TILE_COUNT }, () => ({
      x: PEDESTAL_SPRITE_CROP.x + PEDESTAL_SPRITE_CAP_WIDTH,
      width: PEDESTAL_SPRITE_CENTER_WIDTH,
    })),
    {
      x: PEDESTAL_SPRITE_CROP.x + PEDESTAL_SPRITE_CAP_WIDTH +
        PEDESTAL_SPRITE_CENTER_WIDTH,
      width: PEDESTAL_SPRITE_CAP_WIDTH,
    },
  ];
  const scale = geometry.pedestalHeight / PEDESTAL_SPRITE_CROP.height;
  const destinationLeft = geometry.centerX - geometry.pedestalWidth / 2;
  let sourceOffset = 0;

  sourceSlices.forEach((slice) => {
    const left = snap(destinationLeft + sourceOffset * scale);
    sourceOffset += slice.width;
    const right = snap(destinationLeft + sourceOffset * scale);
    context.drawImage(
      pedestal,
      slice.x,
      sourceY,
      slice.width,
      sourceHeight,
      left,
      snap(destinationY),
      Math.max(1, right - left),
      Math.max(1, snap(destinationHeight))
    );
  });
};

const drawPedestalBack = (
  context: CanvasRenderingContext2D,
  geometry: ReturnType<typeof buildColumnLayout>,
  pedestal: HTMLImageElement
) => {
  drawWidePedestalSlice(
    context,
    pedestal,
    geometry,
    PEDESTAL_SPRITE_CROP.y,
    PEDESTAL_SPRITE_CROP.height,
    geometry.pedestalTopY,
    geometry.pedestalHeight
  );
};

const drawPedestalFront = (
  context: CanvasRenderingContext2D,
  geometry: ReturnType<typeof buildColumnLayout>,
  pedestal: HTMLImageElement
) => {
  const sourceY = PEDESTAL_SPRITE_CROP.y +
    PEDESTAL_SPRITE_CROP.height * BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT;
  const sourceHeight = PEDESTAL_SPRITE_CROP.height *
    (1 - BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT);
  const destinationY = geometry.pedestalTopY +
    geometry.pedestalHeight * BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT;
  const destinationHeight = geometry.pedestalHeight *
    (1 - BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT);
  drawWidePedestalSlice(
    context,
    pedestal,
    geometry,
    sourceY,
    sourceHeight,
    destinationY,
    destinationHeight
  );
};

const drawCoinStack = (
  context: CanvasRenderingContext2D,
  coin: HTMLImageElement,
  x: number,
  baseY: number,
  width: number,
  coinHeight: number,
  layerStep: number,
  layers: number,
  clipTopY = 0
) => {
  const renderedLayers = resolveBattleCapitalSfcRenderedCoinLayers(layers);
  if (renderedLayers <= 0) return;

  context.save();
  context.beginPath();
  context.rect(0, snap(clipTopY), context.canvas.width, context.canvas.height);
  context.clip();
  for (let layer = 0; layer < renderedLayers; layer += 1) {
    const layerBottomY = baseY - layer * layerStep;
    if (layerBottomY < clipTopY) continue;
    context.drawImage(
      coin,
      COIN_SPRITE_CROP.x,
      COIN_SPRITE_CROP.y,
      COIN_SPRITE_CROP.width,
      COIN_SPRITE_CROP.height,
      snap(x - width / 2),
      snap(layerBottomY - coinHeight),
      Math.max(1, snap(width)),
      Math.max(1, snap(coinHeight))
    );
  }
  context.restore();
};

const drawCapitalSideBase = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: NormalizedCapitalSide,
  sprites: BattleCapitalCanvasSprites
) => {
  const geometry = buildColumnLayout(width, height, side.side);
  drawPedestalBack(context, geometry, sprites.pedestal);

  geometry.columns.forEach((column) => {
    drawCoinStack(
      context,
      sprites.coin,
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
  side: NormalizedCapitalSide,
  sprites: BattleCapitalCanvasSprites
) => {
  const geometry = buildColumnLayout(width, height, side.side);
  const active = new Set(side.frame.activeColumnIndices);
  geometry.columns.forEach((column) => {
    if (!active.has(column.index)) return;
    const before = side.frame.columnHeights[column.index] ?? 0;
    const after = side.frame.settledAfterColumnHeights[column.index] ?? before;
    const addedLayers = resolveBattleCapitalSfcIncomingLogicalLayers(
      before,
      after,
      MAX_BATTLE_CAPITAL_COLUMN_LAYERS
    );
    if (addedLayers <= 0) return;
    // Match the falling cylinder to the exact committed height delta. The
    // timeline's four-layer hint is the normal case, but large support actions
    // can add more than four layers to one anchor in a single authored wave.
    // Capping that case makes the settled tower jump upward on contact.
    const bundleLayers = addedLayers;
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
    drawCoinStack(
      context,
      sprites.coin,
      column.x,
      packetBaseY,
      geometry.coinWidth,
      geometry.coinHeight,
      geometry.layerStep,
      bundleLayers
    );
  });
};

const drawCapitalSidePedestalFront = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: NormalizedCapitalSide,
  sprites: BattleCapitalCanvasSprites
) => {
  const geometry = buildColumnLayout(width, height, side.side);
  drawPedestalFront(context, geometry, sprites.pedestal);
};

const getStaticSceneKey = (
  scene: BattleCapitalCanvasScene,
  sprites: BattleCapitalCanvasSprites | null
) =>
  JSON.stringify({
    ownershipPercent: scene.ownershipPercent,
    pressureDirection: scene.pressureDirection,
    windSide: scene.windSide,
    difficulty: scene.difficulty,
    compact: scene.compact,
    spriteSet: sprites ? 'sfc-pedestal-v3-wide-bundled' : 'pending',
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
    sprites = null,
    cssSize = null,
  }: Pick<BattleCapitalCanvasProps, 'devicePixelRatio' | 'frameRate'> & {
    backgroundImage?: HTMLImageElement | null;
    sprites?: BattleCapitalCanvasSprites | null;
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
  const staticKey = getStaticSceneKey(scene, sprites);
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
    if (sprites) {
      drawCapitalSideBase(cacheContext, width, height, scene.player, sprites);
      drawCapitalSideBase(cacheContext, width, height, scene.enemy, sprites);
    }
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
  if (sprites) {
    drawCapitalSideIncoming(context, width, height, scene.player, sprites);
    drawCapitalSideIncoming(context, width, height, scene.enemy, sprites);
    drawCapitalSidePedestalFront(context, width, height, scene.player, sprites);
    drawCapitalSidePedestalFront(context, width, height, scene.enemy, sprites);
  }

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
  const spritesRef = useRef<BattleCapitalCanvasSprites | null>(null);
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
      sprites: spritesRef.current,
      cssSize: canvasSizeRef.current,
    });
  }, [devicePixelRatio, frameRate]);

  useEffect(() => {
    let disposed = false;
    const coin = new Image();
    const pedestal = new Image();
    coin.decoding = 'async';
    pedestal.decoding = 'async';
    const finish = () => {
      if (disposed || !coin.complete || !pedestal.complete) return;
      if (coin.naturalWidth <= 0 || pedestal.naturalWidth <= 0) return;
      spritesRef.current = { coin, pedestal };
      if (canvasRef.current) staticCanvasCache.delete(canvasRef.current);
      repaint(sceneRef.current);
    };
    coin.addEventListener('load', finish);
    pedestal.addEventListener('load', finish);
    coin.src = capitalCoinSpriteUrl;
    pedestal.src = capitalPedestalSpriteUrl;
    finish();
    return () => {
      disposed = true;
      coin.removeEventListener('load', finish);
      pedestal.removeEventListener('load', finish);
    };
  }, [repaint]);

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
