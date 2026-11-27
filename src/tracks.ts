import {clamp, easeOut, lerp, noise1, norm3, prog, pulse, ramp, sampleTrack, smooth, sub3, len3, dot3, add3, mul3, Key, V3} from './math';
import {DURATION_IN_FRAMES, FPS, T, TOTAL_SECONDS} from './timeline';
import {HELI_YAW_INTO_WIND, HANGAR} from './layout';

const K = (t: number, v: number[], extra: Partial<Key> = {}): Key => ({t, v, ...extra});
const deg = (d: number) => (d * Math.PI) / 180;
const Y = HELI_YAW_INTO_WIND;

/* =====================================================================
 * HELICOPTER  v = [x, y, z, yaw, pitch, roll, rpm]   (y = skid bottom)
 * ===================================================================== */
export const HELI_KEYS: Key[] = [
  // scene 1: sudden entrance, hover, slight descent
  K(0, [11, 11, 12, -2.3, 0.16, 0.1, 1]),
  K(1.0, [3.5, 8, 5, -1.9, 0.08, 0.04, 1]),
  K(2.3, [0.4, 6.2, 1, Y, 0, 0, 1]),
  K(3.6, [0, 3.6, 0, Y, 0, 0, 1], {stop: true}),
  // scene 2: lifts aside while the H is marked, returns, touches down and sinks
  K(4.45, [9, 8, -2, -1.2, 0.1, -0.05, 1]),
  K(5.7, [10, 8.5, -2, Y, 0, 0, 1]),
  K(6.4, [1.5, 6, 0, Y, 0.05, 0, 1]),
  K(7.2, [0, 3, 0, Y, 0, 0, 1]),
  K(T.touch, [0, 0, 0, Y, 0, 0, 1], {stop: true}),
  K(T.touch + 0.9, [0, -0.2, 0, Y, 0, 0.02, 0.9]),
  K(T.sinkEnd, [0, -0.32, 0, Y, 0, 0.03, 0.75], {stop: true}),
  K(10.03, [0, -0.32, 0, Y, 0, 0.03, 0.75], {stop: true}),
  // scene 3: leaves during construction, returns and lands on the new pad
  K(10.9, [0, 3, 0, Y, 0, 0, 1]),
  K(11.9, [12, 11, 8, -1.2, 0.1, 0, 1]),
  K(13, [26, 22, 30, -0.8, 0.1, 0, 1]),
  K(16, [28, 24, 34, -2.3, 0.1, 0, 1]),
  K(16.8, [14, 9, 12, -2.2, 0.1, 0, 1]),
  K(17.6, [5, 5, 4, -1.8, 0.08, 0, 1]),
  K(18.1, [1.2, 2.2, 0.5, Y, 0.03, 0, 1]),
  K(18.45, [0, 0, 0, Y, 0, 0, 1], {stop: true}),
  // scene 4: rotor speeds up on the ground
  K(18.9, [0, 0, 0, Y, 0, 0, 1.15]),
  K(20, [0, 0, 0, Y, 0, 0, 1.3]),
  K(24.5, [0, 0, 0, Y, 0, 0, 1.3]),
  K(26.8, [0, 0, 0, Y, 0, 0, 0.75]),
  K(29.34, [0, 0, 0, Y, 0, 0, 0.6]),
  // scene 5: takes off, flies away east, turns, approaches INTO the wind (-x), lands
  K(29.9, [0, 0.5, 0, Y, 0, 0, 0.9]),
  K(30.7, [1, 5, 0, -1.3, 0, 0, 1]),
  K(31.6, [10, 9.5, 3, 1.2, 0.12, -0.05, 1]),
  K(32.4, [28, 12, 6, 1.5, 0.1, 0, 1]),
  K(33.0, [35, 12, 7.5, 0, 0, 0.15, 1]),
  K(33.8, [30, 11, 6.5, Y, 0.02, 0, 1]),
  K(34.4, [24, 10, 5.5, Y, 0.08, 0, 1]),
  K(35.5, [17, 8.5, 5, Y, 0.1, 0, 1]),
  K(36.4, [8, 6, 3, Y, 0.1, 0, 1]),
  K(37.0, [3, 3.2, 1, Y, 0.06, 0, 0.95]),
  K(37.65, [0, 0, 0, Y, 0, 0, 0.8], {stop: true}),
  // scene 6: engine winds down (low fuel)
  K(38.0, [0, 0, 0, Y, 0, 0, 0.55]),
  K(39.5, [0, 0, 0, Y, 0, 0, 0.35]),
  K(40.7, [0, 0, 0, Y, 0, 0, 0.12]),
  K(41.9, [0, 0, 0, Y, 0, 0, 0], {stop: true}),
  // scene 7: ground handling -> hangar
  K(53.55, [0, 0, 0, Y, 0, 0, 0], {stop: true}),
  K(54.1, [0, 0, 0, 2.1, 0, 0, 0]),
  K(54.5, [4.5, 0, -2.8, 1.95, 0, 0, 0]),
  K(54.95, [10.5, 0, -6.4, 1.65, 0, 0, 0]),
  K(55.3, [17, 0, -8, 1.57, 0, 0, 0]),
  K(55.5, [20.8, 0, -8, 1.57, 0, 0, 0]),
  K(56.2, [21, 0, -8, 1.57, 0, 0, 0], {stop: true}),
  K(TOTAL_SECONDS + 1, [21, 0, -8, 1.57, 0, 0, 0], {stop: true}),
];

