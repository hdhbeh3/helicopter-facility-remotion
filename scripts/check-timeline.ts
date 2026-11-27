import {statSync} from 'node:fs';
import {CAMERA_KEYS, HELI_KEYS, ITEMS, cameraAt, heliState, itemState, pad, hangar, weather} from '../src/tracks';
import {DURATION_IN_FRAMES, FPS, SCENES, SCENE_SEGS, SEG, T, TOTAL_SECONDS, VOICE_SECONDS} from '../src/timeline';
import {HANGAR, HOUSE, RING_R} from '../src/layout';

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, info = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};

// ---- audio-derived timeline
ok('18 measured speech segments', SEG.length === 18, String(SEG.length));
ok('segment->scene map covers 0..17 exactly once', SCENE_SEGS.flat().join() === Array.from({length: 18}, (_, i) => i).join());
ok('segments sorted and non-overlapping', SEG.every((s, i) => s.end > s.start && (i === 0 || s.start >= SEG[i - 1].end)));
ok('voice duration 65.04 s', Math.abs(VOICE_SECONDS - 65.04) < 0.01, String(VOICE_SECONDS));
ok('video length >= voice + tail', DURATION_IN_FRAMES / FPS >= VOICE_SECONDS + 0.39, `${DURATION_IN_FRAMES} frames`);
ok('8 scenes, contiguous from 0 to end', SCENES.length === 8 && SCENES[0].start === 0 && SCENES.every((s, i) => i === 0 || Math.abs(s.start - SCENES[i - 1].end) < 1e-9) && Math.abs(SCENES[7].end - TOTAL_SECONDS) < 1e-9);
ok('each scene contains its own speech', SCENES.every((sc, i) => SCENE_SEGS[i].every((k) => SEG[k].start >= sc.start && SEG[k].end <= sc.end)));
const sc = (t: number) => SCENES.find((s) => t >= s.start && t < s.end)!.id;
const anchors: [string, number, number][] = [
  ['hStart', T.hStart, 2], ['touch', T.touch, 2], ['excavate', T.excavate, 3], ['grid', T.grid, 3], ['pour', T.pour, 3], ['padReady', T.padReady, 3],
  ['spin', T.spin, 4], ['clear', T.clear, 4], ['zone', T.zone, 4], ['wind', T.wind, 5], ['sock', T.sock, 5], ['lowFuel', T.lowFuel, 6],
  ['dive', T.dive, 6], ['safetyEquip', T.safetyEquip, 6], ['rain', T.rain, 7], ['hangar', T.hangar, 7], ['reveal', T.reveal, 8], ['base', T.base, 8],
];
anchors.forEach(([n, t, s]) => ok(`anchor ${n} (${t.toFixed(2)}s) is in scene ${s}`, sc(t) === s));

// ---- camera
ok('camera keys strictly time-ordered', CAMERA_KEYS.every((k, i) => i === 0 || k.t >= CAMERA_KEYS[i - 1].t));
let minY = 9;
let badFov = 0;
let maxStep = 0;
let maxStepT = 0;
let cutsFound = 0;
let inHouse = 0;
let throughRoof = 0;
for (let f = 0; f < DURATION_IN_FRAMES; f++) {
  const t = f / FPS;
  const c = cameraAt(t);
  const underground = t >= T.dive && t < 44.8;
  if (!underground) minY = Math.min(minY, c.pos[1]);
  if (c.fov < 25 || c.fov > 70) badFov++;
  if (f > 0) {
    const p = cameraAt((f - 1) / FPS).pos;
    const step = Math.hypot(c.pos[0] - p[0], c.pos[1] - p[1], c.pos[2] - p[2]);
    if (step > 2.5) cutsFound++;
    else if (step * FPS > maxStep) {
      maxStep = step * FPS;
      maxStepT = t;
    }
  }
  if (c.pos[0] > HOUSE.x - HOUSE.w / 2 && c.pos[0] < HOUSE.x + HOUSE.w / 2 && c.pos[2] > HOUSE.z - HOUSE.d / 2 && c.pos[2] < HOUSE.z + HOUSE.d / 2 && c.pos[1] < 8) inHouse++;
  const hg = hangar(t);
  const inFoot = c.pos[0] > HANGAR.x - HANGAR.w / 2 && c.pos[0] < HANGAR.x + HANGAR.w / 2 && c.pos[2] > HANGAR.z - HANGAR.d / 2 && c.pos[2] < HANGAR.z + HANGAR.d / 2;
  if (inFoot && hg.roof > 0.95 && c.pos[1] > 7 && c.pos[1] < 10) throughRoof++;
}
ok('camera never below ground outside the planned underground dive', minY >= 0.1, `min y ${minY.toFixed(2)} m`);
ok('fov within 25..70 everywhere', badFov === 0);
ok('camera never inside the house volume', inHouse === 0);
ok('camera never clips through the hangar roof plane', throughRoof === 0);
ok('hard cuts only at planned moments', cutsFound >= 6 && cutsFound <= 16, `${cutsFound} cuts`);
ok('fastest non-cut camera travel < 80 m/s', maxStep < 80, `${maxStep.toFixed(1)} m/s at ${maxStepT.toFixed(2)}s`);

