/**
 * Procedural score + SFX. Pure Node (no deps). Writes public/audio/music.wav and sfx.wav.
 * Every cue is placed from the same track functions the 3D scene uses, and both beds are
 * ducked under the REAL speech segments measured from voiceover.mp3. The voiceover itself is never touched.
 *   npm run audio
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {CAMERA_KEYS, ITEMS, LIGHTNING, REBAR_COUNT, REBAR_START, REBAR_STEP, cameraAt, cameraBlur, heliState, hangar, itemState, station, weather, windsock, airflow} from '../src/tracks';
import {SEG, T, TOTAL_SECONDS} from '../src/timeline';
import {SOCK} from '../src/layout';
import {clamp, mulberry32, prog, ramp, smooth} from '../src/math';

/** targets: RMS while narrator speaks (voice measures about -16.6 dBFS) */
const MUSIC_DB = -32; // ~15 dB under the voice
const SFX_DB = -33; // ~16 dB under the voice
const SFX_PEAK = 0.25; // -12 dBFS ceiling
const SR = 44100;
const N = Math.ceil(TOTAL_SECONDS * SR);
const rnd = mulberry32(1234);
const buf = () => new Float32Array(N);
const idx = (t: number) => Math.max(0, Math.min(N - 1, Math.round(t * SR)));

/* ---------- tiny DSP helpers ---------- */
class LP {
  y = 0;
  a: number;
  constructor(fc: number) {
    this.a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  }
  p(x: number) {
    this.y += this.a * (x - this.y);
    return this.y;
  }
}
class HP {
  lp: LP;
  constructor(fc: number) {
    this.lp = new LP(fc);
  }
  p(x: number) {
    return x - this.lp.p(x);
  }
}
const white = () => rnd() * 2 - 1;
/** add `fn(t)` for t in [t0,t1] into `b` */
function render(b: Float32Array, t0: number, t1: number, fn: (t: number, i: number) => number) {
  const i0 = idx(t0);
  const i1 = idx(t1);
  for (let i = i0; i < i1; i++) b[i] += fn(i / SR, i - i0);
}
const env = (t: number, t0: number, a: number, d: number) => (t < t0 ? 0 : Math.min(1, (t - t0) / a) * Math.exp(-(t - t0) / d));

const sfxLoops = buf(); // continuous beds (ducked deeper)
const sfxHits = buf(); // transient accents

/* ---------- 1. rotor / turbine, driven by the real heli rpm & camera distance ---------- */
const rotorCtl = {rpm: 0, g: 0};
{
  const turb = new LP(1800);
  const chopLP = new LP(900);
  const rumble = new LP(140);
  let ph = 0;
  let ph2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (i % 441 === 0) {
      // control rate 100 Hz
      const h = heliState(t);
      const c = cameraAt(t);
      const d = Math.hypot(c.pos[0] - h.pos[0], c.pos[1] - h.pos[1], c.pos[2] - h.pos[2]);
      rotorCtl.rpm = h.rpm;
      rotorCtl.g = clamp(1 / (0.35 + d / 11), 0, 1.6);
    }
    const rpm = rotorCtl.rpm;
    if (rpm < 0.01) continue;
    const g = rotorCtl.g * 0.2;
    ph += (2 * Math.PI * (rpm * 7.6)) / SR; // blade-pass
    ph2 += (2 * Math.PI * (260 + rpm * 900)) / SR;
    const chop = Math.pow(0.5 + 0.5 * Math.sin(ph), 2.2);
    const x =
      0.55 * chopLP.p(white()) * (0.25 + 0.75 * chop) +
      0.32 * rumble.p(white()) * 2.2 +
      0.16 * Math.sin(ph2) * Math.min(1, rpm * 1.2) +
      0.07 * Math.sin(ph2 * 2.01) * rpm +
      0.1 * turb.p(white());
    sfxLoops[i] += x * g * Math.min(1, rpm * 1.5);
  }
}