export interface HeliState {
  pos: V3;
  yaw: number;
  pitch: number;
  roll: number;
  rpm: number;
  airborne: boolean;
}
export function heliState(t: number): HeliState {
  const v = sampleTrack(HELI_KEYS, t);
  const air = clamp((v[1] - 0.4) / 1.2);
  // gusty wobble while flying; stronger during the windsock approach
  const gust = 1 + 1.8 * pulse(t, 29.5, 31, 36.6, 37.4);
  const wob = air * gust;
  const pos: V3 = [v[0] + 0.1 * wob * noise1(t * 1.1, 1), v[1] + 0.09 * wob * noise1(t * 1.7, 2), v[2] + 0.1 * wob * noise1(t * 0.9, 3)];
  return {
    pos,
    yaw: v[3] + 0.02 * wob * noise1(t * 1.3, 4),
    pitch: v[4] + 0.018 * wob * noise1(t * 1.9, 5),
    roll: v[5] + 0.03 * wob * noise1(t * 1.5, 6),
    rpm: Math.max(0, v[6]),
    airborne: v[1] > 0.4,
  };
}

/* rotor angle integrates rpm so blades never jump; parks aligned with the tail after shutdown */
let ROTOR: Float64Array | null = null;
export const OMEGA_FULL = 24; // rad/s at rpm = 1
export function rotorAngle(frame: number): number {
  if (!ROTOR) {
    ROTOR = new Float64Array(DURATION_IN_FRAMES + 2);
    let a = 0;
    let parkFrame = -1;
    let parkOffset = 0;
    for (let f = 0; f < ROTOR.length; f++) {
      const rpm = heliState(f / FPS).rpm;
      if (parkFrame < 0 && f / FPS > 38 && rpm < 0.2) parkFrame = f;
      if (parkFrame >= 0 && parkOffset === 0 && rpm < 0.001) {
        parkOffset = Math.round(a / Math.PI) * Math.PI - a;
      }
      ROTOR[f] = a;
      a += (rpm * OMEGA_FULL) / FPS;
    }
    // distribute the parking correction across the final slow-down
    let acc = parkOffset;
    for (let f = parkFrame; f < ROTOR.length && parkFrame >= 0; f++) {
      const rpm = heliState(f / FPS).rpm;
      const w = 1 - clamp(rpm / 0.2);
      ROTOR[f] += acc * w;
    }
    void acc;
  }
  return ROTOR[clamp(Math.round(frame), 0, ROTOR.length - 1)];
}

