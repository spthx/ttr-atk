/** Source pixels, excluding transparent padding; never destination geometry. */
export interface BattleVisualThemeCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Explicit hex colors keep validation independent of CSS/DOM availability. */
export interface BattleVisualThemePalette {
  readonly background: string;
  readonly stripeA: string;
  readonly stripeB: string;
  readonly player: string;
  readonly enemy: string;
  readonly edge: string;
  readonly impact: string;
}

export interface BattleVisualThemeRights {
  // This sidecar cannot certify licenses. A future reviewed rights workflow is
  // required before extending this type to permit a commercial-ready theme.
  readonly commercialReady: false;
  readonly reason: string;
}

export interface BattleVisualThemeMetadata {
  /** Unique pack ID: lowercase ASCII words separated by '.', '_' or '-'. */
  readonly id: string;
  /** Positive content revision. Bump when image bytes change at the same URL. */
  readonly version: number;
  readonly coin: {
    readonly crop: BattleVisualThemeCrop;
  };
  readonly pedestal: {
    readonly crop: BattleVisualThemeCrop;
    readonly centerTileWidth: number;
    readonly centerTileCount: number;
    readonly frontSplit: number;
  };
  readonly palette: BattleVisualThemePalette;
  readonly rights: BattleVisualThemeRights;
}

export interface BattleVisualTheme extends BattleVisualThemeMetadata {
  readonly coin: BattleVisualThemeMetadata['coin'] & { readonly url: string };
  readonly pedestal: BattleVisualThemeMetadata['pedestal'] & {
    readonly url: string;
  };
}

export interface BattleVisualThemeAssetUrls {
  readonly coin: string;
  readonly pedestal: string;
}

/** Supply decoded naturalWidth/naturalHeight to validate actual PNG bounds. */
export interface BattleVisualThemeImageSizes {
  readonly coin: { readonly width: number; readonly height: number };
  readonly pedestal: { readonly width: number; readonly height: number };
}

export interface BattleVisualThemeValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Mirrors BattleCapitalCanvas and battleCapitalCanvasLayout without importing
 * PNGs, React, import.meta.env or a browser. The structural check compares these
 * values to the live layout contract. No anchor, timing or motion knobs belong
 * here: all eighteen anchors and destination geometry remain renderer-owned.
 */
export const DEFAULT_BATTLE_VISUAL_THEME_METADATA: BattleVisualThemeMetadata =
  Object.freeze({
    id: 'sfc-pedestal-v3-wide-bundled',
    version: 1,
    coin: Object.freeze({
      crop: Object.freeze({ x: 135, y: 167, width: 1837, height: 397 }),
    }),
    pedestal: Object.freeze({
      crop: Object.freeze({ x: 313, y: 59, width: 1668, height: 631 }),
      centerTileWidth: 64,
      centerTileCount: 12, // Two 802px caps + twelve 64px tiles = 2372px.
      frontSplit: 0.58,
    }),
    palette: Object.freeze({
      background: '#b6ad91',
      stripeA: '#91ad91',
      stripeB: '#c4a4a1',
      player: '#a91e2f',
      enemy: '#244f83',
      edge: '#f2e5b7',
      // Reserved for lightweight effects; current Canvas has no impact paint.
      impact: '#f2e5b7',
    }),
    rights: Object.freeze({
      commercialReady: false,
      reason:
        'Commercial rights for all artwork and fan-derived material have not ' +
        'been verified. Changing this palette or these two sprites does not ' +
        'clear the remaining game assets for sale.',
    }),
  });

