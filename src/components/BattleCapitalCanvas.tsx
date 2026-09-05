import {
  useCallback,
  useEffect,
  useMemo,
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
import { CapitalBitmapCache } from '../utils/capitalBitmapCache';
import { drawCachedCapitalStack, type CapitalStackPaintResources } from '../utils/capitalCachedStack';
import { resolveCapitalViewportScroll } from '../utils/capitalViewportScroll';
import { resolveCapitalRollProgress, resolveCapitalRollStep } from '../utils/capitalRollMotion';
import { createBattleVisualTheme, getBattleVisualThemeCacheKey, validateBattleVisualTheme, type BattleVisualTheme } from '../data/battleVisualTheme';
import {
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS,
  BATTLE_CAPITAL_SFC_COLUMN_PITCH_IN_COIN_WIDTHS,
  BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT,
  resolveBattleCapitalSfcColumnX,
  resolveBattleCapitalSfcIncomingLogicalLayers,
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
  theme?: BattleVisualTheme;
}

interface NormalizedCapitalFrame {
  visibleUnits: number;
  columnHeights: number[];
  settledAfterColumnHeights: number[];
  incomingLaneTimings?: MechanicalCapitalColumnFrame['incomingLaneTimings'];
  viewportBeforeColumnHeights?: number[];
  viewportAfterColumnHeights?: number[];
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
  bitmapCacheBytes: number;
  bitmapCacheLimitBytes: number;
  bitmapCacheEntries: number;
  bitmapBuilds: number;
  bitmapHits: number;
  playerScrollPx: number;
  enemyScrollPx: number;
  compositions: number;
  skippedPaints: number;
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
  paintKey?: string;
  compositions: number;
  skippedPaints: number;
}

export interface BattleCapitalCanvasSprites {
  coin: HTMLImageElement;
  pedestal: HTMLImageElement;
  theme?: BattleVisualTheme;
}

const staticCanvasCache = new WeakMap<HTMLCanvasElement, StaticCanvasCacheEntry>();
const layoutCache = new WeakMap<HTMLCanvasElement, {
  key:string; player:ReturnType<typeof buildColumnLayout>; enemy:ReturnType<typeof buildColumnLayout>;
}>();
const themeKeyCache = new WeakMap<BattleVisualTheme,string>();
const themeCacheKey = (theme:BattleVisualTheme) => {
  let key=themeKeyCache.get(theme);
  if (!key) {key=getBattleVisualThemeCacheKey(theme);themeKeyCache.set(theme,key);}
  return key;
};
const bitmapCaches = new WeakMap<HTMLCanvasElement, {
  key: string;
  coin: HTMLImageElement;
  pedestal: HTMLImageElement;
  resources: CapitalStackPaintResources;
}>();
export const DEFAULT_BATTLE_VISUAL_THEME = createBattleVisualTheme({
  coin: capitalCoinSpriteUrl, pedestal: capitalPedestalSpriteUrl,
});

const ROW_COUNTS = BATTLE_CAPITAL_CANVAS_ROW_COUNTS;
const themeSlices = new WeakMap<BattleVisualTheme, Array<{x:number;width:number}>>();
const getPedestalSlices = (theme: BattleVisualTheme) => {
  let slices = themeSlices.get(theme);
  if (!slices) {
    const {crop,centerTileWidth,centerTileCount} = theme.pedestal;
    const cap=(crop.width-centerTileWidth)/2;
    slices=[{x:crop.x,width:cap},
      ...Array.from({length:centerTileCount},()=>({x:crop.x+cap,width:centerTileWidth})),
      {x:crop.x+cap+centerTileWidth,width:cap}];
    themeSlices.set(theme,slices);
  }
  return slices;
};
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
      incomingLaneTimings:preview?.incomingLaneTimings,
      viewportBeforeColumnHeights:preview?.viewportBeforeColumnHeights,
      viewportAfterColumnHeights:preview?.viewportAfterColumnHeights,
      // Legacy page counts stay neutral. Viewport scrolling is projected from
      // these continuous column heights, not from game-state banking counters.
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

export const getCapitalPacketAnimationKey = (side: NormalizedCapitalSide) =>
  side.frame.activeColumnIndices.length > 0
    ? `${side.frame.presentationSerial}:${side.frame.packetSeed}:${side.frame.incomingBundleLayers ?? 0}:${side.frame.activeColumnIndices.join(',')}`
    : '';

/** All repaint triggers share this clock, including image load and resize. */
export const projectCapitalSceneAtTime = (
  scene: BattleCapitalCanvasScene,
  clocks: Record<BattleCapitalCanvasSide, CapitalPacketClock>,
  now: number,
  reducedMotion: boolean
): BattleCapitalCanvasScene => {
  const projectSide = (side: NormalizedCapitalSide): NormalizedCapitalSide => {
    const clock=clocks[side.side];
    const elapsed=clock.key === getCapitalPacketAnimationKey(side) ? now-clock.startedAt : 0;
    return {...side,frame:{...side.frame,
      incomingLaneTimings:reducedMotion ? undefined : side.frame.incomingLaneTimings,
      packetProgress:side.frame.activeColumnIndices.length === 0 || reducedMotion
        ? 1 : clamp(elapsed/side.frame.beatDurationMs,0,1),
    }};
  };
  return {...scene,player:projectSide(scene.player),enemy:projectSide(scene.enemy)};
};

const drawPixelArrowBands = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: BattleCapitalCanvasScene,
  theme: BattleVisualTheme
) => {
  context.globalCompositeOperation = 'copy';
  context.fillStyle = theme.palette.background;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';

  const boundary = clamp(width * scene.ownershipPercent / 100, 0, width);
  const chevronWidth = Math.max(22, snap(width / 10));
  context.globalAlpha = 0.62;
  for (let x = -chevronWidth; x < width + chevronWidth; x += chevronWidth) {
    const stripe = Math.floor((x + chevronWidth) / chevronWidth);
    context.fillStyle = stripe % 2 === 0 ? theme.palette.stripeA : theme.palette.stripeB;
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
    context.fillStyle = playerLane ? theme.palette.player : theme.palette.enemy;
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
    context.fillStyle = theme.palette.edge;
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
    const pitch =
      geometry.coinWidth * BATTLE_CAPITAL_SFC_COLUMN_PITCH_IN_COIN_WIDTHS;
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
  destinationHeight: number,
  theme: BattleVisualTheme
) => {
  const scale = geometry.pedestalHeight / theme.pedestal.crop.height;
  const destinationLeft = geometry.centerX - geometry.pedestalWidth / 2;
  let sourceOffset = 0;

  getPedestalSlices(theme).forEach((slice) => {
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
  pedestal: HTMLImageElement,
  theme: BattleVisualTheme
) => {
  drawWidePedestalSlice(
    context,
    pedestal,
    geometry,
    theme.pedestal.crop.y,
    theme.pedestal.crop.height,
    geometry.pedestalTopY,
    geometry.pedestalHeight,
    theme
  );
};

const drawPedestalFront = (
  context: CanvasRenderingContext2D,
  geometry: ReturnType<typeof buildColumnLayout>,
  pedestal: HTMLImageElement,
  theme: BattleVisualTheme
) => {
  const sourceY = theme.pedestal.crop.y +
    theme.pedestal.crop.height * BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT;
  const sourceHeight = theme.pedestal.crop.height *
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
    destinationHeight,
    theme
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
  resources: CapitalStackPaintResources
) => {
  drawCachedCapitalStack(context,coin,resources,x,baseY,width,coinHeight,layerStep,layers);
};

const drawCapitalSideBase = (
  context: CanvasRenderingContext2D,
  side: NormalizedCapitalSide,
  sprites: BattleCapitalCanvasSprites,
  geometry: ReturnType<typeof buildColumnLayout>,
  resources: CapitalStackPaintResources
) => {
  const active = new Set(side.frame.activeColumnIndices);
  drawPedestalBack(context, geometry, sprites.pedestal, sprites.theme ?? DEFAULT_BATTLE_VISUAL_THEME);
  // During motion, paint every column in one rear-to-front pass below.
  if (active.size > 0) return;

  geometry.columns.forEach((column) => {
    // Active columns are painted dynamically. This lets the exact committed
    // `after` stack replace before+incoming at contact, avoiding doubled alpha
    // seams in the final animation frame.
    if (active.has(column.index)) return;
    drawCoinStack(
      context,
      sprites.coin,
      column.x,
      column.baseY,
      geometry.coinWidth,
      geometry.coinHeight,
      geometry.layerStep,
      side.frame.columnHeights[column.index] ?? 0,
      resources
    );
  });
};

const drawCapitalSideIncoming = (
  context: CanvasRenderingContext2D,
  height: number,
  side: NormalizedCapitalSide,
  sprites: BattleCapitalCanvasSprites,
  geometry: ReturnType<typeof buildColumnLayout>,
  resources: CapitalStackPaintResources,
  scrollOffset: number
) => {
  const active = new Set(side.frame.activeColumnIndices);
  geometry.columns.forEach((column) => {
    if (!active.has(column.index)) {
      if (active.size > 0) drawCoinStack(context,sprites.coin,column.x,column.baseY,
        geometry.coinWidth,geometry.coinHeight,geometry.layerStep,
        side.frame.columnHeights[column.index] ?? 0,resources);
      return;
    }
    const before = side.frame.columnHeights[column.index] ?? 0;
    const after = side.frame.settledAfterColumnHeights[column.index] ?? before;
    const addedLayers = resolveBattleCapitalSfcIncomingLogicalLayers(
      before,
      after,
      MAX_BATTLE_CAPITAL_COLUMN_LAYERS
    );
    if (addedLayers <= 0) return;
    const rawProgress = resolveCapitalRollProgress(side.frame,column.index);
    if (rawProgress >= 1) {
      drawCoinStack(
        context,
        sprites.coin,
        column.x,
        column.baseY,
        geometry.coinWidth,
        geometry.coinHeight,
        geometry.layerStep,
        after,
        resources
      );
      return;
    }
    drawCoinStack(
      context,
      sprites.coin,
      column.x,
      column.baseY,
      geometry.coinWidth,
      geometry.coinHeight,
      geometry.layerStep,
      before,
      resources
    );
    // Match the falling cylinder to the exact committed height delta. The
    // timeline's four-layer hint is the normal case, but large support actions
    // can add more than four layers to one anchor in a single authored wave.
    // Capping that case makes the settled tower jump upward on contact.
    const bundleLayers = addedLayers;
    if (rawProgress <= 0) return;
    const landingBaseY = column.baseY - before * geometry.layerStep;
    const startBaseY = Math.min(
      -geometry.coinHeight - scrollOffset,
      landingBaseY - height * 0.22 - bundleLayers * geometry.layerStep
    );
    // The SFC animation exposes three coarse positions at 30fps rather than a
    // smooth physics arc. Keep the final sample exact so rolls merge cleanly.
    const steppedProgress = resolveCapitalRollStep(rawProgress,column.index,
      side.frame.packetSeed,Boolean(side.frame.incomingLaneTimings));
    const packetBaseY =
      startBaseY + (landingBaseY - startBaseY) * steppedProgress;
    drawCoinStack(
      context,
      sprites.coin,
      column.x,
      snap(packetBaseY),
      geometry.coinWidth,
      geometry.coinHeight,
      geometry.layerStep,
      bundleLayers,
      resources
    );
  });
};

const drawCapitalSidePedestalFront = (
  context: CanvasRenderingContext2D,
  sprites: BattleCapitalCanvasSprites,
  geometry: ReturnType<typeof buildColumnLayout>
) => {
  drawPedestalFront(context, geometry, sprites.pedestal, sprites.theme ?? DEFAULT_BATTLE_VISUAL_THEME);
};

const getStaticSceneKey = (
  scene: BattleCapitalCanvasScene,
  sprites: BattleCapitalCanvasSprites | null
) =>
  JSON.stringify({
    spriteSet: sprites ? themeCacheKey(sprites.theme ?? DEFAULT_BATTLE_VISUAL_THEME) : 'pending',
    player: scene.player.frame.columnHeights,
    enemy: scene.enemy.frame.columnHeights,
    playerAfter:scene.player.frame.settledAfterColumnHeights,
    enemyAfter:scene.enemy.frame.settledAfterColumnHeights,
    playerActive: scene.player.frame.activeColumnIndices,
    enemyActive: scene.enemy.frame.activeColumnIndices,
    steps: [scene.player,scene.enemy].map(side=>side.frame.activeColumnIndices.map(column=>{
      const p=resolveCapitalRollProgress(side.frame,column);
      return p<=0?-1:p>=1?4:resolveCapitalRollStep(p,column,side.frame.packetSeed,Boolean(side.frame.incomingLaneTimings));
    })),
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
  const theme = sprites?.theme ?? DEFAULT_BATTLE_VISUAL_THEME;
  const resourceKey = `${frameRate}:${backingWidth}:${backingHeight}:${width}:${height}:${themeCacheKey(theme)}`;
  let bitmapEntry = bitmapCaches.get(canvas);
  if (sprites && (!bitmapEntry || bitmapEntry.key !== resourceKey ||
      bitmapEntry.coin !== sprites.coin || bitmapEntry.pedestal !== sprites.pedestal)) {
    const validation = validateBattleVisualTheme(theme, {
      coin: {width:sprites.coin.naturalWidth,height:sprites.coin.naturalHeight},
      pedestal: {width:sprites.pedestal.naturalWidth,height:sprites.pedestal.naturalHeight},
    });
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    bitmapEntry?.resources.cache.clear();
    staticCanvasCache.delete(canvas);
    bitmapEntry = {key:resourceKey,coin:sprites.coin,pedestal:sprites.pedestal,resources:{
      cache:new CapitalBitmapCache((frameRate === 30 ? 16 : 32)*1024*1024),
      scaleX:backingWidth/width,scaleY:backingHeight/height,crop:theme.coin.crop,
    }};
    bitmapCaches.set(canvas,bitmapEntry);
  }
  const resources=bitmapEntry?.resources;
  const layoutKey=`${width}:${height}`;
  let layout=layoutCache.get(canvas);
  if (!layout || layout.key!==layoutKey) {
    layout={key:layoutKey,player:buildColumnLayout(width,height,'player'),enemy:buildColumnLayout(width,height,'enemy')};
    layoutCache.set(canvas,layout);
  }
  const playerGeometry = sprites ? layout.player : null;
  const enemyGeometry = sprites ? layout.enemy : null;
  const scrollFor = (side:NormalizedCapitalSide,g:ReturnType<typeof buildColumnLayout>|null) =>
    g ? resolveCapitalViewportScroll({height,coinHeight:g.coinHeight,layerStep:g.layerStep,
      rowBases:g.columns.map(c=>c.baseY),before:side.frame.viewportBeforeColumnHeights ?? side.frame.columnHeights,
      after:side.frame.viewportAfterColumnHeights ?? side.frame.settledAfterColumnHeights,progress:side.frame.packetProgress}).offsetPx : 0;
  const playerScroll = Math.round(scrollFor(scene.player,playerGeometry)*(backingHeight/height))/(backingHeight/height);
  const enemyScroll = Math.round(scrollFor(scene.enemy,enemyGeometry)*(backingHeight/height))/(backingHeight/height);
  const paintSide = (target:CanvasRenderingContext2D, side:NormalizedCapitalSide,
    geometry:ReturnType<typeof buildColumnLayout>, offset:number) => {
    if (!resources || !sprites) return;
    target.save();
    // One rigid camera transform owns the pedestal, pillar roots and front mask.
    target.translate(0,offset);
    drawCapitalSideBase(target,side,sprites,geometry,resources);
    drawCapitalSideIncoming(target,height,side,sprites,geometry,resources,offset);
    drawCapitalSidePedestalFront(target,sprites,geometry);
    target.restore();
  };
  const staticKey = `${getStaticSceneKey(scene, sprites)}:${playerScroll}:${enemyScroll}`;
  let cached = staticCanvasCache.get(canvas);
  if (
    !cached ||
    cached.key !== staticKey ||
    cached.backingWidth !== backingWidth ||
    cached.backingHeight !== backingHeight
  ) {
    const cacheCanvas =
      cached?.canvas ?? canvas.ownerDocument.createElement('canvas');
    if (cacheCanvas.width !== backingWidth || cacheCanvas.height !== backingHeight) {
      cacheCanvas.width = backingWidth;
      cacheCanvas.height = backingHeight;
    }
    const cacheContext = cacheCanvas.getContext('2d', { alpha: true });
    if (!cacheContext) return null;
    cacheContext.setTransform(1, 0, 0, 1, 0, 0);
    cacheContext.clearRect(0, 0, backingWidth, backingHeight);
    cacheContext.setTransform(
      backingWidth / width,
      0,
      0,
      backingHeight / height,
      0,
      0
    );
    cacheContext.imageSmoothingEnabled = false;
    if (sprites && playerGeometry && enemyGeometry) {
      paintSide(cacheContext, scene.player, playerGeometry, playerScroll);
      paintSide(cacheContext, scene.enemy, enemyGeometry, enemyScroll);
    }
    cached = {
      canvas: cacheCanvas,
      key: staticKey,
      backingWidth,
      backingHeight,
      compositions:(cached?.compositions ?? 0)+1,
      skippedPaints:cached?.skippedPaints ?? 0,
    };
    staticCanvasCache.set(canvas, cached);
  }

  // Ownership moves independently from the coin presentation. Repaint its
  // inexpensive arrow bands directly, then composite the transparent settled
  // pile cache so a 10Hz gauge update cannot rebuild thousands of coin seams.
  const paintKey=`${staticKey}:${scene.ownershipPercent}`;
  if (cached?.paintKey === paintKey) {
    cached.skippedPaints++;
  } else {
    context.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0);
    context.imageSmoothingEnabled = false;
    drawPixelArrowBands(context, width, height, scene, theme);
    if (cached) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(cached.canvas, 0, 0);
      cached.paintKey=paintKey;
    }
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
    bitmapCacheBytes: resources?.cache.bytes ?? 0,
    bitmapCacheLimitBytes: resources?.cache.maxBytes ?? 0,
    bitmapCacheEntries: resources?.cache.size ?? 0,
    bitmapBuilds: resources?.cache.builds ?? 0,
    bitmapHits: resources?.cache.hits ?? 0,
    playerScrollPx:playerScroll,
    enemyScrollPx:enemyScroll,
    compositions:cached?.compositions ?? 0,
    skippedPaints:cached?.skippedPaints ?? 0,
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
  theme = DEFAULT_BATTLE_VISUAL_THEME,
}: BattleCapitalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSizeRef = useRef<BattleCapitalCanvasCssSize | null>(null);
  const spritesRef = useRef<BattleCapitalCanvasSprites | null>(null);
  const themeKey = useMemo(()=>getBattleVisualThemeCacheKey(theme),[theme]);
  const playerScene=useMemo(()=>normalizeSide('player',player),
    [player.amount,player.marketPrice,player.capitalRatio,player.impact,player.previewFrame]);
  const enemyScene=useMemo(()=>normalizeSide('enemy',enemy),
    [enemy.amount,enemy.marketPrice,enemy.capitalRatio,enemy.impact,enemy.previewFrame]);
  const scene=useMemo<BattleCapitalCanvasScene>(()=>({
    player:playerScene,enemy:enemyScene,ownershipPercent:clamp(ownershipPercent,0,100),
    pressureDirection,windSide,difficulty,compact,
  }),[playerScene,enemyScene,ownershipPercent,pressureDirection,windSide,difficulty,compact]);
  const sceneKey = useMemo(()=>getBattleCapitalCanvasSceneKey(scene),[scene]);
  const sceneRef = useRef(scene);
  const packetClockRef = useRef<Record<BattleCapitalCanvasSide, CapitalPacketClock>>({
    player: { key: '', startedAt: 0 },
    enemy: { key: '', startedAt: 0 },
  });
  sceneRef.current = scene;

  const projectCurrent = useCallback(() => projectCapitalSceneAtTime(
    sceneRef.current,packetClockRef.current,performance.now(),
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  ),[]);

  const repaint = useCallback((sceneToPaint: BattleCapitalCanvasScene) => {
    if (!canvasRef.current || document.hidden) return;
    paintBattleCapitalCanvas(canvasRef.current, sceneToPaint, {
      devicePixelRatio,
      frameRate,
      sprites: spritesRef.current,
      cssSize: canvasSizeRef.current,
    });
  }, [devicePixelRatio, frameRate]);
  const repaintRef=useRef(repaint);
  repaintRef.current=repaint;
  const wakeRendererRef=useRef<()=>void>(()=>{});

  useEffect(() => {
    let disposed = false;
    const coin = new Image();
    const pedestal = new Image();
    coin.decoding = 'async';
    pedestal.decoding = 'async';
    const finish = () => {
      if (disposed || !coin.complete || !pedestal.complete) return;
      if (coin.naturalWidth <= 0 || pedestal.naturalWidth <= 0) return;
      spritesRef.current = { coin, pedestal, theme };
      if (canvasRef.current) staticCanvasCache.delete(canvasRef.current);
      repaintRef.current(projectCurrent());
    };
    coin.addEventListener('load', finish);
    pedestal.addEventListener('load', finish);
    coin.src = theme.coin.url;
    pedestal.src = theme.pedestal.url;
    finish();
    return () => {
      disposed = true;
      coin.removeEventListener('load', finish);
      pedestal.removeEventListener('load', finish);
    };
  }, [themeKey,projectCurrent]);

  useEffect(() => {
    let animationFrame = 0;
    let disposed = false;
    let lastPaintAt = Number.NEGATIVE_INFINITY;
    const tick = (now: number) => {
      animationFrame = 0;
      if (disposed || document.hidden) return;
      const projected = projectCurrent();
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
    const resumeVisible = () => {
      if (!document.hidden && !disposed && !animationFrame) tick(performance.now());
    };
    wakeRendererRef.current=resumeVisible;
    document.addEventListener('visibilitychange',resumeVisible);
    const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    motionQuery?.addEventListener('change',resumeVisible);
    resumeVisible();
    return () => {
      disposed = true;
      wakeRendererRef.current=()=>{};
      document.removeEventListener('visibilitychange',resumeVisible);
      motionQuery?.removeEventListener('change',resumeVisible);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [repaint,projectCurrent,frameRate]);

  useEffect(()=>{
    const now=performance.now();
    for (const side of ['player','enemy'] as const) {
      const key=getCapitalPacketAnimationKey(sceneRef.current[side]);
      if(packetClockRef.current[side].key!==key)
        packetClockRef.current[side]={key,startedAt:now};
    }
    wakeRendererRef.current();
  },[sceneKey]);

  useEffect(() => {
    const canvas=canvasRef.current;
    return () => {
      if (!canvas) return;
      bitmapCaches.get(canvas)?.resources.cache.clear();
      bitmapCaches.delete(canvas);
      layoutCache.delete(canvas);
      const snapshot=staticCanvasCache.get(canvas);
      if (snapshot) {snapshot.canvas.width=1;snapshot.canvas.height=1;}
      staticCanvasCache.delete(canvas);
    };
  },[]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const bounds = canvas.getBoundingClientRect();
      canvasSizeRef.current = {
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height),
      };
      repaint(projectCurrent());
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [repaint,projectCurrent]);

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