/* =====================================================================
 * LOOSE GARDEN ITEMS (blown outward by rotor wash in scene 4)
 * ===================================================================== */
export interface Item {
  id: string;
  kind: 'table' | 'chair' | 'umbrella' | 'trampoline' | 'ball' | 'pot' | 'bin' | 'barrow';
  x: number;
  z: number;
  dir: number; // degrees, direction of travel in the x/z plane (atan2(z,x))
  dist: number;
  ts: number;
  dur: number;
  hop: number;
  nb: number;
  spin: V3; // rad/s
  y0: number;
}
export const ITEMS: Item[] = [
  {id: 'table', kind: 'table', x: -7.05, z: -2.57, dir: 200, dist: 11, ts: T.spin + 1.1, dur: 4.5, hop: 0.12, nb: 2, spin: [0, 0.15, 0], y0: 0},
  {id: 'chair1', kind: 'chair', x: -8.3, z: -3.8, dir: 195, dist: 14, ts: T.spin + 0.9, dur: 3.6, hop: 1.4, nb: 2, spin: [1.3, 1.9, 0.8], y0: 0},
  {id: 'chair2', kind: 'chair', x: -5.8, z: -3.8, dir: 215, dist: 16, ts: T.spin + 1.0, dur: 3.8, hop: 1.9, nb: 2, spin: [-1.5, 1.2, 1.0], y0: 0},
  {id: 'chair3', kind: 'chair', x: -8.3, z: -1.3, dir: 185, dist: 18, ts: T.spin + 1.2, dur: 3.9, hop: 1.6, nb: 3, spin: [1.1, -1.7, 0.9], y0: 0},
  {id: 'chair4', kind: 'chair', x: -5.8, z: -1.3, dir: 225, dist: 13, ts: T.spin + 0.8, dur: 3.4, hop: 1.2, nb: 2, spin: [-0.9, 2.1, 1.4], y0: 0},
  {id: 'umbrella', kind: 'umbrella', x: -7.05, z: -2.57, dir: 215, dist: 24, ts: T.spin + 0.8, dur: 3.8, hop: 4.5, nb: 2, spin: [2.2, 3.1, 1.3], y0: 0},
  {id: 'trampoline', kind: 'trampoline', x: 3, z: 8, dir: 78, dist: 14, ts: T.spin + 1.0, dur: 4.2, hop: 0.7, nb: 1, spin: [0.35, 0, 0.22], y0: 0},
  {id: 'ball', kind: 'ball', x: 3.5, z: 6.5, dir: 100, dist: 28, ts: T.spin + 0.7, dur: 4.4, hop: 2.5, nb: 4, spin: [3, 1, 2], y0: 0.3},
  {id: 'pot1', kind: 'pot', x: -6.2, z: 1.5, dir: 185, dist: 9, ts: T.spin + 1.3, dur: 3.2, hop: 0.5, nb: 2, spin: [0.8, 0, 0.6], y0: 0},
  {id: 'pot2', kind: 'pot', x: -5.5, z: 3.2, dir: 183, dist: 12, ts: T.spin + 1.4, dur: 3.4, hop: 0.6, nb: 2, spin: [0.5, 0.4, -0.7], y0: 0},
  {id: 'bin', kind: 'bin', x: -4.5, z: -5.5, dir: 235, dist: 12, ts: T.spin + 1.5, dur: 3.6, hop: 0.9, nb: 2, spin: [1.1, 0.5, 0.2], y0: 0},
  {id: 'barrow', kind: 'barrow', x: 7.8, z: 2.1, dir: 12, dist: 11, ts: T.spin + 1.6, dur: 3.8, hop: 0.4, nb: 1, spin: [0, 0.3, 0.2], y0: 0},
];
export function itemState(it: Item, t: number): {pos: V3; rot: V3} {
  const u = prog(t, it.ts, it.ts + it.dur);
  const f = smooth(u) * 0.6 + easeOut(u) * 0.4;
  const a = deg(it.dir);
  const y = it.y0 + it.hop * Math.abs(Math.sin(Math.PI * it.nb * u)) * Math.pow(1 - u, 0.7);
  const g = (u - (u * u) / 2) * it.dur;
  return {
    pos: [it.x + Math.cos(a) * it.dist * f, y, it.z + Math.sin(a) * it.dist * f],
    rot: [it.spin[0] * g, it.spin[1] * g, it.spin[2] * g],
  };
}

