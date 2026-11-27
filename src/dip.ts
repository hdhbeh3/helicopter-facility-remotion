import {clamp} from './math';
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const g = (u: number, s: number) => Math.exp(-(u * u) / (2 * s * s));
export const SINK_DEPTH = 0.32;
/** depth (m) the soft ground is pushed down at (x,z); skids lie along x at z = +-1 */
export function groundDip(x: number, z: number, sink: number): number {
  if (sink <= 0) return 0;
  const along = ss(-2.4, -1.8, x) * (1 - ss(1.8, 2.4, x));
  const across = Math.max(0.75 * g(z - 1, 0.18) + 0.25 * g(z - 1, 0.6), 0.75 * g(z + 1, 0.18) + 0.25 * g(z + 1, 0.6));
  return SINK_DEPTH * sink * along * across;
}
/** little squeezed-up rim of mud beside the trench */
export function groundRim(x: number, z: number, sink: number): number {
  const along = ss(-2.2, -1.7, x) * (1 - ss(1.7, 2.2, x));
  const r = Math.max(g(Math.abs(z - 1) - 0.42, 0.12), g(Math.abs(z + 1) - 0.42, 0.12));
  return 0.05 * sink * along * r;
}
