// Run with Node 24+: node scripts/check-battle-visual-theme.ts
// Or use the repository's existing tsx: npx --no-install tsx scripts/check-battle-visual-theme.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_BATTLE_VISUAL_THEME_METADATA,
  createBattleVisualTheme,
  getBattleVisualThemeCacheKey,
  validateBattleVisualTheme,
  type BattleVisualTheme,
  type BattleVisualThemeImageSizes,
  type BattleVisualThemePalette,
} from '../src/data/battleVisualTheme.ts';
import {
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS,
  BATTLE_CAPITAL_SFC_COIN_ASPECT,
  BATTLE_CAPITAL_SFC_COIN_SPRITE_CROP,
  BATTLE_CAPITAL_SFC_PEDESTAL_ASPECT,
  BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT,
  resolveBattleCapitalSfcSideGeometry,
} from '../src/utils/battleCapitalCanvasLayout.ts';

// Read existing PNG headers only; no PNG module imports, DOM, network or writes.
const imageUrl = (name: 'coin' | 'pedestal') =>
  new URL(`../src/assets/battle/capital-${name}-sfc.png`, import.meta.url);
const readImageSize = (url: URL) => {
  const bytes = readFileSync(url);
  assert.ok(bytes.length >= 33, 'PNG must include a complete IHDR chunk.');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(8), 13);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
const assetUrls = {
  coin: imageUrl('coin').href,
  pedestal: imageUrl('pedestal').href,
};
const imageSizes: BattleVisualThemeImageSizes = {
  coin: readImageSize(imageUrl('coin')),
  pedestal: readImageSize(imageUrl('pedestal')),
};
const theme = createBattleVisualTheme(assetUrls);
const expectValid = (candidate: BattleVisualTheme, sizes = imageSizes) => {
  assert.deepEqual(validateBattleVisualTheme(candidate, sizes), {
    valid: true, errors: [],
  });
};
let rejectedCases = 0;
const expectInvalid = (candidate: unknown, path: string, sizes = imageSizes) => {
  const result = validateBattleVisualTheme(candidate, sizes);
  assert.equal(result.valid, false, `${path}: invalid input passed validation.`);
  assert.ok(result.errors.some((error) => error.startsWith(path)),
    `${path}: missing actionable error: ${result.errors.join(' ')}`);
  rejectedCases += 1;
};

expectValid(theme);
assert.deepEqual(validateBattleVisualTheme(theme), { valid: true, errors: [] });
assert.deepEqual(imageSizes, {
  coin: { width: 2106, height: 747 }, pedestal: { width: 2172, height: 724 },
});
assert.deepEqual(theme.coin.crop, BATTLE_CAPITAL_SFC_COIN_SPRITE_CROP);
assert.deepEqual(theme.pedestal.crop, { x: 313, y: 59, width: 1668, height: 631 });
assert.equal(theme.pedestal.frontSplit, BATTLE_CAPITAL_SFC_PEDESTAL_FRONT_SPLIT);
assert.deepEqual(BATTLE_CAPITAL_CANVAS_ROW_COUNTS, [4, 5, 5, 4]);
assert.equal(BATTLE_CAPITAL_CANVAS_ROW_COUNTS.reduce((sum, n) => sum + n, 0), 18);
assert.deepEqual(theme.palette, {
  background: '#b6ad91', stripeA: '#91ad91', stripeB: '#c4a4a1',
  player: '#a91e2f', enemy: '#244f83', edge: '#f2e5b7', impact: '#f2e5b7',
});

const pedestal = theme.pedestal;
const capWidth = (pedestal.crop.width - pedestal.centerTileWidth) / 2;
const slices = [
  { x: pedestal.crop.x, width: capWidth },
  ...Array.from({ length: pedestal.centerTileCount }, () => ({
    x: pedestal.crop.x + capWidth, width: pedestal.centerTileWidth,
  })),
  { x: pedestal.crop.x + capWidth + pedestal.centerTileWidth, width: capWidth },
];
assert.equal(capWidth, 802);
assert.equal(pedestal.centerTileWidth, 64);
assert.equal(slices.length, 14);
for (const slice of slices) {
  assert.ok(Number.isInteger(slice.x) && Number.isInteger(slice.width));
  assert.ok(slice.x >= pedestal.crop.x);
  assert.ok(slice.x + slice.width <= pedestal.crop.x + pedestal.crop.width);
}
const assembledWidth = slices.reduce((sum, slice) => sum + slice.width, 0);
assert.equal(assembledWidth, 2372);
assert.equal(assembledWidth / pedestal.crop.height, BATTLE_CAPITAL_SFC_PEDESTAL_ASPECT);
assert.equal(theme.coin.crop.width / theme.coin.crop.height, BATTLE_CAPITAL_SFC_COIN_ASPECT);
for (const [width, height] of [[390, 300], [844, 159], [1280, 400]]) {
  for (const side of ['player', 'enemy'] as const) {
    const geometry = resolveBattleCapitalSfcSideGeometry(width, height, side);
    const scale = geometry.pedestalHeight / pedestal.crop.height;
    assert.ok(Math.abs(assembledWidth * scale - geometry.pedestalWidth) < 1e-9);
    assert.ok(Math.abs(geometry.coinWidth * theme.coin.crop.height /
      theme.coin.crop.width - geometry.coinHeight) < 1e-9);
  }
}