/* =====================================================================
 * WEATHER
 * ===================================================================== */
export interface Weather {
  rain: number;
  dark: number;
  flash: number;
  wet: number;
}
export const LIGHTNING = [48.95, 50.4, 52.75];
export function weather(t: number): Weather {
  const rain = ramp(t, 47.6, 49.0) * (1 - ramp(t, 56.4, 57.7));
  const dark = pulse(t, 47.4, 49.2, 56.3, 58.0);
  let flash = 0;
  for (const l of LIGHTNING) flash = Math.max(flash, t >= l ? Math.exp(-(t - l) * 11) * (0.6 + 0.4 * Math.sin((t - l) * 60) ** 2) : 0);
  const wet = Math.max(ramp(t, 47.8, 49.8) * (1 - ramp(t, 58, 65.4) * 0.65), 0);
  return {rain, dark, flash, wet};
}

/* =====================================================================
 * CONSTRUCTION / STATE PROGRESS
 * ===================================================================== */
export const REBAR_START = T.grid + 0.55;
export const REBAR_STEP = 0.05;
export const REBAR_COUNT = 18;
export function pad(t: number) {
  return {
    hDraw: ramp(t, T.hStart, T.hStart + 2.0),
    grassScale: 1 - ramp(t, 10.3, 10.95),
    soilTop: -1.0 * ramp(t, 10.45, 11.45),
    gravel: ramp(t, 11.45, 12.1),
    formwork: ramp(t, 11.95, 12.35),
    concreteTop: lerp(-0.72, 0.02, smooth(prog(t, T.pour + 0.1, T.poured))),
    concreteOn: t >= T.pour + 0.05,
    cure: ramp(t, T.poured, 17.0),
    explode: pulse(t, 15.7, 16.3, 16.9, 17.3),
    hPaint: ramp(t, 16.9, 17.5),
    cutaway: t >= T.touch + 0.44 && t < 10.0,
    sink: clamp(-heliState(t).pos[1] / 0.32),
    excavator: {on: t > 9.4 && t < 12.5, x: lerp(30, 8.6, ramp(t, 9.4, 10.0)) + 24 * ramp(t, 11.75, 12.35), dig: t},
    truck: {on: t > 12.35 && t < 16.9, x: lerp(34, 8.4, ramp(t, 12.4, 13.2)) + 26 * ramp(t, 15.7, 16.7)},
    chute: ramp(t, T.pour + 0.1, T.pour + 0.35) * (1 - ramp(t, T.poured - 0.05, T.poured + 0.2)),
  };
}
export function station(t: number) {
  return {
    patchOpacity: 1 - 0.87 * pulse(t, T.dive, T.dive + 0.3, 44.25, 44.65),
    underground: ramp(t, T.dive + 0.05, T.dive + 0.9),
    flow: ramp(t, 42.7, 43.1) * (1 - ramp(t, 47.0, 47.3)),
    slab: ramp(t, 44.5, 44.85),
    posts: ramp(t, 44.65, 45.05),
    roof: ramp(t, 44.85, 45.25),
    dispenser: ramp(t, 44.75, 45.15),
    safety: ramp(t, 45.1, 45.6),
    hose: ramp(t, 45.5, 45.95),
    refuel: ramp(t, 45.95, 46.2) * (1 - ramp(t, 47.2, 47.3)),
    gaugeVisible: (t >= T.lowFuel - 0.2 && t < T.dive) || (t >= 45.9 && t < 47.3),
    fuel: t < T.dive ? 0.06 + 0.02 * Math.sin(t * 5) : lerp(0.06, 0.88, ramp(t, 45.95, 47.2)),
  };
}
export function windsock(t: number) {
  return {pole: ramp(t, T.sock, T.sock + 0.55), inflate: ramp(t, T.sock + 0.35, T.sock + 1.1)};
}
export function safetyZone(t: number) {
  return {ring: ramp(t, T.clear + 0.3, T.zone + 1.6), cones: ramp(t, T.zone + 0.9, T.zone + 1.9), disc: ramp(t, T.clear + 0.3, T.zone + 1.9)};
}
export function airflow(t: number) {
  // visible while rotor winds up in scene 4, softly in other flying moments
  return ramp(t, T.spin - 0.1, T.spin + 0.5) * (1 - ramp(t, 24.2, 25.2));
}
export function hangar(t: number) {
  const B = T.hangar;
  const open1 = ramp(t, 53.7, 54.3) - ramp(t, 55.5, 56.15);
  const open2 = ramp(t, 57.4, 58.4);
  return {
    floor: ramp(t, B, B + 0.3),
    columns: ramp(t, B + 0.1, B + 0.8),
    rafters: ramp(t, B + 0.6, B + 1.25),
    roof: ramp(t, B + 1.05, B + 1.65),
    walls: ramp(t, B + 1.25, B + 1.85),
    doors: ramp(t, B + 1.6, B + 1.95),
    open: clamp(open1 + open2),
    lights: ramp(t, 53.3, 53.9),
    tug: ramp(t, 52.8, 53.55),
    dolly: ramp(t, 53.3, 53.6),
  };
}
export function tugState(t: number) {
  // drives in from the south-west, then stays rigidly connected to the nose
  const h = heliState(t);
  const connectT = 53.55;
  const tow: V3 = [h.pos[0] + Math.sin(h.yaw) * 3.7, 0, h.pos[2] + Math.cos(h.yaw) * 3.7];
  const home: V3 = [-5.9, 0, 0];
  const far: V3 = [-14, 0, 10];
  const u = easeOut(prog(t, 52.6, connectT));
  const pos: V3 = t < connectT ? [lerp(far[0], home[0], u), 0, lerp(far[2], home[2], u)] : tow;
  const yaw = t < connectT ? lerp(-0.6, h.yaw, u) : h.yaw;
  return {pos, yaw};
}

