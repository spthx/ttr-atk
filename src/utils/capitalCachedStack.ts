import { CapitalBitmapCache } from './capitalBitmapCache';
import { resolveBattleCapitalSfcRenderedCoinLayers } from './battleCapitalCanvasLayout';
import { getCapitalSpriteRaster } from './capitalSpriteRaster';

export type CapitalSpriteContext = Pick<CanvasRenderingContext2D,
  'canvas' | 'save' | 'restore' | 'translate' | 'getTransform' | 'drawImage'>;

export interface CapitalStackPaintResources {
  cache: CapitalBitmapCache;
  scaleX: number;
  scaleY: number;
  crop: { x: number; y: number; width: number; height: number };
}

/** Rasterize only visible, non-overlapping 128px bands of a long column. */
export function drawCachedCapitalStack(
  context: CapitalSpriteContext,
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
  const stamp = getCapitalSpriteRaster(coin, resources.crop, bitmapWidth,
    Math.max(1, Math.round(Math.round(coinHeight) * resources.scaleY)));
  const transform=context.getTransform();
  const viewTop=-transform.f/transform.d-anchor;
  const viewBottom=(context.canvas.height-transform.f)/transform.d-anchor;
  if (top>=viewBottom || bottom<=viewTop) return;
  // Physical-pixel-aligned slices prevent gaps at fractional DPR. Interior
  // slices do not include total height in their key, so later bids reuse them.
  const bandPixels=Math.max(1,Math.round(128*resources.scaleY));
  const firstBand=Math.floor(Math.max(top,viewTop)*resources.scaleY/bandPixels);
  const lastBand=Math.ceil(Math.min(bottom,viewBottom)*resources.scaleY/bandPixels)-1;
  for(let band=firstBand;band<=lastBand;band++){
    const bandTop=band*bandPixels/resources.scaleY;
    const bandBottom=(band+1)*bandPixels/resources.scaleY;
    const firstLayer=Math.max(0,Math.ceil((phase-coinHeight-bandBottom-1)/layerStep));
    const lastLayer=Math.min(count-1,Math.floor((phase-bandTop+1)/layerStep));
    if (lastLayer<firstLayer) continue;
    const key=`${width}:${coinHeight}:${layerStep}:${phase}:${band}:${firstLayer}:${lastLayer}`;
    let bitmap=resources.cache.get(key);
    if(!bitmap){
      bitmap=context.canvas.ownerDocument.createElement('canvas');
      bitmap.width=bitmapWidth;bitmap.height=bandPixels;
      const c=bitmap.getContext('2d');if(!c)return;
      c.imageSmoothingEnabled=false;
      for(let layer=firstLayer;layer<=lastLayer;layer++){
        c.drawImage(stamp, 0,
          Math.round((Math.round(phase-layer*layerStep-coinHeight)-bandTop)*resources.scaleY));
      }
      resources.cache.put(key,bitmap);
    }
    context.drawImage(bitmap,
      Math.round(Math.round(x-width/2)*resources.scaleX)/resources.scaleX,
      Math.round((anchor+bandTop)*resources.scaleY)/resources.scaleY,
      bitmap.width/resources.scaleX,bitmap.height/resources.scaleY);
  }
}
