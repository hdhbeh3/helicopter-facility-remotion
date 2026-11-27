import type {V3} from './math';

/** Meters. +y up. Camera mostly looks toward -z (house is behind the pad). */
export const PAD_HALF = 4;
export const HOUSE = {x: -2, z: -30, w: 20, d: 10, h: 7};
export const HANGAR = {x: 21, z: -8, w: 14, d: 18, h: 7.5, ridge: 9.4, doorX: 14, doorW: 12};
export const STATION = {
  slab: {x: -13.5, z: 10, w: 9, d: 7},
  dispenser: [-9.8, 0, 9.5] as V3,
  /** underground cavity (matches the lawn hole) */
  hole: {x0: -23, x1: -5, z0: 3, z1: 19, depth: 7},
  tank: [-15.5, -3.2, 11.5] as V3,
  tankLen: 5.6,
  tankR: 1.2,
};
export const SOCK = {x: 11, z: 9, h: 6.5};
export const RING_R = 12;
/** wind blows toward +x */
export const WIND: V3 = [1, 0, 0];
export const HELI_YAW_INTO_WIND = -Math.PI / 2;
/** fuel cap in heli local space (left side, +x local) */
export const FUEL_PORT_LOCAL: V3 = [0.95, 1.3, -0.1];
export const NOSE_LOCAL: V3 = [0, 1.2, 2.25];

/** Underground fuel path (world coords) */
export const FUEL_PATH: V3[] = [
  [-15.3, -1.95, 9.0],
  [-15.3, -1.7, 7.4],
  [-9.8, -1.7, 7.4],
  [-9.8, -1.7, 9.5],
  [-9.8, 1.05, 9.5],
];

export function heliLocalToWorld(p: V3, yaw: number, local: V3): V3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [p[0] + local[0] * c + local[2] * s, p[1] + local[1], p[2] - local[0] * s + local[2] * c];
}
