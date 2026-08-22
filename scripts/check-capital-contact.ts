import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  BATTLE_CAPITAL_COLUMN_COUNT,
  CAPITAL_COIN_WAVE_MS,
  CAPITAL_COIN_WAVES_PER_PAGE,
  MAX_BATTLE_CAPITAL_COLUMN_LAYERS,
  getCapitalColumnHeights,
} from '../src/utils/battlePresentation';
import { resolveBattleCanvasDpr } from '../src/utils/battleCanvasQuality';
import {
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS,
  BATTLE_CAPITAL_SFC_COIN_SPRITE_CROP,
  BATTLE_CAPITAL_SFC_COLUMN_PITCH_IN_COIN_WIDTHS,
  BATTLE_CAPITAL_SFC_MINIMUM_RENDERED_COIN_LAYERS,
  BATTLE_CAPITAL_SFC_PACKET_POSITION_STEPS,
  BATTLE_CAPITAL_SFC_PEDESTAL_TO_COIN_RATIO,
  BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT,
  BATTLE_CAPITAL_SFC_ROW_BASE_OFFSETS,
  resolveBattleCapitalSfcColumnX,
  resolveBattleCapitalSfcIncomingLogicalLayers,
  resolveBattleCapitalSfcPacketSteppedProgress,
  resolveBattleCapitalSfcRenderedCoinLayers,
  resolveBattleCapitalSfcRowBaseY,
  resolveBattleCapitalSfcSideGeometry,
  resolveBattleCapitalSfcStackTopY,
} from '../src/utils/battleCapitalCanvasLayout';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(
  readFileSync(
    resolve(root, 'docs/rs3-trade-regression-baseline.json'),
    'utf8'
  )
) as {
  geometry: {
    anchorCount: number;
    rowsBackToFront: number[];
    mirrorSides: boolean;
    visibleCoinSeparatorsMeasured: {
      min: number;
      max: number;
      classification: 'M';
    };
    implementationMinCoinsPerBundle: {
      value: number;
      classification: 'I';
    };
    visibleCoinSprite: {
      alphaThreshold: number;
      crop: { x: number; y: number; width: number; height: number };
      aspectRatio: number;
      classification: 'M';
    };
    minimumBundleHeightInBundleWidths: {
      sourceMeasured: {
        min: number;
        target: number;
        max: number;
        classification: 'M';
      };
      implementation: {
        min: number;
        target: number;
        max: number;
        classification: 'I';
      };
    };
    columnPitchInBundleWidths: {
      sourceMeasured: {
        min: number;
        target: number;
        max: number;
        classification: 'M';
      };
      implementation: { target: number; classification: 'I' };
    };
    rowBaseOffsetsInPedestalHeights: {
      implementation: number[];
      classification: 'I';
    };
    pedestalWidthInBundleWidths: {
      implementation: {
        min: number;
        target: number;
        max: number;
        classification: 'I';
      };
    };
  };
  timingPresets: {
    sfc: { pageSecondsMin: number; pageSecondsMax: number };
    implementation: {
      wavesPerPage: number;
      waveMilliseconds: number;
      pageMilliseconds: number;
      classification: 'I';
    };
  };
  contact: { backgroundGapMaxDevicePixels: number };
  responsiveViewports: { requiredDprSnapshots: number[] };
};

assert.equal(BATTLE_CAPITAL_COLUMN_COUNT, baseline.geometry.anchorCount);
assert.deepEqual(
  [...BATTLE_CAPITAL_CANVAS_ROW_COUNTS],
  baseline.geometry.rowsBackToFront
);
assert.equal(
  BATTLE_CAPITAL_SFC_ROW_BASE_OFFSETS.length,
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS.length
);
assert.deepEqual(
  [...BATTLE_CAPITAL_SFC_ROW_BASE_OFFSETS],
  baseline.geometry.rowBaseOffsetsInPedestalHeights.implementation
);
assert.equal(
  BATTLE_CAPITAL_SFC_COLUMN_PITCH_IN_COIN_WIDTHS,
  baseline.geometry.columnPitchInBundleWidths.implementation.target
);
assert.equal(
  BATTLE_CAPITAL_SFC_PEDESTAL_TO_COIN_RATIO,
  baseline.geometry.pedestalWidthInBundleWidths.implementation.target
);
assert.deepEqual(
  BATTLE_CAPITAL_SFC_COIN_SPRITE_CROP,
  baseline.geometry.visibleCoinSprite.crop
);

