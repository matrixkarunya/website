/* eslint-disable react/no-unknown-property */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  SHADERS: original wave + original dither, merged into ONE pass     */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // fullscreen quad, no matrix math
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec2  resolution;   // drawing-buffer size in pixels
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3  waveColor;
uniform vec2  mousePos;     // in drawing-buffer pixels, y already top-down like the original
uniform float mouseActive;
uniform float mouseRadius;
uniform float colorNum;
uniform float pixelSize;    // in drawing-buffer pixels (1.0 when we already render low-res)

varying vec2 vUv;

// ---------- ORIGINAL classic Perlin noise (this is what gives the look) ----------
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

// ---------- ORIGINAL fbm + nested warp (the flowing folded ridges) ----------
const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

// ---------- ORIGINAL 8x8 Bayer, computed with bit math (identical values) ----------
// M(x,y) = bit-reverse-interleave of (x^y, y)  ->  same matrix as the 64-float array
float bayer8(vec2 c) {
  vec2 m = mod(c, 8.0);
  float x = m.x;
  float y = m.y;
  float xy = mod(x + y, 2.0);          // bit0 of (x ^ y)
  float xy1 = mod(floor((x + y) * 0.5 + 0.0) , 2.0); // placeholder replaced below
  // Proper bit extraction of x^y and y:
  float xb0 = mod(x, 2.0),  xb1 = mod(floor(x / 2.0), 2.0), xb2 = floor(x / 4.0);
  float yb0 = mod(y, 2.0),  yb1 = mod(floor(y / 2.0), 2.0), yb2 = floor(y / 4.0);
  float a0 = abs(xb0 - yb0);  // (x^y) bit0
  float a1 = abs(xb1 - yb1);  // (x^y) bit1
  float a2 = abs(xb2 - yb2);  // (x^y) bit2
  // interleave: y-bits and (x^y)-bits, then reverse -> 32*a0 + 16*yb0 + 8*a1 + 4*yb1 + 2*a2 + yb2
  return (32.0 * a0 + 16.0 * yb0 + 8.0 * a1 + 4.0 * yb1 + 2.0 * a2 + yb2) / 64.0;
}

vec3 dither(vec2 pixelCoord, vec3 color) {
  float threshold = bayer8(pixelCoord) - 0.25;
  float stepv = 1.0 / (colorNum - 1.0);
  color += threshold * stepv;
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  // Same coordinate space as the original wave shader
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / resolution;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

  float f = pattern(uv);

  if (mouseActive > 0.5) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }

  vec3 col = mix(vec3(0.0), waveColor, f);

  // Original dither ran on the pixelated buffer; we already render one sample per block,
  // so dither directly on the drawing-buffer pixel grid.
  col = dither(floor(fragCoord / pixelSize), col);

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  SCENE                                                              */
/* ------------------------------------------------------------------ */

interface SceneProps {
  waveSpeed: number;
  waveFrequency: number;
  waveAmplitude: number;
  waveColor: [number, number, number];
  colorNum: number;
  disableAnimation: boolean;
  enableMouseInteraction: boolean;
  mouseRadius: number;
  fps: number;
  mouseRef: React.MutableRefObject<{ x: number; y: number; active: boolean }>;
}