/* ---------- 2. wind, grass, downwash, rain ---------- */
{
  const w1 = new LP(700);
  const w2 = new HP(2500);
  const w3 = new LP(7000);
  const r1 = new HP(1400);
  const r2 = new LP(9000);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const base = 0.016 + 0.01 * Math.sin(t * 0.7);
    const wash = airflow(t) * 0.1 + (t > T.wind && t < 37.9 ? 0.05 : 0) + (t < 3.6 ? 0.05 : 0) + (t > 47.3 && t < 57 ? 0.05 : 0);
    const gust = 0.5 + 0.5 * Math.sin(t * 1.3 + Math.sin(t * 0.4) * 2);
    const n = white();
    let x = w1.p(n) * 3.2 * (base + wash * gust) + w2.p(w3.p(white())) * 0.5 * (wash * 0.6);
    const rain = weather(t).rain;
    if (rain > 0) x += r2.p(r1.p(white())) * 0.22 * rain * (0.85 + 0.15 * Math.sin(t * 13));
    sfxLoops[i] += x;
  }
}
for (const lt of LIGHTNING) {
  const r = new LP(160);
  const c = new HP(900);
  render(sfxHits, lt, lt + 3.2, (t) => {
    const n = white();
    return 0.65 * r.p(n) * 2.6 * env(t, lt + 0.15, 0.25, 1.1) + 0.28 * c.p(n) * env(t, lt, 0.003, 0.09);
  });
}

/* ---------- 3. camera whooshes (cuts + fast moves, from the real camera track) ---------- */
function whoosh(tEnd: number, dur: number, gain: number, f0 = 400, f1 = 3200) {
  const bp = new LP(f0);
  const hp = new HP(f0 * 0.5);
  render(sfxHits, tEnd - dur, tEnd + 0.06, (t) => {
    const u = prog(t, tEnd - dur, tEnd);
    const fc = f0 + (f1 - f0) * u * u;
    bp.a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    const e = Math.sin(Math.PI * Math.min(1, u)) * (t > tEnd ? Math.exp(-(t - tEnd) * 30) : 1);
    return hp.p(bp.p(white())) * 2.4 * gain * e;
  });
}
const cuts = CAMERA_KEYS.filter((k) => k.cut).map((k) => k.t);
cuts.forEach((c) => whoosh(c + 0.05, 0.3, 0.55));
{
  // fast moves: windows where subtle motion blur is high
  let start = -1;
  let peak = 0;
  for (let f = 0; f <= TOTAL_SECONDS * 30; f++) {
    const t = f / 30;
    const b = cameraBlur(t);
    if (b > 1.1 && start < 0) {
      start = t;
      peak = 0;
    }
    if (start >= 0) peak = Math.max(peak, b);
    if (b <= 1.1 && start >= 0) {
      const d = Math.max(0.28, t - start);
      if (!cuts.some((c) => Math.abs(c - t) < 0.4)) whoosh(t, d, clamp(0.25 + peak * 0.15, 0.25, 0.7), 300, 2600 + peak * 500);
      start = -1;
    }
  }
}
whoosh(58.9, 1.1, 0.8, 200, 4200); // final cinematic pull-back / rise
whoosh(T.dive + 0.9, 0.9, 0.6, 2800, 300); // dive below the lawn

