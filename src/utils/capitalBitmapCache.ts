/** Per-renderer LRU; bounds backing-store bytes as well as entry count. */
export class CapitalBitmapCache {
  private entries = new Map<string, HTMLCanvasElement>();
  bytes = 0;
  hits = 0;
  builds = 0;
  constructor(readonly maxBytes: number, readonly maxEntries = 64) {}
  get size() { return this.entries.size; }
  get(key: string) {
    const value = this.entries.get(key);
    if (!value) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    this.hits++;
    return value;
  }
  put(key: string, bitmap: HTMLCanvasElement) {
    const cost = bitmap.width * bitmap.height * 4;
    if (cost > this.maxBytes) return false;
    this.remove(key);
    while (this.entries.size &&
      (this.bytes + cost > this.maxBytes || this.entries.size >= this.maxEntries)) {
      this.remove(this.entries.keys().next().value);
    }
    this.entries.set(key, bitmap);
    this.bytes += cost;
    this.builds++;
    return true;
  }
  private remove(key: string) {
    const bitmap = this.entries.get(key);
    if (!bitmap) return;
    this.bytes -= bitmap.width * bitmap.height * 4;
    this.entries.delete(key);
    bitmap.width = 1;
    bitmap.height = 1;
  }
  clear() {
    for (const key of this.entries.keys()) this.remove(key);
  }
}