const oneUnit = getCapitalColumnHeights(1);
assert.equal(oneUnit.reduce((sum, value) => sum + value, 0), 1);
assert.ok(
  oneUnit[15] === 1 || oneUnit[16] === 1,
  'the first bundle must rest at one of the two front-centre anchors'
);
assert.deepEqual(
  getCapitalColumnHeights(BATTLE_CAPITAL_COLUMN_COUNT),
  Array(BATTLE_CAPITAL_COLUMN_COUNT).fill(1),
  'the first complete pass must touch all eighteen anchors exactly once'
);
assert.ok(
  BATTLE_CAPITAL_SFC_MINIMUM_RENDERED_COIN_LAYERS >=
    baseline.geometry.implementationMinCoinsPerBundle.value
);
assert.equal(
  resolveBattleCapitalSfcRenderedCoinLayers(1),
  BATTLE_CAPITAL_SFC_MINIMUM_RENDERED_COIN_LAYERS
);
assert.equal(resolveBattleCapitalSfcRenderedCoinLayers(0), 0);

const rowStarts: number[] = [];
let nextRowStart = 0;
for (const count of BATTLE_CAPITAL_CANVAS_ROW_COUNTS) {
  rowStarts.push(nextRowStart);
  nextRowStart += count;
}
const anchorLocations = BATTLE_CAPITAL_CANVAS_ROW_COUNTS.flatMap(
  (count, depth) =>
    Array.from({ length: count }, (_, column) => ({
      index: rowStarts[depth] + column,
      depth,
      x: resolveBattleCapitalSfcColumnX({
        centerX: 0,
        pitch: 1,
        count,
        column,
        mirrored: false,
      }),
    }))
);

let previousHeights = Array(BATTLE_CAPITAL_COLUMN_COUNT).fill(0);
for (let units = 1; units <= BATTLE_CAPITAL_COLUMN_COUNT; units += 1) {
  const heights = getCapitalColumnHeights(units);
  assert.equal(
    heights.reduce((sum, value) => sum + value, 0),
    units,
    `${units} units must be conserved across the fixed anchors`
  );
  const changed = heights.flatMap((height, index) =>
    height !== previousHeights[index] ? [index] : []
  );
  assert.equal(changed.length, 1, `${units}: exactly one anchor must advance`);
  assert.equal(
    heights[changed[0]] - previousHeights[changed[0]],
    1,
    `${units}: the advancing anchor must gain exactly one logical layer`
  );
  assert.ok(
    heights.every((height, index) => height >= previousHeights[index]),
    `${units}: an existing anchor must never shrink`
  );

  const occupied = anchorLocations.filter(({ index }) => heights[index] > 0);
  for (const anchor of occupied.filter(({ depth }) => depth < 3)) {
    assert.ok(
      occupied.some(
        (candidate) =>
          candidate.depth > anchor.depth &&
          Math.abs(candidate.x - anchor.x) <= 0.51
      ),
      `${units}: rear anchor ${anchor.index} must have a nearer visual support`
    );
  }
  previousHeights = heights;
}

let previousRenderedLayers = 0;
for (let logicalLayers = 1; logicalLayers <= 18; logicalLayers += 1) {
  const renderedLayers = resolveBattleCapitalSfcRenderedCoinLayers(logicalLayers);
  assert.ok(
    renderedLayers >= baseline.geometry.implementationMinCoinsPerBundle.value,
    `${logicalLayers}: every positive logical stack must remain a visible bundle`
  );
  assert.ok(
    renderedLayers > previousRenderedLayers,
    `${logicalLayers}: rendered stack height must be strictly monotonic`
  );
  previousRenderedLayers = renderedLayers;
}

for (const before of [0, 1, 4, 9, 100]) {
  for (const added of [1, 4, 5, 11, 33]) {
    const after = before + added;
    const incoming = resolveBattleCapitalSfcIncomingLogicalLayers(
      before,
      after,
      MAX_BATTLE_CAPITAL_COLUMN_LAYERS
    );
    assert.equal(incoming, added);
    const baseY = 240;
    const coinHeight = 12;
    const layerStep = 3;
    const incomingTop = resolveBattleCapitalSfcStackTopY({
      baseY: baseY - before * layerStep,
      coinHeight,
      layerStep,
      logicalLayers: incoming,
    });
    const settledTop = resolveBattleCapitalSfcStackTopY({
      baseY,
      coinHeight,
      layerStep,
      logicalLayers: after,
    });
    assert.equal(
      incomingTop,
      settledTop,
      `${before}+${added}: landed incoming top must equal settled top`
    );
  }
}

assert.equal(BATTLE_CAPITAL_SFC_PACKET_POSITION_STEPS, 3);
for (const columnIndex of [0, 1, 2]) {
  const sampled = Array.from({ length: 6 }, (_, frame) =>
    resolveBattleCapitalSfcPacketSteppedProgress({
      rawProgress: Math.min(1, frame * (1_000 / 30) / 165),
      columnIndex,
      packetSeed: 0,
    })
  );
  const positions = new Set(sampled);
  for (const expected of [0, 1 / 3, 2 / 3, 1]) {
    assert.ok(
      positions.has(expected),
      `lane ${columnIndex}: ${expected} must be exposed at 30fps`
    );
  }
}

