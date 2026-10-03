export interface CapitalCasinoImages {
  wide?: HTMLImageElement;
  portrait?: HTMLImageElement;
}

export const selectCapitalCasinoImage = (images: CapitalCasinoImages | undefined, width: number, height: number) => {
  const ready = (image: HTMLImageElement | undefined) => image?.complete && image.naturalWidth > 0 ? image : null;
  return width / height < 1.35
    ? ready(images?.portrait) ?? ready(images?.wide)
    : ready(images?.wide) ?? ready(images?.portrait);
};

const plates = new WeakMap<HTMLCanvasElement, {
  image: HTMLImageElement | null; sourceKey: string; width: number; height: number; plate: HTMLCanvasElement;
}>();

/** Static velvet/gilt artwork is resampled once per output size, not per wave. */
export function paintCapitalCasinoPlate(
  context: CanvasRenderingContext2D, image: HTMLImageElement | null,
) {
  const backingWidth = context.canvas.width, backingHeight = context.canvas.height;
  const sourceKey = image?.currentSrc || image?.src || '';
  let entry = plates.get(context.canvas);
  if (!entry || entry.image !== image || entry.sourceKey !== sourceKey || entry.width !== backingWidth || entry.height !== backingHeight) {
    const plate = context.canvas.ownerDocument.createElement('canvas');
    plate.width = backingWidth; plate.height = backingHeight;
    const ctx = plate.getContext('2d', {alpha: false})!;
    ctx.fillStyle = '#08261e'; ctx.fillRect(0, 0, backingWidth, backingHeight);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // Preserve the complete gold frame: this is a responsive table backdrop,
    // rather than a cover crop which would discard its decorative rails.
    if (image) ctx.drawImage(image, 0, 0, backingWidth, backingHeight);
    const top = ctx.createLinearGradient(0, 0, 0, backingHeight);
    top.addColorStop(0, 'rgba(3,8,13,.48)');
    top.addColorStop(.3, 'rgba(3,8,13,0)');
    top.addColorStop(.78, 'rgba(4,7,12,0)');
    top.addColorStop(1, 'rgba(4,7,12,.25)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, backingWidth, backingHeight);
    entry = {image, sourceKey, width: backingWidth, height: backingHeight, plate};
    plates.set(context.canvas, entry);
  }
  context.save();
  context.globalAlpha = 1; context.globalCompositeOperation = 'copy';
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(entry.plate, 0, 0);
  context.restore();
}

/** Light ribbons follow the ownership front without painting over the room. */
export function paintCapitalPressureLight(
  context: CanvasRenderingContext2D, width: number, height: number, ownership: number,
  playerColor: string, enemyColor: string,
) {
  const boundary = Math.max(0, Math.min(width, width * ownership / 100));
  context.save();
  context.globalCompositeOperation = 'screen';
  const lanes = [.31, .51, .71];
  for (const [side, color] of [['player', playerColor], ['enemy', enemyColor]] as const) {
    const left = side === 'player';
    const start = left ? 0 : width;
    const end = boundary;
    if (Math.abs(end - start) < 1) continue;
    for (const fraction of lanes) {
      const y = height * fraction;
      const depth = Math.max(6, height * .038);
      const glow = context.createLinearGradient(0, y - depth, 0, y + depth);
      glow.addColorStop(0, 'transparent'); glow.addColorStop(.5, color); glow.addColorStop(1, 'transparent');
      context.globalAlpha = .22;
      context.fillStyle = glow;
      context.beginPath();
      context.moveTo(start, y - depth);
      context.bezierCurveTo(start + (end - start) * .42, y - depth * .9,
        end + (left ? -20 : 20), y - depth * .35, end, y);
      context.bezierCurveTo(end + (left ? -20 : 20), y + depth * .35,
        start + (end - start) * .42, y + depth * .9, start, y + depth);
      context.closePath(); context.fill();
      const thread = context.createLinearGradient(start, 0, end, 0);
      thread.addColorStop(0, 'transparent'); thread.addColorStop(.65, color); thread.addColorStop(1, '#fff4d3');
      context.globalAlpha = .45; context.strokeStyle = thread;
      context.lineWidth = Math.max(.6, height / 550);
      context.beginPath(); context.moveTo(start, y);
      context.lineTo(end, y); context.stroke();
    }
  }
  context.restore();
}
