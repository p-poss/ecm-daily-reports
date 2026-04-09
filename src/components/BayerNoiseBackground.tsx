import { useEffect, useRef } from 'react';

/**
 * Animated Bayer-dithered fBm noise background, ported to raw WebGL2 from
 * zavalit/bayer-dithering-webgl-demo (CodePen "Bayer fbm noise"). Click to
 * spawn ripples. Renders only the inked pixels — the rest is transparent so
 * it can layer over any background color.
 */

const MAX_CLICKS = 10;

const VERT = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform vec2  uClickPos[${MAX_CLICKS}];
uniform float uClickTimes[${MAX_CLICKS}];

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
#define Bayer4(a) (Bayer2(0.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(0.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES    5
#define FBM_LACUNARITY 1.25
#define FBM_GAIN       1.0
#define FBM_SCALE      4.0

float hash11(float n) { return fract(sin(n) * 43758.5453); }

float vnoise(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n100 = hash11(dot(ip + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n010 = hash11(dot(ip + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n110 = hash11(dot(ip + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n001 = hash11(dot(ip + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n101 = hash11(dot(ip + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n011 = hash11(dot(ip + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n111 = hash11(dot(ip + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
  vec3 w = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0 = mix(x00, x10, w.y);
  float y1 = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t) {
  vec3 p = vec3(uv * FBM_SCALE, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i) {
    sum += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

// Circle mask: each dithered cell renders as a circle whose radius
// is proportional to coverage, giving a halftone-print look.
float maskCircle(vec2 p, float cov) {
  float r = sqrt(cov) * 0.38;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

void main() {
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * 0.5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  // Diagonal drift — dust carried by wind across a job site
  vec2 driftUV = uv + vec2(uTime * 0.01, uTime * 0.02);
  float feed = fbm2(driftUV, uTime * 0.05);
  feed = feed * 0.5 - 0.65;

  const float speed = 0.30;
  const float thickness = 0.10;
  const float dampT = 1.0;
  const float dampR = 10.0;

  for (int i = 0; i < ${MAX_CLICKS}; ++i) {
    vec2 pos = uClickPos[i];
    if (pos.x < 0.0) continue;
    vec2 cuv = ((pos - uResolution * 0.5 - cellPixelSize * 0.5) / uResolution) * vec2(aspectRatio, 1.0);
    float t = max(uTime - uClickTimes[i], 0.0);
    float r = distance(uv, cuv);
    float waveR = speed * t;
    float ring = exp(-pow((r - waveR) / thickness, 2.0));
    float atten = exp(-dampT * t) * exp(-dampR * r);
    feed = max(feed, ring * atten);
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  // Apply circle mask for a halftone-dot look instead of square pixels.
  // Modulate opacity by the feed value so some dots are faint (distant)
  // and some are bold (close) — creates a sense of depth.
  float M = maskCircle(pixelUV, bw);
  float depthOpacity = 0.13 + 0.87 * smoothstep(-0.3, 0.3, feed);
  fragColor = vec4(uColor, M * depthOpacity);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return [1, 1, 1];
  return [parseInt(m[0], 16) / 255, parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255];
}

interface BayerNoiseBackgroundProps {
  className?: string;
  /** Hex color for the inked pixels. */
  color?: string;
  /** Size of one Bayer cell in CSS pixels. Larger = chunkier. */
  pixelSize?: number;
}

export function BayerNoiseBackground({
  className,
  color = '#351F09',
  pixelSize = 5,
}: BayerNoiseBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
    if (!gl) {
      console.warn('WebGL2 not supported — skipping Bayer noise background');
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uColorLoc = gl.getUniformLocation(program, 'uColor');
    const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uPixelSizeLoc = gl.getUniformLocation(program, 'uPixelSize');
    const uClickPosLoc = gl.getUniformLocation(program, 'uClickPos');
    const uClickTimesLoc = gl.getUniformLocation(program, 'uClickTimes');

    gl.uniform3fv(uColorLoc, hexToRgb(color));

    const clickPositions = new Float32Array(MAX_CLICKS * 2).fill(-1);
    const clickTimes = new Float32Array(MAX_CLICKS);
    let clickIx = 0;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dw = Math.floor(w * dpr);
      const dh = Math.floor(h * dpr);
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
      gl.viewport(0, 0, dw, dh);
      gl.uniform2f(uResolutionLoc, dw, dh);
      gl.uniform1f(uPixelSizeLoc, pixelSize * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const fx = (e.clientX - rect.left) * dpr;
      const fy = (rect.height - (e.clientY - rect.top)) * dpr;
      clickPositions[clickIx * 2] = fx;
      clickPositions[clickIx * 2 + 1] = fy;
      clickTimes[clickIx] = (performance.now() - startTime) / 1000;
      clickIx = (clickIx + 1) % MAX_CLICKS;
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    let startTime = performance.now();
    let elapsedAtPause = 0;
    let raf = 0;

    const drawFrame = () => {
      const t = (performance.now() - startTime) / 1000;
      gl.uniform1f(uTimeLoc, t);
      gl.uniform2fv(uClickPosLoc, clickPositions);
      gl.uniform1fv(uClickTimesLoc, clickTimes);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const tick = () => {
      drawFrame();
      raf = requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
          elapsedAtPause = performance.now() - startTime;
        }
      } else if (!raf) {
        startTime = performance.now() - elapsedAtPause;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (document.hidden) {
      // Tab is hidden at mount — render one frame so the canvas isn't blank
      // when revealed, and wait for visibilitychange to start the loop.
      drawFrame();
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [color, pixelSize]);

  return <canvas ref={canvasRef} className={className} />;
}