// Palette authored solely for this test; existing image rights stay unverified.
const originalPalette: BattleVisualThemePalette = {
  background: '#112731', stripeA: '#26434c', stripeB: '#413446',
  player: '#26d7af', enemy: '#fa754c', edge: '#d9f4ed', impact: '#fff3ce',
};
const originalMetadata = {
  ...DEFAULT_BATTLE_VISUAL_THEME_METADATA,
  id: 'original-copper-tide-test', version: 2, palette: originalPalette,
};
const original = createBattleVisualTheme(assetUrls, originalMetadata);
expectValid(original);
assert.deepEqual(original.palette, originalPalette);
assert.notStrictEqual(original.palette, originalPalette);
assert.equal(Object.isFrozen(originalPalette), false, 'Do not freeze caller-owned data.');
assert.deepEqual(original.coin, theme.coin);
assert.deepEqual(original.pedestal, theme.pedestal);
assert.equal(original.rights.commercialReady, false);
assert.equal(original.rights.reason, theme.rights.reason);
assert.notDeepEqual(original.palette, theme.palette);
const swapped = createBattleVisualTheme({
  coin: '/original/coin.png', pedestal: '/original/pedestal.png',
}, originalMetadata);
expectValid(swapped);
assert.equal(swapped.rights.commercialReady, false, 'New URLs do not prove licenses.');
expectInvalid({ ...original, rights: { commercialReady: true, reason: 'New palette' } }, 'rights.commercialReady');

for (const frozen of [theme, theme.coin, theme.coin.crop, theme.pedestal,
  theme.pedestal.crop, theme.palette, theme.rights, DEFAULT_BATTLE_VISUAL_THEME_METADATA]) {
  assert.ok(Object.isFrozen(frozen));
}
const beforeValidation = JSON.stringify(theme);
expectValid(theme);
assert.equal(JSON.stringify(theme), beforeValidation, 'Validation must not mutate input.');

const baseKey = getBattleVisualThemeCacheKey(theme);
assert.equal(getBattleVisualThemeCacheKey(createBattleVisualTheme(assetUrls)), baseKey);
assert.equal(getBattleVisualThemeCacheKey({
  ...theme,
  palette: {
    impact: theme.palette.impact, edge: theme.palette.edge,
    enemy: theme.palette.enemy, player: theme.palette.player,
    stripeB: theme.palette.stripeB, stripeA: theme.palette.stripeA,
    background: theme.palette.background,
  },
}), baseKey, 'Canonical keys must ignore object insertion order.');
const changedThemes: BattleVisualTheme[] = [
  original, swapped,
  { ...theme, id: 'another-pack' },
  { ...theme, version: 2 }, // Same URL, different image bytes/content revision.
  { ...theme, coin: { ...theme.coin, url: '/coin-revision-2.png' } },
  { ...theme, pedestal: { ...theme.pedestal, url: '/pedestal-revision-2.png' } },
  // Different source slicing with the same 2372/631 assembled geometry.
  { ...theme, pedestal: { ...pedestal, centerTileWidth: 352, centerTileCount: 3 } },
];
for (const name of ['coin', 'pedestal'] as const) {
  for (const key of ['x', 'y'] as const) {
    changedThemes.push({ ...theme, [name]: {
      ...theme[name], crop: { ...theme[name].crop, [key]: theme[name].crop[key] + 1 },
    } });
  }
}
for (const key of Object.keys(originalPalette) as (keyof BattleVisualThemePalette)[]) {
  changedThemes.push({ ...theme, palette: { ...theme.palette, [key]: originalPalette[key] } });
}
for (const changed of changedThemes) {
  expectValid(changed);
  assert.notEqual(getBattleVisualThemeCacheKey(changed), baseKey);
}
assert.equal(new Set(changedThemes.map(getBattleVisualThemeCacheKey)).size, changedThemes.length);

// Crop right/bottom may touch the image boundary exactly, but never exceed it.
expectValid(theme, {
  coin: {
    width: theme.coin.crop.x + theme.coin.crop.width,
    height: theme.coin.crop.y + theme.coin.crop.height,
  },
  pedestal: {
    width: pedestal.crop.x + pedestal.crop.width,
    height: pedestal.crop.y + pedestal.crop.height,
  },
});

