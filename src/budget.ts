/**
 * Render-budget schedule (pure, unit-tested). Everything expensive is mounted only while it can be seen,
 * and the sun's shadow frustum is fitted to each scene (tight frustum = sharper shadows from a smaller map,
 * fewer shadow casters drawn). Times come from the audio-derived timeline.
 */
import {SCENES, T} from './timeline';
import {weather} from './tracks';

export const UNDERGROUND = {from: T.dive - 0.02, to: 44.9};
export const undergroundMounted = (t: number) => t >= UNDERGROUND.from && t < UNDERGROUND.to;
export const stationAboveMounted = (t: number) => t >= 44.45;
export const hangarMounted = (t: number) => t >= T.hangar - 0.05;
export const hangarLightOn = (t: number) => t >= 53.2;
export const rainMounted = (t: number) => weather(t).rain > 0.01;
export const debrisActive = (t: number) => (t >= T.touch && t <= T.sinkEnd + 1.0) || (t >= 10.3 && t <= 12.7) || (t >= T.pour && t <= T.poured + 1.0);
export const hoseMounted = (t: number) => t >= 45.45 && t < 47.4;
/** point lights are the most expensive thing per lit pixel: never more than one at a time */
export const pointLightCount = (t: number) => (undergroundMounted(t) ? 1 : 0) + (hangarLightOn(t) ? 1 : 0);

export interface ShadowFit {
  cx: number;
  cz: number;
  ext: number;
}
const S = (i: number) => SCENES[i];
/** [start, end, centre x, centre z, half-extent (m)] */
const SHADOW_TABLE: [number, number, number, number, number][] = [
  [S(0).start, S(0).end, 0, 2, 40],
  [S(1).start, S(1).end, 0, 0, 22],
  [S(2).start, S(2).end, 0, 0, 24],
  [S(3).start, S(3).end, -4, 2, 44],
  [S(4).start, S(4).end, 12, 8, 44],
  [S(5).start, S(5).end, -7, 5, 28],
  [S(6).start, S(6).end, 10, -4, 38],
  [S(7).start, 1e9, 4, -10, 64],
];
export function shadowFit(t: number): ShadowFit {
  const r = SHADOW_TABLE.find((e) => t >= e[0] && t < e[1]) ?? SHADOW_TABLE[SHADOW_TABLE.length - 1];
  return {cx: r[2], cz: r[3], ext: r[4]};
}
export const SHADOW_MAP = 1536;
/** sun direction (unnormalised) */
export const SUN_DIR: [number, number, number] = [34, 64, 28];
export const BLADE_COUNT = {near: 2600, far: 900};
export const RAIN_COUNT = 1100;
export const AIRFLOW_COUNT = 110;
export const SPECK_COUNT = 90;
