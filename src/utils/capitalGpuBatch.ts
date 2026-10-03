/** A bounded 2D sprite batch. Coin bands stay resident on the GPU between bids. */
import type { CapitalSpriteContext } from './capitalCachedStack';
const CAPACITY = 512;
const SLOT_WIDTH = 128;
const SLOT_HEIGHT = 256;
const ATLAS_COLUMNS = 8;
const ATLAS_SLOTS = 64;
const ATLAS_WIDTH = SLOT_WIDTH * ATLAS_COLUMNS;
const ATLAS_HEIGHT = SLOT_HEIGHT * (ATLAS_SLOTS / ATLAS_COLUMNS);

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 rect;
layout(location=1) in vec4 uvRect;
uniform vec2 resolution;
out vec2 uv;
flat out vec4 crop;
const vec2 corners[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
void main(){
  vec2 p=corners[gl_VertexID];
  vec2 screen=(rect.xy+p*rect.zw)/resolution;
  gl_Position=vec4(screen.x*2.-1.,1.-screen.y*2.,0,1);
  uv=p;
  crop=uvRect;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D sprite;
in vec2 uv;
flat in vec4 crop;
out vec4 color;
void main(){
  ivec2 size=textureSize(sprite,0);
  // Fractional DPR can place a sample exactly on a texel boundary. Avoid a
  // different rounding direction across a triangle's interpolated diagonal.
  ivec2 pixel=ivec2(floor(crop.xy+uv*crop.zw+vec2(.001)));
  color=texelFetch(sprite,clamp(pixel,ivec2(0),size-ivec2(1)),0);
}`;

interface Texture { value: WebGLTexture; width: number; height: number }
export class CapitalGpuBatch {
  readonly gl: WebGL2RenderingContext;
  readonly context: CapitalSpriteContext;
  readonly bufferBytes = CAPACITY * 8 * 4;
  readonly atlasBytes = ATLAS_WIDTH * ATLAS_HEIGHT * 4;
  drawCalls = 0;
  uploads = 0;
  frames = 0;
  sprites = 0;
  needsRebuild = false;
  private onRestored = () => { this.needsRebuild = true; };
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private resolution: WebGLUniformLocation | null;
  private sampler: WebGLUniformLocation | null;
  private atlas: Texture;
  private background: Texture;
  private backgroundCanvas: HTMLCanvasElement;
  private backgroundKey = '';
  private images = new Map<HTMLImageElement | HTMLCanvasElement, Texture>();
  private tiles = new Map<HTMLCanvasElement, number>();
  private vertices = new Float32Array(CAPACITY * 8);
  private count = 0;
  private texture: Texture | null = null;
  private width = 1;
  private height = 1;
  private sx = 1;
  private sy = 1;
  private tx = 0;
  private ty = 0;
  private savedX = 0;
  private savedY = 0;
  private matrix = new DOMMatrix();
  private disposed = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!gl) throw new Error('WebGL2 is unavailable');
    this.gl = gl;
    const shaders: WebGLShader[] = [];
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type);
      if (!result) throw new Error('Unable to allocate sprite shader');
      shaders.push(result); gl.shaderSource(result, source); gl.compileShader(result);
      return result;
    };
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to allocate sprite program');
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    const log = linked ? '' : gl.getProgramInfoLog(program);
    shaders.forEach(item => gl.deleteShader(item));
    if (!linked) { gl.deleteProgram(program); throw new Error(log || 'Sprite shader failed'); }
    this.program = program;
    this.resolution = gl.getUniformLocation(program, 'resolution');
    this.sampler = gl.getUniformLocation(program, 'sprite');
    this.vao = gl.createVertexArray()!;
    this.buffer = gl.createBuffer()!;
    if (!this.vao || !this.buffer) throw new Error('Unable to allocate sprite batch');
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.bufferBytes, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 2; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    this.atlas = this.allocate(ATLAS_WIDTH, ATLAS_HEIGHT);
    this.background = this.allocate(1, 1);
    this.backgroundCanvas = canvas.ownerDocument.createElement('canvas');
    // Only this small drawing vocabulary is used by the shared SFC layout.
    // The Canvas fallback and GPU therefore consume exactly the same geometry.
    this.context = {
      canvas,
      save: () => { this.savedX = this.tx; this.savedY = this.ty; },
      restore: () => { this.tx = this.savedX; this.ty = this.savedY; },
      translate: (x: number, y: number) => { this.tx += x; this.ty += y; },
      getTransform: () => {
        this.matrix.a = this.sx; this.matrix.d = this.sy;
        this.matrix.e = this.tx * this.sx; this.matrix.f = this.ty * this.sy;
        return this.matrix;
      },
      drawImage: (source: CanvasImageSource, ...args: number[]) => {
        if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) {
          throw new Error('Unsupported capital sprite source');
        }
        this.image(source, args);
      },
    };
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  private allocate(width: number, height: number): Texture {
    const gl = this.gl;
    const value = gl.createTexture();
    if (!value) throw new Error('Unable to allocate sprite texture');
    gl.bindTexture(gl.TEXTURE_2D, value);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return { value, width, height };
  }

  begin(width: number, height: number, backgroundKey: string, paintBackground: (context: CanvasRenderingContext2D) => void) {
    if (this.disposed || this.gl.isContextLost()) return false;
    this.width = width; this.height = height;
    this.sx = this.canvas.width / width; this.sy = this.canvas.height / height;
    this.tx = 0; this.ty = 0; this.count = 0; this.texture = null;
    this.drawCalls = 0; this.sprites = 0; this.frames++;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.uniform2f(this.resolution, width, height);
    gl.uniform1i(this.sampler, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.backgroundKey !== backgroundKey) {
      const backing = this.backgroundCanvas;
      if (backing.width !== this.canvas.width || backing.height !== this.canvas.height) {
        backing.width = this.canvas.width; backing.height = this.canvas.height;
      }
      const context = backing.getContext('2d', { alpha: false })!;
      context.setTransform(this.sx, 0, 0, this.sy, 0, 0);
      paintBackground(context);
      gl.bindTexture(gl.TEXTURE_2D, this.background.value);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backing);
      this.background.width = backing.width; this.background.height = backing.height;
      this.backgroundKey = backgroundKey; this.uploads++;
    }
    this.quad(this.background, 0, 0, width, height, 0, 0, this.background.width, this.background.height);
    return true;
  }

  private image(source: HTMLImageElement | HTMLCanvasElement, args: number[]) {
    let texture: Texture;
    let offsetX = 0, offsetY = 0;
    if (source instanceof HTMLCanvasElement && source.width <= SLOT_WIDTH && source.height <= SLOT_HEIGHT) {
      let slot = this.tiles.get(source);
      if (slot !== undefined) { this.tiles.delete(source); this.tiles.set(source, slot); }
      else {
        // Flush before reusing a slot: an earlier draw may still reference it.
        this.flush();
        if (this.tiles.size >= ATLAS_SLOTS) {
          const oldest = this.tiles.keys().next().value!;
          slot = this.tiles.get(oldest)!; this.tiles.delete(oldest);
        } else slot = this.tiles.size;
        this.tiles.set(source, slot);
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.atlas.value);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, slot % ATLAS_COLUMNS * SLOT_WIDTH,
          Math.floor(slot / ATLAS_COLUMNS) * SLOT_HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, source);
        this.uploads++;
      }
      texture = this.atlas;
      offsetX = slot % ATLAS_COLUMNS * SLOT_WIDTH;
      offsetY = Math.floor(slot / ATLAS_COLUMNS) * SLOT_HEIGHT;
    } else {
      const cached = this.images.get(source);
      if (cached) texture = cached;
      else {
        this.flush();
        texture = this.allocate(source instanceof HTMLImageElement ? source.naturalWidth : source.width,
          source instanceof HTMLImageElement ? source.naturalHeight : source.height);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
        this.images.set(source, texture); this.uploads++;
      }
    }
    const [sx, sy, sw, sh, dx, dy, dw, dh] = args.length === 2
      ? [0, 0, source.width, source.height, ...args, source.width, source.height]
      : args.length === 4 ? [0, 0, source.width, source.height, ...args] : args;
    this.quad(texture, dx + this.tx, dy + this.ty, dw, dh,
      offsetX + sx, offsetY + sy, sw, sh);
  }

  private quad(texture: Texture, x: number, y: number, width: number, height: number,
    u: number, v: number, uw: number, vh: number) {
    if (y >= this.height || y + height <= 0 || x >= this.width || x + width <= 0) return;
    if (this.texture !== texture || this.count === CAPACITY) this.flush();
    this.texture = texture;
    const i = this.count++ * 8, a = this.vertices;
    a[i] = x; a[i + 1] = y; a[i + 2] = width; a[i + 3] = height;
    a[i + 4] = u; a[i + 5] = v; a[i + 6] = uw; a[i + 7] = vh;
    this.sprites++;
  }

  flush() {
    if (!this.count || !this.texture) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture.value);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices, 0, this.count * 8);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    this.count = 0; this.drawCalls++;
  }

  get textureBytes() {
    let bytes = this.atlasBytes + this.background.width * this.background.height * 4;
    for (const image of this.images.values()) bytes += image.width * image.height * 4;
    return bytes;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    if (!this.needsRebuild) {
      gl.deleteTexture(this.atlas.value); gl.deleteTexture(this.background.value);
      for (const image of this.images.values()) gl.deleteTexture(image.value);
      gl.deleteBuffer(this.buffer); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
    }
    this.images.clear(); this.tiles.clear();
    this.backgroundCanvas.width = 1; this.backgroundCanvas.height = 1;
  }
}
