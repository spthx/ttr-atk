/** Deterministic nearest-neighbour stamps; never repeatedly shrink a large PNG. */
const sources = new WeakMap<HTMLImageElement, {
  pixels: Uint8ClampedArray; width: number;
  stamps: Map<string, HTMLCanvasElement>; bytes: number;
}>();
const STAMP_BUDGET = 2 * 1024 * 1024;

export const getCapitalSpriteRasterBytes = (image: HTMLImageElement) => {
  const source = sources.get(image);
  return source ? source.pixels.byteLength + source.bytes : 0;
};
export const releaseCapitalSpriteRaster = (image: HTMLImageElement) => sources.delete(image);

export function getCapitalSpriteRaster(
  image: HTMLImageElement,
  crop: {x: number; y: number; width: number; height: number},
  width: number,
  height: number,
) {
  let source = sources.get(image);
  if (!source) {
    const native = image.ownerDocument.createElement('canvas');
    native.width = image.naturalWidth; native.height = image.naturalHeight;
    const context = native.getContext('2d', {willReadFrequently: true})!;
    context.drawImage(image, 0, 0); // Native resolution: no browser scaling cache.
    source = {pixels: context.getImageData(0, 0, native.width, native.height).data,
      width: native.width, stamps: new Map(), bytes: 0};
    native.width = 1; native.height = 1;
    sources.set(image, source);
  }
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
  const key = `${crop.x}:${crop.y}:${crop.width}:${crop.height}:${w}:${h}`;
  const cached = source.stamps.get(key);
  if (cached) {source.stamps.delete(key); source.stamps.set(key, cached); return cached;}
  const canvas = image.ownerDocument.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d')!;
  const target = context.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(image.naturalHeight - 1, Math.max(0, Math.floor(crop.y + (y + .5) * crop.height / h)));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(source.width - 1, Math.max(0, Math.floor(crop.x + (x + .5) * crop.width / w)));
      const from = (sy * source.width + sx) * 4, to = (y * w + x) * 4;
      for (let channel = 0; channel < 4; channel++) target.data[to + channel] = source.pixels[from + channel];
    }
  }
  context.putImageData(target, 0, 0);
  const bytes = w * h * 4;
  while (source.stamps.size && (source.stamps.size >= 64 || source.bytes + bytes > STAMP_BUDGET)) {
    const oldest = source.stamps.keys().next().value!;
    const removed = source.stamps.get(oldest)!;
    source.bytes -= removed.width * removed.height * 4;
    source.stamps.delete(oldest);
    // GPU textures may still reference this immutable stamp's identity.
  }
  if (bytes <= STAMP_BUDGET) {source.stamps.set(key, canvas); source.bytes += bytes;}
  return canvas;
}
