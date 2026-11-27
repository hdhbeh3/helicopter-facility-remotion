export type V3 = [number, number, number];

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const smoother = (t: number) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeOutBack = (t: number) => {
  t = clamp(t);
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** smooth ramp from a to b */
export const ramp = (t: number, a: number, b: number) => smooth(prog(t, a, b));
/** 0 -> 1 between a..b then 1 -> 0 between c..d */
export const pulse = (t: number, a: number, b: number, c: number, d: number) => ramp(t, a, b) * (1 - ramp(t, c, d));

export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** cheap smooth pseudo noise in [-1,1] */
export const noise1 = (t: number, seed = 0) =>
  (Math.sin(t * 1.0 + seed * 12.9898) * 0.5 + Math.sin(t * 2.3 + seed * 78.233) * 0.3 + Math.sin(t * 4.7 + seed * 37.719) * 0.2);

/* ---------- keyframe tracks (cubic Hermite, velocity-continuous) ---------- */

export interface Key {
  t: number;
  v: number[];
  /** zero velocity at this key (ease in/out) */
  stop?: boolean;
  /** hard cut: previous key's value is held until this key's time */
  cut?: boolean;
}

export function sampleTrack(keys: Key[], t: number): number[] {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t >= keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  if (k1.cut) return k0.v.slice();
  const dt = k1.t - k0.t;
  const u = (t - k0.t) / dt;
  const vel = (idx: number, side: -1 | 1): number[] => {
    const k = keys[idx];
    if (k.stop) return k.v.map(() => 0);
    const prev = keys[idx - 1];
    const next = keys[idx + 1];
    const usePrev = prev && !k.cut;
    const useNext = next && !next.cut;
    if (usePrev && useNext) return k.v.map((_, c) => (next.v[c] - prev.v[c]) / (next.t - prev.t));
    if (useNext) return k.v.map((_, c) => (next.v[c] - k.v[c]) / (next.t - k.t));
    if (usePrev) return k.v.map((_, c) => (k.v[c] - prev.v[c]) / (k.t - prev.t));
    return k.v.map(() => 0);
  };
  const m0 = vel(i, 1);
  const m1 = vel(i + 1, -1);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return k0.v.map((_, c) => h00 * k0.v[c] + h10 * dt * m0[c] + h01 * k1.v[c] + h11 * dt * m1[c]);
}
