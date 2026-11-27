/**
 * Camera framing test (pure math, no WebGL): projects named subjects through the
 * camera track at chosen times and reports normalized device coords.
 *   |x|,|y| <= 1 means on screen. "safe" = inside the central Shorts-safe area.
 * Exit code 1 if any REQUIRED subject is off screen or behind the camera.
 */
import {cameraAt, heliState, itemState, ITEMS} from '../src/tracks';
import {cross3, dot3, norm3, sub3, V3} from '../src/math';
import {WIDTH, HEIGHT} from '../src/timeline';
import {HANGAR, HOUSE, SOCK, STATION} from '../src/layout';

const aspect = WIDTH / HEIGHT;
export function project(t: number, p: V3) {
  const c = cameraAt(t);
  const f = norm3(sub3(c.look, c.pos));
  const r = norm3(cross3(f, [0, 1, 0]));
  const u = cross3(r, f);
  const d = sub3(p, c.pos);
  const zc = dot3(d, f);
  const tv = Math.tan((c.fov * Math.PI) / 360);
  return {x: dot3(d, r) / (zc * tv * aspect), y: dot3(d, u) / (zc * tv), z: zc};
}
const H = (t: number, l: V3 = [0, 1.3, 0]): V3 => {
  const h = heliState(t);
  return [h.pos[0] + l[0], h.pos[1] + l[1], h.pos[2] + l[2]];
};
const I = (id: string) => (t: number): V3 => {
  const s = itemState(ITEMS.find((i) => i.id === id)!, t).pos;
  return [s[0], s[1] + 0.5, s[2]];
};
type S = [number, string, V3 | ((t: number) => V3), boolean?];
const pt = (v: V3 | ((t: number) => V3), t: number) => (typeof v === 'function' ? v(t) : v);

