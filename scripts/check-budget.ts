/**
 * Render-budget tests (pure): the optimisations must never hide anything that should be visible.
 * Also prints the static cost table (before -> after). These are NOT timings - see scripts/benchmark.sh.
 */
import {DURATION_IN_FRAMES, FPS} from '../src/timeline';
import {cameraAt, heliState, hangar, station, pad, weather, ITEMS, itemState, windsock, safetyZone} from '../src/tracks';
import {
  AIRFLOW_COUNT, BLADE_COUNT, RAIN_COUNT, SHADOW_MAP, SPECK_COUNT, debrisActive, hangarLightOn, hangarMounted, hoseMounted, pointLightCount,
  rainMounted, shadowFit, stationAboveMounted, undergroundMounted,
} from '../src/budget';

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, info = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};
let maxLights = 0;
let hidden = {underground: 0, above: 0, hangar: 0, hose: 0, rain: 0, lights: 0, camUnder: 0, shadowLook: 0, shadowHeli: 0, windsock: 0, ring: 0};
let minMargin = 1e9;
for (let f = 0; f < DURATION_IN_FRAMES; f++) {
  const t = f / FPS;
  maxLights = Math.max(maxLights, pointLightCount(t));
  const st = station(t);
  const hg = hangar(t);
  if (st.underground > 0.001 && st.patchOpacity < 0.97 && !undergroundMounted(t)) hidden.underground++; // only visible through the translucent lawn
  if (st.slab > 0.001 && !stationAboveMounted(t)) hidden.above++;
  if (t >= 44.5 && st.slab > 0.001 && t < 47.4 && st.hose > 0.001 && !hoseMounted(t)) hidden.hose++;
  if (hg.floor > 0.001 && !hangarMounted(t)) hidden.hangar++;
  if (hg.lights > 0.001 && !hangarLightOn(t)) hidden.lights++;
  if (weather(t).rain > 0.01 && !rainMounted(t)) hidden.rain++;
  const c = cameraAt(t);
  if (c.pos[1] < 0 && !undergroundMounted(t)) hidden.camUnder++;
  if (windsock(t).pole > 0.01 && t < 33.7) hidden.windsock++;
  if (safetyZone(t).ring > 0.01 && t < 23.1) hidden.ring++;
  // shadow frustum must contain what the camera looks at, and the heli whenever it is near the focus
  const fit = shadowFit(t);
  const inside = (x: number, z: number, k = 0.92) => Math.abs(x - fit.cx) < fit.ext * k && Math.abs(z - fit.cz) < fit.ext * k;
  if (!inside(c.look[0], c.look[2], 1.0)) hidden.shadowLook++;
  const h = heliState(t).pos;
  if (Math.hypot(h[0] - c.look[0], h[2] - c.look[2]) < 25 && h[1] < 30 && !inside(h[0], h[2], 1.0)) hidden.shadowHeli++;
  minMargin = Math.min(minMargin, fit.ext - Math.max(Math.abs(c.look[0] - fit.cx), Math.abs(c.look[2] - fit.cz)));
}
ok('never more than ONE point light at any frame (was 3, always mounted)', maxLights <= 1, `max ${maxLights}`);
ok('underground installation mounted whenever it is visible', hidden.underground === 0);
ok('above-ground fuel station mounted whenever it is visible', hidden.above === 0);
ok('hose mounted whenever it is visible', hidden.hose === 0);
ok('hangar mounted whenever any part is visible', hidden.hangar === 0);
ok('hangar light mounted whenever it is on', hidden.lights === 0);
ok('rain mounted whenever it is falling', hidden.rain === 0);
ok('camera only goes underground while the cutaway is mounted', hidden.camUnder === 0);
ok('windsock / safety ring only mounted after their narration cue', hidden.windsock === 0 && hidden.ring === 0);
ok('shadow frustum contains the camera focus in every frame', hidden.shadowLook === 0, `closest margin ${minMargin.toFixed(1)} m`);
ok('shadow frustum contains the heli whenever it is near the focus', hidden.shadowHeli === 0);
ok('debris mounted around touchdown, dig and pour', debrisActive(8.2) && debrisActive(11) && debrisActive(14.5) && !debrisActive(30));
// furniture is static after 28 s (memoised): verify it really is
ok('furniture is at rest from 28 s (memo is safe)', ITEMS.every((it) => { const a = itemState(it, 28).pos; const b = itemState(it, 60).pos; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9; }));
ok('heli is static from 56.3 s (memo is safe)', (() => { const a = heliState(56.3); const b = heliState(65); return a.pos.every((v, i) => v === b.pos[i]) && a.rpm === 0 && b.rpm === 0; })());
ok('pad site static after 18.7 s except cure/paint (memo is safe)', pad(19).concreteTop === pad(60).concreteTop && pad(19).soilTop === pad(60).soilTop);

const px = 1080 * 1920;
console.log('\nstatic cost table (counts, not timings)');
console.log('  item                      before        after');
console.log(`  MSAA samples              4x            1x (set --props='{"aa":true}' to restore)`);
console.log(`  shadow map                2048^2 PCFSoft ${SHADOW_MAP}^2 PCF  (${((SHADOW_MAP * SHADOW_MAP) / (2048 * 2048) * 100).toFixed(0)}% of the texels, fitted per scene)`);
console.log(`  point lights (permanent)  3             0 (<=1 only while needed)`);
console.log(`  grass blades              7000          ${BLADE_COUNT.near + BLADE_COUNT.far}`);
console.log(`  rain / airflow / specks   1800/170/140  ${RAIN_COUNT}/${AIRFLOW_COUNT}/${SPECK_COUNT}`);
console.log(`  cloud transparent spheres 48            0 (24 opaque, 8 clouds)`);
console.log(`  frame pixels              ${px}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