/* ---------- 4. foley ---------- */
function thud(t0: number, gain: number, f = 70) {
  const l = new LP(260);
  render(sfxHits, t0, t0 + 0.6, (t) => (Math.sin(2 * Math.PI * (f + 40 * Math.exp(-(t - t0) * 30)) * (t - t0)) * 0.9 + l.p(white()) * 1.4) * env(t, t0, 0.002, 0.11) * gain);
}
function ping(t0: number, f: number, gain: number, decay = 0.25) {
  render(sfxHits, t0, t0 + decay * 5, (t) => {
    const x = t - t0;
    return (Math.sin(2 * Math.PI * f * x) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * x) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * x)) * Math.exp(-x / decay) * gain * 0.5;
  });
}
function squelch(t0: number, t1: number, gain: number) {
  const a = new LP(420);
  const b = new LP(2200);
  render(sfxHits, t0, t1, (t) => {
    const e = Math.sin((Math.PI * (t - t0)) / (t1 - t0));
    const n = white();
    return (a.p(n) * 2.4 + b.p(n) * 0.5 * (0.5 + 0.5 * Math.sin(t * 40))) * e * gain;
  });
}
function crackle(t0: number, t1: number, gain: number, fc = 2400, rate = 0.04) {
  const hp = new HP(fc);
  render(sfxHits, t0, t1, (t) => (rnd() < rate ? hp.p(white()) * 3 : hp.p(0)) * gain * Math.sin((Math.PI * (t - t0)) / (t1 - t0)));
}
function engine(t0: number, t1: number, gain: number, f = 22) {
  const l = new LP(260);
  render(sfxLoops, t0, t1, (t) => {
    const e = Math.sin((Math.PI * (t - t0)) / (t1 - t0));
    return (Math.sin(2 * Math.PI * f * t) * 0.5 + l.p(white()) * 1.5) * (0.6 + 0.4 * Math.sin(2 * Math.PI * f * t)) * e * gain;
  });
}
function rumble(t0: number, t1: number, gain: number, fc = 200, mod = 6) {
  const l = new LP(fc);
  const hp = new HP(1500);
  render(sfxLoops, t0, t1, (t) => {
    const e = Math.min(1, (t - t0) / 0.12) * Math.min(1, (t1 - t) / 0.2);
    const n = white();
    return (l.p(n) * 3 * (0.7 + 0.3 * Math.sin(t * mod * 6.28)) + hp.p(n) * 0.25 * (Math.sin(t * mod * 6.28) > 0.9 ? 1 : 0.1)) * e * gain;
  });
}
function hum(t0: number, t1: number, gain: number, f: number, k = (_t: number) => 1) {
  render(sfxLoops, t0, t1, (t) => {
    const e = Math.min(1, (t - t0) / 0.3) * Math.min(1, (t1 - t) / 0.3) * k(t);
    return (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2 * t) + 0.2 * Math.sin(2 * Math.PI * f * 3 * t)) * e * gain;
  });
}
// scene 2 — mud
thud(T.touch, 0.55, 60);
squelch(T.touch + 0.05, T.sinkEnd, 0.55);
crackle(T.touch + 0.1, T.sinkEnd, 0.2, 1200, 0.02);
thud(T.touch + 0.95, 0.3, 55);
thud(T.sinkEnd - 0.1, 0.4, 48);
// scene 3 — excavation, gravel, rebar, concrete
engine(9.7, 12.6, 0.2, 16);
[10.5, 10.95, 11.35].forEach((t) => {
  squelch(t, t + 0.35, 0.28);
  thud(t + 0.4, 0.18, 85);
});
crackle(11.45, 12.15, 0.28, 1800, 0.05);
for (let k = 0; k < REBAR_COUNT; k++) ping(REBAR_START + k * REBAR_STEP + 0.32, 700 + rnd() * 1800, 0.22 + rnd() * 0.1, 0.18);
engine(12.4, 13.3, 0.18, 14);
rumble(T.pour + 0.05, T.poured + 0.3, 0.2, 380, 3);
crackle(T.pour + 0.1, T.poured, 0.16, 1500, 0.05);
engine(15.7, 16.8, 0.16, 14);
whoosh(16.05, 0.35, 0.4, 300, 1800);
thud(16.95, 0.35, 60);
thud(18.45, 0.28, 62); // heli touches the new pad
// scene 4 — furniture
ITEMS.forEach((it) => {
  for (let k = 1; k <= it.nb; k++) {
    const t = it.ts + (it.dur * k) / it.nb;
    if (it.kind === 'chair' || it.kind === 'bin') {
      ping(t, 520 + rnd() * 300, 0.1, 0.12);
      thud(t, 0.14, 120);
    } else if (it.kind === 'ball') {
      thud(t, 0.12, 180);
    } else thud(t, 0.18, 90);
  }
  rumble(it.ts, it.ts + it.dur * 0.8, it.kind === 'table' || it.kind === 'trampoline' ? 0.09 : 0.03, 600, 8);
});
ping(T.clear + 1.5, 1400, 0.1, 0.5);
// scene 5 — windsock
render(sfxLoops, T.sock, 37.9, (t, i) => {
  const c = cameraAt(t);
  const d = Math.hypot(c.pos[0] - SOCK.x, c.pos[1] - SOCK.h, c.pos[2] - SOCK.z);
  const g = clamp(1.1 / (0.3 + d / 4), 0, 1.3) * windsock(t).inflate;
  const flap = Math.pow(Math.max(0, Math.sin(t * 7 * 6.28 + Math.sin(t * 3) * 2)), 3);
  return white() * flap * g * 0.16;
});
ping(T.sock + 0.1, 900, 0.14, 0.4);
// scene 6 — fuel
for (let k = 0; k < 6; k++) {
  const t = 38.2 + k * 0.5;
  render(sfxHits, t, t + 0.12, (x) => Math.sin(2 * Math.PI * 1250 * x) * Math.sin(Math.PI * prog(x, t, t + 0.12)) * 0.07 * (k < 5 ? 1 : 0));
}
hum(T.dive, 44.6, 0.05, 55);
rumble(T.dive + 0.3, 44.5, 0.06, 140, 1.5);
hum(42.6, 47.3, 0.08, 100, (t) => ramp(t, 42.6, 43.3) * (1 - ramp(t, 47.0, 47.3)));
{
  const b = new LP(1800);
  const h = new HP(500);
  render(sfxLoops, 42.8, 47.3, (t) => {
    const k = station(t).flow;
    return h.p(b.p(white())) * 0.7 * k * (0.5 + 0.5 * Math.sin(t * 17) ** 2) * 0.12;
  });
}
[44.05, 44.3].forEach((t) => ping(t, 1100, 0.12, 0.1));
[44.55, 44.7, 44.85, 45.0, 45.2, 45.4].forEach((t) => thud(t, 0.16, 150));
ping(45.95, 1700, 0.14, 0.2);
[46.1, 46.35, 46.6].forEach((t, i) => ping(t, 880 * Math.pow(1.26, i), 0.09, 0.35));
// scene 7 — hangar
whoosh(T.hangar + 0.08, 0.25, 0.4, 200, 1400);
[T.hangar + 0.1, T.hangar + 0.25, T.hangar + 0.42, T.hangar + 0.6, T.hangar + 0.8, T.hangar + 1.0].forEach((t, i) => {
  ping(t, 420 + i * 70, 0.22, 0.3);
  thud(t, 0.2, 90);
});
[T.hangar + 1.1, T.hangar + 1.3, T.hangar + 1.5, T.hangar + 1.7].forEach((t) => {
  thud(t, 0.22, 70);
  crackle(t, t + 0.25, 0.1, 2500, 0.1);
});
engine(52.8, 55.5, 0.1, 30);
rumble(53.7, 54.3, 0.22, 240, 5);
rumble(55.5, 56.15, 0.22, 240, 5);
thud(54.3, 0.22, 70);
thud(56.15, 0.3, 60);
// scene 8 — reveal
rumble(57.4, 58.4, 0.2, 240, 5);
thud(58.4, 0.2, 70);
ping(T.reveal + 0.05, 1568, 0.07, 0.9);
ping(T.base + 0.05, 1318, 0.06, 0.9);

