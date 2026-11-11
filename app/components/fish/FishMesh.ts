import type { FishFinalePublicEntry } from "../../../lib/arcade/fish-finale";
import type { FishPose } from "../../../lib/fish-motion";
import { buildFishVolume } from "../../../lib/fish-volume";

const VERTEX = `
attribute vec3 a_vertex;
uniform vec2 u_view, u_center, u_size, u_head, u_tail;
uniform vec4 u_bounds;
uniform float u_facing, u_yaw, u_turn, u_pitch, u_phase, u_amplitude;
varying vec2 v_uv;
varying float v_shade;
void main() {
  vec2 uv = a_vertex.xy;
  vec2 axis = u_head - u_tail;
  float along = clamp(dot(uv - u_tail, axis) / max(dot(axis, axis), .001), 0., 1.);
  float tail = pow(1. - along, 1.4);
  vec2 p = (uv - (u_bounds.xy + u_bounds.zw * .5)) * u_size;
  float bend = sin(u_phase + along * 5.2) * tail * u_size.x * u_amplitude;
  p.y += bend * .65;
  float z = a_vertex.z * u_size.x + bend;
  float cy = u_facing * u_yaw;
  float sy = u_turn * sqrt(max(0., 1. - u_yaw * u_yaw));
  float depth = -p.x * sy + z * cy;
  p.x = p.x * cy + z * sy;
  float c = cos(u_pitch), s = sin(u_pitch);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + u_center;
  gl_Position = vec4(p.x / u_view.x * 2. - 1., 1. - p.y / u_view.y * 2., -depth / max(1., u_size.x), 1.);
  v_uv = uv;
  v_shade = .86 + .14 * u_yaw;
}`;
const FRAGMENT = `precision mediump float; varying vec2 v_uv; varying float v_shade; uniform sampler2D u_image; uniform float u_opacity; void main() { vec4 ink = texture2D(u_image, v_uv); if (ink.a < .02) discard; gl_FragColor = vec4(ink.rgb * v_shade, ink.a) * u_opacity; }`;

type FishMeshAsset = { texture: WebGLTexture; vertices: WebGLBuffer; indices: WebGLBuffer; count: number };
/** Original PNG on two curved faces. Geometry is created once per decoded art. */
export class FishMesh {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null>;
  private layer = 0;
  private position: number;
  private assets = new Map<string, FishMeshAsset>();
  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    const compile = (kind: number, source: string) => { const shader = gl.createShader(kind); if (!shader) throw new Error("Shader unavailable"); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const reason = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(`Shader could not compile: ${reason}`); } return shader; };
    const program = gl.createProgram(); if (!program) throw new Error("Program unavailable");
    const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const reason = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(`Program could not link: ${reason}`); }
    this.program = program;
    this.position = gl.getAttribLocation(program, "a_vertex");
    this.uniforms = Object.fromEntries(["view", "center", "size", "head", "tail", "bounds", "facing", "yaw", "turn", "pitch", "phase", "amplitude", "opacity", "image"].map(key => [key, gl.getUniformLocation(program, `u_${key}`)]));
    gl.useProgram(program); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.uniform1i(this.uniforms.image!, 0);
  }
  texture(id: string, image: HTMLImageElement, entry: FishFinalePublicEntry) {
    const gl = this.gl;
    const raster = document.createElement("canvas"); raster.width = 128; raster.height = 96;
    const ctx = raster.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Artwork sampling unavailable");
    ctx.drawImage(image, 0, 0, 128, 96);
    const geometry = buildFishVolume(ctx.getImageData(0, 0, 128, 96), entry.anchors);
    const texture = gl.createTexture(), vertices = gl.createBuffer(), indices = gl.createBuffer();
    if (!texture || !vertices || !indices) { if(texture)gl.deleteTexture(texture);if(vertices)gl.deleteBuffer(vertices);if(indices)gl.deleteBuffer(indices);throw new Error("Artwork mesh unavailable"); }
    const previous = this.assets.get(id); if (previous) { gl.deleteTexture(previous.texture); gl.deleteBuffer(previous.vertices); gl.deleteBuffer(previous.indices); }
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Animation samples a bounded texture; downloads retain the untouched PNG.
    const textureCanvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / image.naturalWidth, 384 / image.naturalHeight);
    textureCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    textureCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const textureContext = textureCanvas.getContext("2d");
    if (!textureContext) throw new Error("Artwork texture unavailable");
    textureContext.drawImage(image, 0, 0, textureCanvas.width, textureCanvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
    this.assets.set(id, { texture, vertices, indices, count: geometry.indices.length });
  }
  begin(width: number, height: number) {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
    this.layer = 0;
    gl.depthRange(0, 1);
    gl.uniform2f(this.uniforms.view!, width, height);
  }
  draw(entry: FishFinalePublicEntry, pose: FishPose, width: number, height: number) {
    const asset = this.assets.get(entry.id); if (!asset || pose.opacity <= 0) return;
    const gl = this.gl, u = this.uniforms;
    // Separate depth bands preserve sorted transparency without a full-buffer
    // depth clear for every fish. Rooms support at most ten fish (16 bands).
    const far = 1 - this.layer++ / 16;
    gl.depthRange(far - 1 / 16, far);
    gl.bindBuffer(gl.ARRAY_BUFFER, asset.vertices); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, asset.indices);
    gl.enableVertexAttribArray(this.position); gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 0, 0);
    const size = fishSize(entry, pose, width, height);
    gl.bindTexture(gl.TEXTURE_2D, asset.texture);
    gl.uniform2f(u.center!, pose.x * width, pose.y * height); gl.uniform2f(u.size!, size.width, size.height);
    gl.uniform2f(u.head!, entry.anchors.head.x, entry.anchors.head.y); gl.uniform2f(u.tail!, entry.anchors.tail.x, entry.anchors.tail.y);
    gl.uniform4f(u.bounds!, entry.bounds.x, entry.bounds.y, entry.bounds.width, entry.bounds.height);
    gl.uniform1f(u.facing!, pose.facing); gl.uniform1f(u.yaw!, pose.yaw); gl.uniform1f(u.turn!, pose.turn ?? 1); gl.uniform1f(u.pitch!, pose.pitch * pose.facing);
    gl.uniform1f(u.phase!, pose.tailPhase); gl.uniform1f(u.amplitude!, pose.amplitude); gl.uniform1f(u.opacity!, pose.opacity);
    gl.drawElements(gl.TRIANGLES, asset.count, gl.UNSIGNED_SHORT, 0);
  }
  dispose() { const gl = this.gl; for (const a of this.assets.values()) { gl.deleteTexture(a.texture);gl.deleteBuffer(a.vertices);gl.deleteBuffer(a.indices); } this.assets.clear();gl.deleteProgram(this.program); }
}

export function fishSize(entry: FishFinalePublicEntry, pose: FishPose, width: number, height: number) {
  const ratio = entry.width / entry.height;
  const base = Math.min(width * .16 / Math.max(.15, entry.bounds.width), height * .245 * ratio / Math.max(.15, entry.bounds.height));
  return { width: base * pose.scale, height: base / ratio * pose.scale };
}