/* =====================================================================
 * CAMERA   v = [px,py,pz, lx,ly,lz, fov]
 * ===================================================================== */
function followKeys(t0: number, t1: number, step: number, fn: (t: number) => number[]): Key[] {
  const out: Key[] = [];
  for (let t = t0; t < t1 - 1e-6; t += step) out.push(K(+t.toFixed(3), fn(t)));
  out.push(K(t1, fn(t1)));
  return out;
}
const cutFirst = (k: Key[]): Key[] => [{...k[0], cut: true}, ...k.slice(1)];
const umb = ITEMS.find((i) => i.id === 'umbrella')!;
const umbPos = (t: number) => itemState(umb, t).pos;
const ORBIT_C: V3 = [5, 0, -10];
const orbit = (t: number) => {
  const phi = deg(100 + 30 * smooth(prog(t, T.base, 65.2)));
  const rad = 78;
  return [ORBIT_C[0] + rad * Math.cos(phi), 54 - 2 * smooth(prog(t, 63, 65.4)), ORBIT_C[2] + rad * Math.sin(phi), ORBIT_C[0], 0, ORBIT_C[2], 56 - 3 * smooth(prog(t, 63.5, 65.4))];
};
/** fast orbit around the finished pad while the heli lands */
const padOrbit = (t: number) => {
  const h = heliState(t).pos;
  const u = smooth(prog(t, 17.3, 18.56));
  const a = deg(lerp(185, 40, u));
  const r = lerp(10, 8.5, u);
  return [h[0] + r * Math.cos(a), 2.6 + 0.3 * h[1], h[2] + r * Math.sin(a), h[0], h[1] + 1.3, h[2], 44];
};
/** three-quarter follow of the heli as it aligns into the wind and lands */
const landingFollow = (t: number) => {
  const h = heliState(t).pos;
  const u = smooth(prog(t, 36.2, 37.65));
  return [h[0] + lerp(1, -7, u), 2.4 + 0.35 * h[1], h[2] + 8.5, h[0], h[1] + 1.3, h[2], 44];
};