const checks: S[] = [
  [0.9, 'S1 heli enters', (t) => H(t)],
  [1.8, 'S1 heli hover', (t) => H(t)],
  [3.3, 'S1 skids close-up', (t) => H(t, [0, 0.1, 0])],
  [4.8, 'S2 H marking (top-down)', [0, 0, 0]],
  [5.8, 'S2 H marking', [0, 0, 0]],
  [7.0, 'S2 heli descending', (t) => H(t)],
  [7.7, 'S2 heli near ground', (t) => H(t)],
  [7.95, 'S2 touchdown: skids meet ground', (t) => H(t, [0, 0.1, 0])],
  [8.3, 'S2 touchdown: skids sink (medium)', (t) => H(t, [0, 0.1, 0])],
  [8.6, 'S2 sinking skid cutaway', [0.9, -0.25, 1.0]],
  [9.6, 'S2 sinking skid cutaway', [0.8, -0.3, 1.0]],
  [10.6, 'S3 excavation', [0, -0.5, 0]],
  [12.5, 'S3 rebar macro', [-1.2, -0.45, 0.6]],
  [13.9, 'S3 concrete close-up', [-1, -0.4, -0.2]],
  [14.8, 'S3 concrete', [0, -0.3, 0]],
  [16.4, 'S3 exploded layers', [0, 1.2, 0]],
  [17.8, 'S3 heli lands', (t) => H(t)],
  [18.3, 'S3 heli lands', (t) => H(t)],
  [18.8, 'S4 rotor hub', [0, 2.9, 0]],
  [20.2, 'S4 trampoline', I('trampoline')],
  [21.2, 'S4 umbrella follow', I('umbrella')],
  [22.4, 'S4 umbrella follow', I('umbrella')],
  [25.0, 'S4 aerial pad', [0, 0, 0]],
  [28.5, 'S4 aerial ring E', [12, 0, 0]],
  [28.5, 'S4 aerial ring W', [-12, 0, 0]],
  [30.5, 'S5 heli lifts', (t) => H(t)],
  [31.6, 'S5 heli east', (t) => H(t)],
  [32.8, 'S5 heli far east', (t) => H(t)],
  [33.5, 'S5 heli turning', (t) => H(t)],
  [34.0, 'S5 windsock rising', [SOCK.x, 3, SOCK.z]],
  [34.9, 'S5 windsock fabric', [12.9, 6.1, SOCK.z]],
  [35.2, 'S5 windsock fabric', [12.9, 6.1, SOCK.z]],
  [36.0, 'S5 heli approach', (t) => H(t)],
  [36.8, 'S5 heli aligning', (t) => H(t)],
  [37.6, 'S5 heli landing 3/4', (t) => H(t)],
  [38.5, 'S6 nose', [-2.3, 1.2, 0]],
  [38.5, 'S6 gauge', [-3.3, 2.4, 1.9]],
  [40.3, 'S6 gauge', [-3.3, 2.4, 1.9]],
  [41.8, 'S6 dive: tank', STATION.tank],
  [42.7, 'S6 tank', STATION.tank],
  [43.6, 'S6 pump', [-13.2, -1.7, 7.4]],
  [44.2, 'S6 valve', [-10.4, -1.7, 7.4]],
  [45.0, 'S6 dispenser', [-9.8, 1.0, 9.5]],
  [45.9, 'S6 dispenser', [-9.8, 1.0, 9.5]],
  [47.25, 'S6 station', [-13.5, 1, 10]],
  [47.25, 'S6 heli (pull-back)', (t) => H(t)],
  [47.9, 'S7 heli wide', (t) => H(t)],
  [48.6, 'S7 canopy rain', [-1.1, 1.6, 0]],
  [49.4, 'S7 canopy rain', [-1.1, 1.6, 0]],
  [50.6, 'S7 heli wide', (t) => H(t)],
  [52.6, 'S7 hangar reveal', [HANGAR.x, 3.5, HANGAR.z]],
  [53.0, 'S7 hangar reveal', [HANGAR.x, 3.5, HANGAR.z]],
  [53.8, 'S7 doors (low angle)', [HANGAR.doorX, 3, HANGAR.z]],
  [54.8, 'S7 heli tow', (t) => H(t)],
  [55.3, 'S7 heli tow', (t) => H(t)],
  [55.9, 'S7 doors closing', [HANGAR.doorX, 3, HANGAR.z]],
  [55.9, 'S7 heli inside', (t) => H(t)],
  [56.6, 'S8 H marking', [0, 0, 0]],
  [57.2, 'S8 H marking', [0, 0, 0]],
  [58.5, 'S8 pad', [0, 0, 0]],
  [60.0, 'S8 pad', [0, 0, 0]],
  [60.0, 'S8 hangar', [HANGAR.x, 3, HANGAR.z]],
];
// whole-property checks for the final wide shots
const landmarks: [string, V3][] = [
  ['house L', [HOUSE.x - HOUSE.w / 2, 0, HOUSE.z]],
  ['house R', [HOUSE.x + HOUSE.w / 2, 0, HOUSE.z]],
  ['hangar NE', [HANGAR.x + HANGAR.w / 2, 0, HANGAR.z - HANGAR.d / 2]],
  ['hangar SW', [HANGAR.x - HANGAR.w / 2, 0, HANGAR.z + HANGAR.d / 2]],
  ['station SW', [STATION.slab.x - STATION.slab.w / 2, 0, STATION.slab.z + STATION.slab.d / 2]],
  ['windsock top', [SOCK.x, SOCK.h, SOCK.z]],
  ['pad', [0, 0, 0]],
];
for (const t of [62.5, 64.0, 65.2]) for (const [n, p] of landmarks) checks.push([t, 'FINAL ' + n, p]);

let bad = 0;
console.log('t      subject                        ndc.x   ndc.y   dist  status');
for (const [t, name, p, ] of checks) {
  const w = pt(p, t);
  const r = project(t, w);
  const on = r.z > 0.3 && Math.abs(r.x) <= 1 && Math.abs(r.y) <= 1;
  const safe = on && r.x > -0.85 && r.x < 0.75 && r.y > -0.6 && r.y < 0.9;
  if (!on) bad++;
  console.log(`${t.toFixed(1).padStart(5)}  ${name.padEnd(30)} ${r.x.toFixed(2).padStart(6)}  ${r.y.toFixed(2).padStart(6)} ${r.z.toFixed(1).padStart(6)}  ${on ? (safe ? 'safe' : 'on-screen (edge)') : 'OFF-SCREEN'}`);
}
console.log(bad ? `\n${bad} subject(s) off-screen` : '\nall subjects on screen');
process.exit(bad ? 1 : 0);