/* ---------- music ---------- */
const music = buf();
const prog4 = [
  [110.0, 164.81, 220.0, 261.63, 329.63], // Am
  [87.31, 130.81, 174.61, 220.0, 261.63], // F
  [130.81, 196.0, 261.63, 329.63, 392.0], // C
  [98.0, 146.83, 196.0, 246.94, 293.66], // G
];
const BAR = 4.0;
const saw = (ph: number) => {
  let s = 0;
  for (let h = 1; h <= 6; h++) s += Math.sin(ph * h) / h;
  return s * 0.6;
};
{
  const lp = new LP(1300);
  const bars = Math.ceil(TOTAL_SECONDS / BAR) + 1;
  for (let b = 0; b < bars; b++) {
    const ch = prog4[b % 4];
    const t0 = b * BAR - 0.7;
    const t1 = (b + 1) * BAR + 0.7;
    ch.forEach((f, ni) => {
      const vol = ni === 0 ? 0.5 : 0.22;
      render(music, t0, t1, (t) => {
        const e = Math.sin((Math.PI * (t - t0)) / (t1 - t0)) ** 2;
        const ph = 2 * Math.PI * t;
        return (saw(ph * f) + saw(ph * f * 1.004) * 0.8 + saw(ph * f * 0.996) * 0.8) * e * vol * 0.12;
      });
    });
    // soft arpeggio plucks
    for (let s = 0; s < 8; s++) {
      const tt = b * BAR + s * 0.5;
      const f = ch[1 + (s % 4)] * (s % 4 === 3 ? 2 : 1);
      render(music, tt, tt + 0.7, (t) => Math.sin(2 * Math.PI * f * 2 * (t - tt)) * Math.exp(-(t - tt) * 7) * 0.05 * (1 + 0.5 * ramp(tt, 10, 18)));
    }
  }
  for (let i = 0; i < N; i++) music[i] = lp.p(music[i]);
  // gentle pulse from the construction scene on
  for (let tt = 10.03; tt < 56; tt += 1.25) render(music, tt, tt + 0.35, (t) => Math.sin(2 * Math.PI * 52 * (t - tt)) * Math.exp(-(t - tt) * 11) * 0.28);
  // riser into the reveal, final chord and clean tail
  const rh = new HP(1500);
  render(music, 54.9, 56.4, (t) => rh.p(white()) * 0.1 * smooth(prog(t, 54.9, 56.4)) ** 2);
  const rh2 = new HP(2600);
  render(music, 63.8, 65.2, (t) => rh2.p(white()) * 0.09 * Math.sin(Math.PI * prog(t, 63.8, 65.2)));
  [110, 164.81, 220, 277.18, 329.63, 440].forEach((f, k) => render(music, 64.45, 65.44, (t) => saw(2 * Math.PI * f * t) * Math.exp(-(t - 64.45) / 0.55) * 0.07 * (k === 0 ? 1.6 : 1)));
  // arc: soft start, rise slightly at the reveal, clean finish
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const arc = 0.55 + 0.1 * ramp(t, 10, 18) + 0.3 * ramp(t, 55.8, 59.5) - 0.2 * ramp(t, 61.5, 64.4);
    const fadeIn = ramp(t, 0, 0.8);
    const fadeOut = 1 - ramp(t, 65.0, 65.44);
    music[i] *= arc * fadeIn * fadeOut;
  }
}