// Scaled replacement artwork is allowed when all source aspects stay exact.
const scaled = createBattleVisualTheme(assetUrls, {
  ...originalMetadata,
  coin: { crop: { x: 0, y: 0, width: 3674, height: 794 } },
  pedestal: { ...pedestal,
    crop: { x: 0, y: 0, width: 3336, height: 1262 }, centerTileWidth: 128,
  },
});
expectValid(scaled, {
  coin: { width: 3674, height: 794 }, pedestal: { width: 3336, height: 1262 },
});
assert.notEqual(getBattleVisualThemeCacheKey(scaled), getBattleVisualThemeCacheKey(original));

for (const candidate of [null, undefined, [], 3, 'theme']) expectInvalid(candidate, 'theme');
for (const id of ['', ' ', 'valid\n', 'UpperCase', '-bad', 'bad..id', 'a/b', 'a:b', 'a'.repeat(129), 42]) {
  expectInvalid({ ...theme, id }, 'id');
}
for (const value of [NaN, Infinity, -Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
  expectInvalid({ ...theme, version: value }, 'version');
}
for (const name of ['coin', 'pedestal'] as const) {
  expectInvalid({ ...theme, [name]: null }, name);
  for (const url of ['', ' ', '\nimage.png', 'image.png ', null, 42]) {
    expectInvalid({ ...theme, [name]: { ...theme[name], url } }, `${name}.url`);
  }
  expectInvalid({ ...theme, [name]: { ...theme[name], crop: null } }, `${name}.crop`);
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const invalid = [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1'];
    if (key === 'width' || key === 'height') invalid.push(0);
    for (const value of invalid) {
      expectInvalid({ ...theme, [name]: { ...theme[name],
        crop: { ...theme[name].crop, [key]: value },
      } }, `${name}.crop`);
    }
  }
  for (const key of ['x', 'y'] as const) {
    expectInvalid({ ...theme, [name]: { ...theme[name],
      crop: { ...theme[name].crop, [key]: Number.MAX_SAFE_INTEGER },
    } }, `${name}.crop`);
  }
  for (const key of ['width', 'height'] as const) {
    expectInvalid(theme, `${name}.crop`, {
      ...imageSizes, [name]: { ...imageSizes[name], [key]: theme[name].crop[
        key === 'width' ? 'x' : 'y'
      ] + theme[name].crop[key] - 1 },
    });
    expectInvalid(theme, `${name}.imageSize`, {
      ...imageSizes, [name]: { ...imageSizes[name], [key]: NaN },
    });
  }
}
for (const [key, values] of [
  ['centerTileWidth', [0, -1, 0.5, 63, 1668, 1670, NaN, Infinity]],
  ['centerTileCount', [0, -1, 0.5, 11, NaN, Infinity, Number.MAX_SAFE_INTEGER]],
  ['frontSplit', [0, 1, -1, 0.5, NaN, Infinity]],
] as const) {
  for (const value of values) {
    expectInvalid({ ...theme, pedestal: { ...pedestal, [key]: value } }, 'pedestal.');
  }
}
expectInvalid({ ...theme, coin: { ...theme.coin,
  crop: { ...theme.coin.crop, width: 1836 },
} }, 'coin.crop');
expectInvalid({ ...theme, pedestal: { ...pedestal,
  crop: { ...pedestal.crop, height: 630 },
} }, 'pedestal.crop');
for (const color of ['#12', '#12345', '#1234567', '#gggggg', '#abc\n', 'red', 'var(--color)', '', null]) {
  expectInvalid({ ...theme, palette: { ...theme.palette, impact: color } }, 'palette.impact');
}
for (const color of ['#abc', '#ABCD', '#a0B1c2', '#A0b1C2ff']) {
  expectValid({ ...theme, palette: { ...theme.palette, impact: color } });
}
expectInvalid({ ...theme, palette: {} }, 'palette.background');
expectInvalid({ ...theme, palette: null }, 'palette');
expectInvalid({ ...theme, rights: null }, 'rights');
expectInvalid({ ...theme, rights: { commercialReady: 'false', reason: 'Unverified' } }, 'rights.commercialReady');
expectInvalid({ ...theme, rights: { commercialReady: false, reason: ' ' } }, 'rights.reason');
assert.throws(() => createBattleVisualTheme({ ...assetUrls, coin: '' }), TypeError);
assert.throws(() => createBattleVisualTheme(assetUrls, { ...originalMetadata, version: NaN }), TypeError);

console.log(`Battle visual theme checks passed: 18 anchors, 14 slices, fixed aspects, original palette, cache invalidation, ${rejectedCases} rejected inputs; commercialReady=false.`);