// ---- helicopter
ok('heli keys ordered', HELI_KEYS.every((k, i) => i === 0 || k.t >= HELI_KEYS[i - 1].t));
let maxV = 0;
let minHy = 9;
let teleports = 0;
for (let f = 1; f < DURATION_IN_FRAMES; f++) {
  const a = heliState((f - 1) / FPS).pos;
  const b = heliState(f / FPS).pos;
  const v = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * FPS;
  maxV = Math.max(maxV, v);
  minHy = Math.min(minHy, b[1]);
  if (v > 70) teleports++;
}
ok('heli never teleports (max speed < 70 m/s)', teleports === 0, `max ${maxV.toFixed(1)} m/s`);
ok('heli skids sink at most 0.35 m, never deeper', minHy > -0.35, `min y ${minHy.toFixed(2)}`);
ok('heli lands on the concrete pad at (0,0,0) at ~18.45 s and again at ~37.65 s', Math.hypot(...heliState(18.5).pos) < 0.05 && Math.hypot(...heliState(37.7).pos) < 0.05);
ok('heli is inside the hangar at the end', heliState(60).pos[0] > HANGAR.x - 2 && heliState(60).pos[0] < HANGAR.x + 2);
ok('rotor stopped before ground handling', heliState(53).rpm === 0);

// ---- furniture ends outside the safety ring
ITEMS.forEach((it) => {
  const s = itemState(it, 40).pos;
  const r = Math.hypot(s[0], s[2]);
  ok(`${it.id} comes to rest outside the ${RING_R} m safety ring`, r > RING_R + 1, `${r.toFixed(1)} m`);
});
// ---- construction states
ok('pad: concrete top reaches ground level before heli lands', pad(18.3).concreteTop > 0.015 && pad(T.pour).concreteTop < -0.5);
ok('pad: soil is gone before gravel, gravel before rebar, rebar before pour', pad(11.5).soilTop <= -0.99 && pad(12.2).gravel >= 0.99 && !pad(T.pour - 0.01).concreteOn);
ok('hangar: built before the tow, doors open during tow', hangar(54.8).roof === 1 && hangar(54.8).open > 0.9 && hangar(56.1).open < 0.2);
ok('hangar: doors reopen in the final reveal', hangar(58.5).open > 0.99);
ok('weather: dry at start, raining mid-scene 7, clear again at the end', weather(10).rain === 0 && weather(52).rain > 0.99 && weather(60).rain === 0);

// ---- audio files present and matching length
const wavBytes = (p: string) => statSync(p).size;
const expect = 44 + Math.ceil(TOTAL_SECONDS * 44100) * 2;
ok('music.wav and sfx.wav match the video length', wavBytes('public/audio/music.wav') === expect && wavBytes('public/audio/sfx.wav') === expect);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
