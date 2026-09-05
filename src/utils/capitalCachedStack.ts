import { CapitalBitmapCache } from './capitalBitmapCache';
import { resolveBattleCapitalSfcRenderedCoinLayers } from './battleCapitalCanvasLayout';

export interface CapitalStackPaintResources {
  cache: CapitalBitmapCache;
  scaleX: number;
  scaleY: number;
  crop: { x: number; y: number; width: number; height: number };
}

/** Rasterize only visible, non-overlapping 128px bands of a long column. */
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
      c.setTransform(resources.scaleX,0,0,resources.scaleY,0,0);
      c.imageSmoothingEnabled=false;
      const crop=resources.crop;
      for(let layer=firstLayer;layer<=lastLayer;layer++){
        c.drawImage(coin,crop.x,crop.y,crop.width,crop.height,
          0,Math.round(phase-layer*layerStep-coinHeight)-bandTop,
          Math.max(1,Math.round(width)),Math.max(1,Math.round(coinHeight)));
      }
      resources.cache.put(key,bitmap);
    }
    context.drawImage(bitmap,Math.round(x-width/2),anchor+bandTop,
      bitmap.width/resources.scaleX,bitmap.height/resources.scaleY);
  }
}
