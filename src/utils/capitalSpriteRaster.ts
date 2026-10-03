/** Smooth, immutable stamps prepared once from a native-resolution canvas. */
const sources = new WeakMap<HTMLImageElement, {
  canvas: HTMLCanvasElement;
  stamps: Map<string, HTMLCanvasElement>; bytes: number;
}>();
const STAMP_BUDGET = 2 * 1024 * 1024;

export const getCapitalSpriteRasterBytes = (image: HTMLImageElement) => {
  const source = sources.get(image);
  return source ? source.canvas.width * source.canvas.height * 4 + source.bytes : 0;
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
    source = {canvas: native, stamps: new Map(), bytes: 0};
    sources.set(image, source);
  }
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
  const key = `${crop.x}:${crop.y}:${crop.width}:${crop.height}:${w}:${h}`;
  const cached = source.stamps.get(key);
  if (cached) {source.stamps.delete(key); source.stamps.set(key, cached); return cached;}
  const canvas = image.ownerDocument.createElement('canvas');
  canvas.width = w; canvas.height = h;
  // Software-backed canvas-to-canvas filtering stays stable across resize and
  // avoids the image decoder's size-dependent nearest-neighbour cache. Alpha
  // coverage is preserved, giving the medal rim a smooth silhouette.
  const context = canvas.getContext('2d', {willReadFrequently: true})!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
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