for (const [width, height] of [
  [390, 320],
  [844, 220],
  [1280, 280],
] as const) {
  const player = resolveBattleCapitalSfcSideGeometry(width, height, 'player');
  const enemy = resolveBattleCapitalSfcSideGeometry(width, height, 'enemy');
  assert.ok(Math.abs(player.centerX + enemy.centerX - width) <= 1);
  assert.ok(player.pedestalTopY >= 0);
  assert.ok(player.pedestalBottomY <= height);
  const pedestalToBundle = player.pedestalWidth / player.coinWidth;
  const implementationPedestal =
    baseline.geometry.pedestalWidthInBundleWidths.implementation;
  assert.ok(
    pedestalToBundle >= implementationPedestal.min &&
      pedestalToBundle <= implementationPedestal.max,
    `${width}x${height}: pedestal ratio ${pedestalToBundle}`
  );
  const minimumBundleHeight =
    player.coinHeight +
    (BATTLE_CAPITAL_SFC_MINIMUM_RENDERED_COIN_LAYERS - 1) *
      player.layerStep;
  const minimumBundleRatio = minimumBundleHeight / player.coinWidth;
  const implementationBundle =
    baseline.geometry.minimumBundleHeightInBundleWidths.implementation;
  assert.ok(
    minimumBundleRatio >= implementationBundle.min &&
      minimumBundleRatio <= implementationBundle.max,
    `${width}x${height}: minimum bundle height ratio ${minimumBundleRatio}`
  );
  const frontBase = resolveBattleCapitalSfcRowBaseY(
    player.pedestalTopY,
    player.pedestalHeight,
    BATTLE_CAPITAL_SFC_ROW_BASE_OFFSETS.length - 1
  );
  const frontWallTop = player.pedestalTopY +
    player.pedestalHeight * BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT;
  assert.ok(frontBase >= frontWallTop);
  assert.ok(
    frontBase - frontWallTop <= player.coinHeight * 0.5,
    `${width}x${height}: the front bundle root must stay behind the wall`
  );

  for (const [depth, count] of BATTLE_CAPITAL_CANVAS_ROW_COUNTS.entries()) {
    for (let column = 0; column < count; column += 1) {
      const playerX = resolveBattleCapitalSfcColumnX({
        centerX: player.centerX,
        pitch:
          player.coinWidth * BATTLE_CAPITAL_SFC_COLUMN_PITCH_IN_COIN_WIDTHS,
        count,
        column,
        mirrored: false,
      });
      const enemyX = resolveBattleCapitalSfcColumnX({
        centerX: enemy.centerX,
        pitch:
          enemy.coinWidth * BATTLE_CAPITAL_SFC_COLUMN_PITCH_IN_COIN_WIDTHS,
        count,
        column,
        mirrored: true,
      });
      assert.ok(
        Math.abs(playerX + enemyX - width) <= 1,
        `${width}x${height}: row ${depth} column ${column} must mirror`
      );
    }
  }
}

for (const [width, height] of [
  [378.6, 365.6],
  [824.8, 159],
  [1190.4, 276],
] as const) {
  const geometry = resolveBattleCapitalSfcSideGeometry(width, height, 'player');
  const frontBase = resolveBattleCapitalSfcRowBaseY(
    geometry.pedestalTopY,
    geometry.pedestalHeight,
    BATTLE_CAPITAL_SFC_ROW_BASE_OFFSETS.length - 1
  );
  const frontWallTop = geometry.pedestalTopY +
    geometry.pedestalHeight * BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT;
  for (const requestedDpr of baseline.responsiveViewports.requiredDprSnapshots) {
    const frameRate = requestedDpr > 1.5 ? 60 : 30;
    const resolvedDpr = resolveBattleCanvasDpr({ requestedDpr, frameRate });
    const backingScaleY = Math.round(height * resolvedDpr) / height;
    const coinBottomLogical =
      Math.round(frontBase - geometry.coinHeight) +
      Math.round(geometry.coinHeight);
    const baseDeviceY = Math.round(coinBottomLogical * backingScaleY);
    const wallDeviceY = Math.round(Math.round(frontWallTop) * backingScaleY);
    const backgroundGap = Math.max(0, wallDeviceY - baseDeviceY);
    const visibleOverlap = Math.max(0, baseDeviceY - wallDeviceY);
    assert.ok(
      backgroundGap <= baseline.contact.backgroundGapMaxDevicePixels,
      `${width}x${height} DPR ${requestedDpr}: contact gap ${backgroundGap}px`
    );
    assert.ok(
      visibleOverlap >= 1,
      `${width}x${height} DPR ${requestedDpr}: front wall must visibly cover the bundle root`
    );
    assert.ok(
      visibleOverlap <= Math.ceil(geometry.coinHeight * backingScaleY * 0.62),
      `${width}x${height} DPR ${requestedDpr}: front wall hides too much of the bundle`
    );
  }
}