export const CAMERA_KEYS: Key[] = [
  // S1 hook: aerial push-in -> low three-quarter -> skid close-up
  K(0, [-6, 34, 30, 0, 2, -4, 48]),
  K(1.3, [-5, 15, 22, 1, 6, 2, 46]),
  K(2.3, [7, 1.9, 9, 0, 4.2, 0.4, 42]),
  K(3.05, [2.6, 2.8, 3.2, 0, 3.7, 0.2, 36]),
  K(3.59, [2.0, 3.0, 2.4, 0, 3.6, 0, 34]),
  // S2 mud: top-down H -> fast tilt -> sinking-skid cutaway
  K(3.6, [0, 22, 4, 0, 0, 0, 40], {cut: true}),
  K(5.9, [0.3, 16, 6, 0, 0, 0, 40]),
  K(6.4, [7, 6, 13, 0, 4.5, 0, 46]),
  K(7.4, [5.4, 1.7, 6.5, 0, 1.4, 0, 40]),
  K(T.touch - 0.1, [4.6, 0.9, 5.2, 0, 0.5, 0.4, 34]),
  K(T.touch + 0.4, [4.4, 0.8, 5.0, 0, 0.3, 0.5, 33], {stop: true}),
  K(T.touch + 0.45, [1.4, 0.3, 3.5, 1.0, -0.25, 1.0, 36], {cut: true}),
  K(T.touch + 1.2, [1.1, 0.22, 3.1, 0.9, -0.28, 1.0, 34]),
  K(T.sinkEnd, [0.8, 0.2, 2.8, 0.8, -0.33, 1.0, 32]),
  // S3 pad: top-down dig -> rebar macro -> pour -> exploded layers -> orbit as heli lands
  K(10.03, [0, 24, 1.8, 0, 0, 0, 42], {cut: true}),
  K(11.4, [0, 19, 3.2, 0, -0.3, 0, 42]),
  K(12.15, [2.5, 1.6, 3.6, -1.0, -0.45, 0.6, 34]),
  K(12.6, [0.6, 1.25, 2.9, -1.6, -0.45, 0.4, 32]),
  K(13.0, [-1, 1.0, 2.2, -2.2, -0.45, 0.2, 30], {stop: true}),
  K(13.35, [5, 14, 11, 0, -0.2, 0, 46]),
  K(13.95, [2.6, 1.7, 2.3, -1.0, -0.4, -0.2, 36]),
  K(14.8, [-3, 3.4, 6, 0, -0.3, 0, 42]),
  K(15.6, [0.6, 5.5, 7.5, 0, -0.5, 0, 46]),
  K(16.0, [10, 3.5, 9, 0, 1.2, 0, 46]),
  K(16.9, [-9, 4, 8, 0, 1.2, 0, 46]),
  ...followKeys(17.3, 18.56, 0.21, padOrbit),
  // S4 safety: low rotor shot -> sliding furniture -> follow umbrella -> pull up to aerial
  K(T.spin - 0.11, [3.2, 0.8, 5.5, 0, 3.3, 0, 46], {cut: true}),
  K(19.55, [2.4, 1.0, 4.4, 0, 3.2, 0, 40]),
  K(19.9, [-2, 2.4, 14, 3.0, 1.0, 9.5, 50], {cut: true}),
  K(20.35, [-1.4, 2.6, 13.5, 3.6, 1.4, 11, 50], {stop: true}),
  ...followKeys(20.65, 22.65, 0.25, (t) => {
    const u = umbPos(t);
    return [u[0] + 6, u[1] + 1.8, u[2] + 6, u[0], u[1], u[2], 44];
  }),
  K(23.7, [0, 38, 25, 0, 0, -2, 52]),
  K(26.5, [3, 41, 25, -1, 0, -2, 52]),
  K(29.34, [9, 38, 22, -1, 0, -3, 52]),
  // S5 windsock: heli buffeted -> pole rises -> fabric macro -> whip to heli -> landing 3/4
  K(30.2, [-4, 5, 15, 1, 3, 0, 50]),
  K(31.5, [4, 6.5, 20, 9, 9, 3, 46]),
  K(32.7, [12, 6, 22, 27, 11.5, 6, 42]),
  K(33.55, [14, 5, 22, 33, 11, 7.5, 40]),
  K(T.sock, [12.8, 1.0, 13.5, 11, 3.2, 9, 54], {cut: true}),
  K(34.25, [12.6, 3.8, 14.0, 12.2, 5.6, 9.2, 48]),
  K(34.8, [12.9, 6.2, 14.2, 12.9, 6.1, 9, 44]),
  K(35.35, [12.9, 6.2, 14.2, 12.9, 6.1, 9, 44], {stop: true}),
  K(35.65, [12.9, 6.2, 14.2, 18.5, 8.7, 4.5, 44], {stop: true}),
  ...followKeys(36.2, 37.9, 0.2, landingFollow),
  // S6 fuel: gauge -> dive below lawn -> cutaway -> macros -> back above ground -> refuel -> pull back
  K(37.92, [-6.5, 2.3, 8, -1.8, 1.9, 0.8, 44], {cut: true}),
  K(39.4, [-4.6, 2.4, 6.2, -3.2, 2.4, 1.9, 38]),
  K(40.85, [-3.7, 2.5, 5.2, -3.3, 2.45, 1.9, 32]),
  K(T.dive, [-13.5, 6.5, 20, -14, 0, 10, 56], {cut: true}),
  K(42.3, [-14, -1.6, 17.8, -15.2, -2.8, 11, 56]),
  K(42.9, [-9.8, -1.4, 15.5, -13.5, -2.5, 10, 52]),
  K(43.3, [-13.3, -1.0, 10.4, -13.2, -1.8, 7.4, 40]),
  K(43.85, [-13.3, -1.0, 10.4, -13.2, -1.8, 7.4, 40]),
  K(44.25, [-10.7, -0.9, 10.4, -10.7, -1.75, 7.4, 44]),
  K(44.55, [-9.5, -0.6, 12, -9.8, -1.2, 9.5, 44]),
  K(44.9, [-4.6, 2.4, 14, -10.5, 1.0, 9.7, 52]),
  K(45.7, [-6.3, 1.7, 13.2, -9.8, 1.1, 9.5, 40]),
  K(46.05, [-6.3, 1.7, 13.2, -9.8, 1.1, 9.5, 40], {stop: true}),
  K(46.55, [-14.5, 3.2, 15.5, -3, 1.2, 4.5, 50]),
  K(47.29, [-8, 7, 31, -7.5, 0.8, 5.5, 63]),
  // S7 hangar: storm -> rain macro -> side track reveals build -> doors -> tow -> inside view
  K(47.31, [6, 5.5, 14, 0, 2.2, 0, 46], {cut: true}),
  K(48.15, [-3.4, 2.1, 3.0, -1.1, 1.6, 0, 32]),
  K(49.5, [-2.6, 2.0, 2.0, -1.1, 1.6, -0.2, 30]),
  K(50.1, [-4, 3.2, 12, 0, 1.8, 0, 46]),
  K(51.3, [2, 3.5, 12, 8, 3, -3, 46]),
  K(53.2, [24, 4.5, 12, 21, 3.5, -8, 48]),
  K(53.35, [8.5, 0.7, -3.2, 14.2, 3.2, -8, 56], {cut: true}),
  K(54.1, [8.5, 0.8, -3.4, 14.2, 3.0, -8, 56]),
  ...cutFirst(
    followKeys(54.2, 55.4, 0.2, (t) => {
      const h = heliState(t).pos;
      return [h[0] - 5.5, 1.9, h[2] + 4.6, h[0] + 1.5, 1.6, h[2], 54];
    }),
  ),
  K(55.55, [27.2, 2.8, -8, 14, 2.8, -8, 56], {cut: true}),
  K(56.17, [27.2, 2.9, -8, 14, 2.9, -8, 54]),
  // S8 reveal: H close-up -> rapid pull-back -> rise -> orbit -> wide hold
  K(56.18, [1.4, 0.55, 2.5, 0, 0, 0.1, 38], {cut: true}),
  K(57.0, [1.8, 0.8, 3.2, 0, 0, 0, 38]),
  K(58.1, [7, 9, 16, 1, 0, -2, 46]),
  K(59.2, [12, 32, 44, 4, 0, -9, 52]),
  K(60.3, [15, 52, 63, 5, 0, -10, 56]),
  ...followKeys(T.base, 65.44, 0.4, orbit),
];