function Scene({
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  waveColor,
  colorNum,
  disableAnimation,
  enableMouseInteraction,
  mouseRadius,
  fps,
  mouseRef,
}: SceneProps) {
  const { gl, size, invalidate } = useThree();
  const acc = useRef(0);
  const clock = useRef(0);
  const smooth = useRef(new THREE.Vector2(0, 0));

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      waveSpeed: { value: waveSpeed },
      waveFrequency: { value: waveFrequency },
      waveAmplitude: { value: waveAmplitude },
      waveColor: { value: new THREE.Color(...waveColor) },
      mousePos: { value: new THREE.Vector2(0, 0) },
      mouseActive: { value: 0 },
      mouseRadius: { value: mouseRadius },
      colorNum: { value: colorNum },
      pixelSize: { value: 1 },
    }),
    // created once, synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Sync props -> uniforms only when they change
  useEffect(() => {
    uniforms.waveSpeed.value = waveSpeed;
    uniforms.waveFrequency.value = waveFrequency;
    uniforms.waveAmplitude.value = waveAmplitude;
    uniforms.waveColor.value.set(...waveColor);
    uniforms.mouseRadius.value = mouseRadius;
    uniforms.colorNum.value = colorNum;
    invalidate();
  }, [waveSpeed, waveFrequency, waveAmplitude, waveColor, mouseRadius, colorNum, uniforms, invalidate]);

  // Resolution follows the real (low-res) drawing buffer
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    uniforms.resolution.value.set(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr)
    );
    invalidate();
  }, [size, gl, uniforms, invalidate]);

  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 1 / fps) return;
    const dt = acc.current;
    acc.current = 0;

    if (!disableAnimation) {
      clock.current += dt;
      uniforms.time.value = clock.current; // shader multiplies by waveSpeed, like the original
    }

    if (enableMouseInteraction) {
      const m = mouseRef.current;
      const res = uniforms.resolution.value;
      // target in drawing-buffer pixels (top-down y, matches original mouse math)
      const tx = m.x * res.x;
      const ty = m.y * res.y;
      smooth.current.x += (tx - smooth.current.x) * 0.3;
      smooth.current.y += (ty - smooth.current.y) * 0.3;
      uniforms.mousePos.value.copy(smooth.current);
      uniforms.mouseActive.value = m.active ? 1 : 0;
    } else {
      uniforms.mouseActive.value = 0;
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  PUBLIC COMPONENT                                                   */
/* ------------------------------------------------------------------ */

interface DitherProps {
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  waveColor?: [number, number, number];
  colorNum?: number;
  /** One dither "pixel" in CSS px. The canvas is rendered at 1/pixelSize resolution. */
  pixelSize?: number;
  disableAnimation?: boolean;
  enableMouseInteraction?: boolean;
  mouseRadius?: number;
  /** Max frames per second (default adapts to device). */
  maxFps?: number;
}

export default function Dither({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.5, 0.5, 0.5],
  colorNum = 4,
  pixelSize = 2,
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 1,
  maxFps,
}: DitherProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, active: false });

  const [ready, setReady] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [profile, setProfile] = useState({ fps: 30, mouse: true, weak: false });

  // Device profile (once)
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 4;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const weak = cores <= 4 || mem <= 4 || coarse || window.innerWidth < 768;

    setProfile({
      weak,
      fps: maxFps ?? (weak ? 24 : 30),
      mouse: !coarse,
    });
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setReady(true);
  }, [maxFps]);

  // Pause when the tab is hidden
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Pause when the canvas is off-screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [ready]);

  // Pointer tracking without raycasting
  useEffect(() => {
    if (!enableMouseInteraction || !profile.mouse) return;
    const el = wrapRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - r.left) / r.width;
      mouseRef.current.y = (e.clientY - r.top) / r.height; // top-down, same as original
      mouseRef.current.active = true;
    };
    const onLeave = () => {
      mouseRef.current.active = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [enableMouseInteraction, profile.mouse]);

  if (!ready) return <div ref={wrapRef} className="w-full h-full" />;

  // Render at 1/pixelSize resolution. Weak devices go one step chunkier.
  // The original already snapped to pixelSize blocks, so the look is preserved.
  const effectivePixel = Math.max(1, pixelSize) * (profile.weak ? 1.5 : 1);
  const dpr = 1 / effectivePixel;

  const animate = tabVisible && inView && !reduceMotion && !disableAnimation;

  return (
    <div ref={wrapRef} className="w-full h-full">
      <Canvas
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
        dpr={dpr}
        frameloop={animate ? 'always' : 'demand'}
        camera={{ position: [0, 0, 1] }}
        gl={{
          antialias: false,
          alpha: false,
          depth: false,
          stencil: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        flat
      >
        <Scene
          waveSpeed={waveSpeed}
          waveFrequency={waveFrequency}
          waveAmplitude={waveAmplitude}
          waveColor={waveColor}
          colorNum={colorNum}
          disableAnimation={!animate}
          enableMouseInteraction={enableMouseInteraction && profile.mouse}
          mouseRadius={mouseRadius}
          fps={profile.fps}
          mouseRef={mouseRef}
        />
      </Canvas>
    </div>
  );
}