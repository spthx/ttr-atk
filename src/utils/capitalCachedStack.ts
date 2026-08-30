import { CapitalBitmapCache } from './capitalBitmapCache';
import { resolveBattleCapitalSfcRenderedCoinLayers } from './battleCapitalCanvasLayout';

export interface CapitalStackPaintResources {
  cache: CapitalBitmapCache;
  scaleX: number;
  scaleY: number;
  crop: { x: number; y: number; width: number; height: number };
}

/** Reuses full before/after columns; the canvas clip handles offscreen rows. */
export function drawCachedCapitalStack(
  context: CanvasRenderingContext2D,
  coin: HTMLImageElement,
  resources: CapitalStackPaintResources,
  x: number, baseY: number, width: number, coinHeight: number,
  layerStep: number, layers: number,
) {
  const count = resolveBattleCapitalSfcRenderedCoinLayers(layers);
  if (count <= 0) return;
  const anchor = Math.round(baseY);
  const phase = baseY - anchor;
  const top = Math.round(phase - (count - 1) * layerStep - coinHeight);
  const bottom = Math.round(phase - coinHeight) + Math.max(1, Math.round(coinHeight));
  const bitmapWidth = Math.max(1, Math.ceil(Math.round(width) * resources.scaleX));
  const bitmapHeight = Math.max(1, Math.ceil((bottom - top) * resources.scaleY));
  const key = `${count}:${width}:${coinHeight}:${layerStep}:${phase}`;
  let bitmap = resources.cache.get(key);
  if (!bitmap) {
    bitmap = context.canvas.ownerDocument.createElement('canvas');
    bitmap.width = bitmapWidth;
    bitmap.height = bitmapHeight;
    const c = bitmap.getContext('2d');
    if (!c) return;
    c.setTransform(resources.scaleX, 0, 0, resources.scaleY, 0, 0);
    c.imageSmoothingEnabled = false;
    const crop = resources.crop;
    for (let layer = 0; layer < count; layer++) {
      c.drawImage(coin,crop.x,crop.y,crop.width,crop.height,
        0,Math.round(phase-layer*layerStep-coinHeight)-top,
        Math.max(1,Math.round(width)),Math.max(1,Math.round(coinHeight)));
    }
    resources.cache.put(key,bitmap);
  }
  context.drawImage(bitmap,
    Math.round(x-width/2),anchor+top,
    bitmap.width/resources.scaleX,bitmap.height/resources.scaleY);
}