/* camera shake events: [time, amplitude(m), decay] */
const SHAKES: [number, number, number][] = [
  [T.touch + 0.02, 0.05, 7],
  [T.touch + 0.95, 0.045, 7],
  [T.sinkEnd - 0.1, 0.07, 6],
  [18.45, 0.03, 6],
  [LIGHTNING[0], 0.03, 8],
  [LIGHTNING[1], 0.03, 8],
  [REBAR_START + 0.5, 0.02, 9],
  [T.poured, 0.02, 7],
];
export function shake(t: number): V3 {
  let a = 0;
  for (const [t0, amp, k] of SHAKES) if (t >= t0) a += amp * Math.exp(-(t - t0) * k);
  return [a * Math.sin(t * 71), a * Math.sin(t * 93 + 1), a * 0.5 * Math.sin(t * 57 + 2)];
}

export interface Cam {
  pos: V3;
  look: V3;
  fov: number;
}
export function cameraRaw(t: number): Cam {
  const v = sampleTrack(CAMERA_KEYS, t);
  return {pos: [v[0], v[1], v[2]], look: [v[3], v[4], v[5]], fov: v[6]};
}
export function cameraAt(t: number): Cam {
  const c = cameraRaw(t);
  const s = shake(t);
  return {pos: add3(c.pos, s), look: c.look, fov: c.fov};
}
/** subtle motion blur strength (px) from view-direction and travel speed; cuts are ignored */
export function cameraBlur(t: number): number {
  const a = cameraRaw(t - 0.5 / FPS);
  const b = cameraRaw(t + 0.5 / FPS);
  const step = len3(sub3(b.pos, a.pos));
  if (step > 3) return 0;
  const da = norm3(sub3(a.look, a.pos));
  const db = norm3(sub3(b.look, b.pos));
  const ang = Math.acos(clamp(dot3(da, db), -1, 1)) * FPS;
  const speed = step * FPS;
  return clamp(0.9 * Math.max(0, ang - 0.9) + 0.045 * Math.max(0, speed - 14), 0, 4.2);
}
export const HANGAR_FOOT = {x0: HANGAR.x - HANGAR.w / 2, x1: HANGAR.x + HANGAR.w / 2, z0: HANGAR.z - HANGAR.d / 2, z1: HANGAR.z + HANGAR.d / 2};
void mul3;