/* ---------- ducking under the real speech segments, normalise, write ---------- */
const duck = new Float32Array(N).fill(1);
{
  const mask = new Float32Array(N);
  SEG.forEach((s) => {
    for (let i = idx(s.start - 0.08); i < idx(s.end + 0.12); i++) mask[i] = 1;
  });
  let y = 0;
  for (let i = 0; i < N; i++) {
    const a = mask[i] > y ? 1 - Math.exp(-1 / (0.06 * SR)) : 1 - Math.exp(-1 / (0.35 * SR));
    y += a * (mask[i] - y);
    duck[i] = y;
  }
}
const peak = (b: Float32Array) => b.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
function mixDown(parts: [Float32Array, number][], duckDepth: number, target: number) {
  const out = buf();
  for (const [b, g] of parts) for (let i = 0; i < N; i++) out[i] += b[i] * g;
  const p0 = peak(out) || 1;
  for (let i = 0; i < N; i++) out[i] = (out[i] / p0) * target * (1 - duckDepth * duck[i]);
  return out;
}
/** scale a bed so its RMS while the narrator speaks hits an exact dBFS target (measured, not guessed) */
function calibrate(b: Float32Array, targetDb: number) {
  let sum = 0;
  let c = 0;
  SEG.forEach((s) => {
    for (let i = idx(s.start); i < idx(s.end); i++) {
      sum += b[i] * b[i];
      c++;
    }
  });
  const g = Math.pow(10, targetDb / 20) / Math.sqrt(sum / c);
  for (let i = 0; i < N; i++) b[i] *= g;
}
const musicOut = mixDown([[music, 1]], 0.62, 0.5);
const sfxOut = mixDown([[sfxLoops, 1], [sfxHits, 1.35]], 0.45, 0.5);
calibrate(musicOut, MUSIC_DB);
calibrate(sfxOut, SFX_DB);
// transient guard: SFX peaks must stay well under the voice peaks
const sp = peak(sfxOut);
if (sp > SFX_PEAK) for (let i = 0; i < N; i++) sfxOut[i] *= SFX_PEAK / sp;

function wav(path: string, b: Float32Array) {
  const data = Buffer.alloc(44 + N * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + N * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[i])) * 32767), 44 + i * 2);
  writeFileSync(path, data);
}
mkdirSync('public/audio', {recursive: true});
wav('public/audio/music.wav', musicOut);
wav('public/audio/sfx.wav', sfxOut);
console.log(`wrote public/audio/music.wav + sfx.wav (${TOTAL_SECONDS.toFixed(2)} s, ${SR} Hz mono); music peak ${peak(musicOut).toFixed(3)}, sfx peak ${peak(sfxOut).toFixed(3)}`);
void hangar;
void itemState;