const sfcPageSeconds =
  CAPITAL_COIN_WAVE_MS * CAPITAL_COIN_WAVES_PER_PAGE / 1_000;
assert.equal(
  CAPITAL_COIN_WAVES_PER_PAGE,
  baseline.timingPresets.implementation.wavesPerPage
);
assert.equal(
  CAPITAL_COIN_WAVE_MS,
  baseline.timingPresets.implementation.waveMilliseconds
);
assert.equal(
  CAPITAL_COIN_WAVE_MS * CAPITAL_COIN_WAVES_PER_PAGE,
  baseline.timingPresets.implementation.pageMilliseconds
);
assert.ok(
  sfcPageSeconds >= baseline.timingPresets.sfc.pageSecondsMin &&
    sfcPageSeconds <= baseline.timingPresets.sfc.pageSecondsMax,
  `SFC page duration ${sfcPageSeconds}s is outside the measured range`
);

const inspectPng = (relativePath: string) => {
  const path = resolve(root, relativePath);
  const bytes = readFileSync(path);
  assert.ok(statSync(path).size > 100_000, `${relativePath} is a placeholder`);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${relativePath} must remain a PNG`
  );
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes[25], 6, `${relativePath} must retain RGBA alpha`);
  const png = PNG.sync.read(bytes);
  const alphaBounds = (threshold: number) => {
    let minX = png.width;
    let minY = png.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        const alpha = png.data[(y * png.width + x) * 4 + 3];
        if (alpha < threshold) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    assert.ok(maxX >= minX && maxY >= minY, `${relativePath} has no alpha`);
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  };
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    alpha128: alphaBounds(128),
  };
};

assert.deepEqual(inspectPng('src/assets/battle/capital-coin-sfc.png'), {
  width: 2106,
  height: 747,
  alpha128: baseline.geometry.visibleCoinSprite.crop,
});
assert.deepEqual(inspectPng('src/assets/battle/capital-pedestal-sfc.png'), {
  width: 2172,
  height: 724,
  alpha128: { x: 362, y: 78, width: 1444, height: 579 },
});

const renderer = readFileSync(
  resolve(root, 'src/components/BattleCapitalCanvas.tsx'),
  'utf8'
);
assert.doesNotMatch(renderer, /drawTrayBack|drawTrayFront|radial dinner plate/);
assert.match(renderer, /drawPedestalBack[\s\S]*drawPedestalFront/);
assert.match(renderer, /resolveBattleCapitalSfcRenderedCoinLayers\(layers\)/);
assert.match(
  renderer,
  /resolveBattleCapitalSfcIncomingLogicalLayers\([\s\S]{0,1200}const bundleLayers = addedLayers;/
);
assert.match(
  renderer,
  /if \(active\.has\(column\.index\)\) return;[\s\S]{0,1800}if \(rawProgress >= 1\) \{[\s\S]{0,500}after/
);
assert.match(renderer, /mirrored: side === 'enemy'/);
assert.match(renderer, /capital-coin-sfc\.png/);
assert.match(renderer, /capital-pedestal-sfc\.png/);
assert.match(renderer, /PEDESTAL_SPRITE_CENTER_TILE_COUNT = 12/);
assert.match(renderer, /drawWidePedestalSlice/);

const fixture = readFileSync(resolve(root, 'capital-contact-audit.html'), 'utf8');
const fixtureScript = readFileSync(
  resolve(root, 'src/capitalContactAudit.ts'),
  'utf8'
);
assert.match(fixture, /capitalContactAudit\.ts/);
assert.match(fixtureScript, /前中央から積み、台の前壁が根元を隠す/);
assert.match(fixtureScript, /MAX_BATTLE_CAPITAL_VISIBLE_UNITS/);
assert.match(fixtureScript, /1束（最低8枚表示）/);
assert.match(fixtureScript, /mirror=1/);
assert.match(fixtureScript, /devicePixelRatio: auditDpr/);

console.log(
  `Capital contact checks passed: 18 anchors, ${BATTLE_CAPITAL_SFC_MINIMUM_RENDERED_COIN_LAYERS}-coin minimum bundle, ${sfcPageSeconds.toFixed(3)}s SFC page.`
);