const PALETTE_KEYS = [
  'background', 'stripeA', 'stripeB', 'player', 'enemy', 'edge', 'impact',
] as const satisfies readonly (keyof BattleVisualThemePalette)[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIntegerAtLeast = (value: unknown, minimum: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value &&
  !/[\u0000-\u001f\u007f]/.test(value);

// Integer cross-products avoid accepting aspect drift through float rounding.
const matchesAspect = (
  width: number, height: number, referenceWidth: number, referenceHeight: number
) => BigInt(width) * BigInt(referenceHeight) ===
  BigInt(height) * BigInt(referenceWidth);

const validateCrop = (
  value: unknown,
  path: string,
  errors: string[]
): BattleVisualThemeCrop | undefined => {
  if (!isRecord(value)) {
    errors.push(`${path}: expected a crop object.`);
    return undefined;
  }
  const { x, y, width, height } = value;
  if (!isIntegerAtLeast(x, 0) || !isIntegerAtLeast(y, 0) ||
      !isIntegerAtLeast(width, 1) || !isIntegerAtLeast(height, 1)) {
    errors.push(`${path}: x/y must be non-negative safe integers; width/height must be positive safe integers.`);
    return undefined;
  }
  if (!Number.isSafeInteger(x + width) || !Number.isSafeInteger(y + height)) {
    errors.push(`${path}: right/bottom boundaries exceed safe integer precision.`);
    return undefined;
  }
  return { x, y, width, height };
};

/**
 * Pure structural/geometry validation of an untrusted theme; no mutation,
 * asset loading or license inference. Without imageSizes, only numeric crop
 * boundaries can be checked. Pass BOTH decoded image sizes before rendering
 * replacement sprites to also reject out-of-image crops.
 *
 * Colors accept #RGB, #RGBA, #RRGGBB and #RRGGBBAA (no CSS variables/functions).
 * Crop aspects and frontSplit must match the existing fixed layout, including
 * the assembled pedestal width, not the untiled source PNG width.
 */
export const validateBattleVisualTheme = (
  theme: unknown,
  imageSizes?: BattleVisualThemeImageSizes
): BattleVisualThemeValidation => {
  const errors: string[] = [];
  if (!isRecord(theme)) {
    return { valid: false, errors: ['theme: expected an object.'] };
  }
  if (!isText(theme.id) || theme.id.length > 128 ||
      !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(theme.id)) {
    errors.push('id: expected 1-128 lowercase ASCII letters/digits with single separators (. _ -).');
  }
  if (!isIntegerAtLeast(theme.version, 1)) {
    errors.push('version: expected a positive safe integer content revision.');
  }

  for (const name of ['coin', 'pedestal'] as const) {
    const sprite = theme[name];
    if (!isRecord(sprite)) {
      errors.push(`${name}: expected a sprite object.`);
      continue;
    }
    if (!isText(sprite.url)) {
      errors.push(`${name}.url: expected a non-empty URL string without surrounding whitespace or control characters.`);
    }
    const crop = validateCrop(sprite.crop, `${name}.crop`, errors);
    if (imageSizes !== undefined) {
      const size = isRecord(imageSizes) ? imageSizes[name] : undefined;
      if (!isRecord(size) || !isIntegerAtLeast(size.width, 1) ||
          !isIntegerAtLeast(size.height, 1)) {
        errors.push(`${name}.imageSize: expected positive safe integer decoded dimensions.`);
      } else if (crop && (crop.x + crop.width > size.width ||
                         crop.y + crop.height > size.height)) {
        errors.push(`${name}.crop: exceeds decoded image bounds.`);
      }
    }
    if (name === 'coin') {
      if (crop && !matchesAspect(crop.width, crop.height, 1837, 397)) {
        errors.push('coin.crop: aspect must remain 1837/397 for the fixed layout.');
      }
      continue;
    }
    const tileWidth = sprite.centerTileWidth;
    const tileCount = sprite.centerTileCount;
    if (!isIntegerAtLeast(tileWidth, 1) || !isIntegerAtLeast(tileCount, 1)) {
      errors.push('pedestal.centerTileWidth/centerTileCount: expected positive safe integers.');
    } else if (crop) {
      const capWidth = (crop.width - tileWidth) / 2;
      const assembledWidth = crop.width - tileWidth + tileWidth * tileCount;
      if (!Number.isSafeInteger(capWidth) || capWidth <= 0) {
        errors.push('pedestal.centerTileWidth: must leave two equal positive integer caps within the crop.');
      }
      if (!Number.isSafeInteger(assembledWidth) || assembledWidth <= 0 ||
          !Number.isSafeInteger(tileCount + 2)) {
        errors.push('pedestal.centerTileCount: assembled width/slice count exceeds safe integer precision.');
      } else if (!matchesAspect(assembledWidth, crop.height, 2372, 631)) {
        errors.push('pedestal.crop: assembled aspect must remain 2372/631 for the fixed layout.');
      }
    }
    if (typeof sprite.frontSplit !== 'number' ||
        !Number.isFinite(sprite.frontSplit) || sprite.frontSplit <= 0 ||
        sprite.frontSplit >= 1) {
      errors.push('pedestal.frontSplit: expected a finite fraction strictly between 0 and 1.');
    } else if (sprite.frontSplit !== 0.58) {
      errors.push('pedestal.frontSplit: must remain 0.58 for the fixed row contact geometry.');
    }
  }

  if (!isRecord(theme.palette)) {
    errors.push('palette: expected a palette object.');
  } else {
    for (const key of PALETTE_KEYS) {
      const color = theme.palette[key];
      if (!isText(color) ||
          !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color)) {
        errors.push(`palette.${key}: expected a hex RGB/RGBA color.`);
      }
    }
  }
  if (!isRecord(theme.rights)) {
    errors.push('rights: expected explicit unverified rights metadata.');
  } else {
    if (theme.rights.commercialReady !== false) {
      errors.push('rights.commercialReady: must be false; structural validation cannot certify asset rights.');
    }
    if (!isText(theme.rights.reason)) {
      errors.push('rights.reason: expected a non-empty explanation.');
    }
  }
  return { valid: errors.length === 0, errors };
};

/**
 * Keep existing PNG imports in the renderer and inject their resolved strings:
 * createBattleVisualTheme({ coin: capitalCoinSpriteUrl, pedestal: capitalPedestalSpriteUrl }).
 * Pass a new metadata id/version/palette to opt into an original visual pack.
 * Returns a detached, deeply frozen theme; throws TypeError for invalid input.
 * No URL is guessed from public/ or a build-specific hashed asset filename.
 */
export const createBattleVisualTheme = (
  assetUrls: BattleVisualThemeAssetUrls,
  metadata: BattleVisualThemeMetadata = DEFAULT_BATTLE_VISUAL_THEME_METADATA
): BattleVisualTheme => {
  const theme: BattleVisualTheme = {
    ...metadata,
    coin: { url: assetUrls.coin, crop: { ...metadata.coin.crop } },
    pedestal: {
      ...metadata.pedestal,
      url: assetUrls.pedestal,
      crop: { ...metadata.pedestal.crop },
    },
    palette: { ...metadata.palette },
    rights: { ...metadata.rights },
  };
  const validation = validateBattleVisualTheme(theme);
  if (!validation.valid) {
    throw new TypeError(`Invalid battle visual theme: ${validation.errors.join(' ')}`);
  }
  Object.freeze(theme.coin.crop);
  Object.freeze(theme.coin);
  Object.freeze(theme.pedestal.crop);
  Object.freeze(theme.pedestal);
  Object.freeze(theme.palette);
  Object.freeze(theme.rights);
  return Object.freeze(theme);
};

/**
 * Canonical, collision-free serialization of the validated theme's fields.
 * Compute once per theme change; include it in BOTH image-set and static-canvas
 * cache identities. It includes URLs/crops/palette even if a revision bump was
 * forgotten. For changed bytes at an unchanged URL, the owner MUST bump version.
 * This does not bypass HTTP caching: use hashed/versioned image URLs as well.
 * No global ID registry, random ID, timestamp or DOM/cache mutation is needed.
 */
export const getBattleVisualThemeCacheKey = (theme: BattleVisualTheme): string => {
  const { coin, pedestal, palette, rights } = theme;
  const cropKey = (crop: BattleVisualThemeCrop) =>
    [crop.x, crop.y, crop.width, crop.height];
  return JSON.stringify([
    'battle-visual-theme-v1', theme.id, theme.version,
    [coin.url, cropKey(coin.crop)],
    [pedestal.url, cropKey(pedestal.crop), pedestal.centerTileWidth,
      pedestal.centerTileCount, pedestal.frontSplit],
    PALETTE_KEYS.map((key) => palette[key]),
    [rights.commercialReady, rights.reason],
  ]);
};
