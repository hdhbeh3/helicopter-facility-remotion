/** Measures the final mix: narration dominance, bed levels, peak, loudness. Voiceover is only read. */
import {spawnSync} from 'node:child_process';
import {SEG, TOTAL_SECONDS} from '../src/timeline';

const SR = 44100;
function decode(path: string): Float32Array {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {maxBuffer: 1 << 29});
  if (r.status !== 0) throw new Error('ffmpeg decode failed for ' + path);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4));
}
const v = decode('public/voiceover.mp3');
const m = decode('public/audio/music.wav');
const s = decode('public/audio/sfx.wav');
const N = Math.max(v.length, m.length, s.length);
const speech = new Uint8Array(N);
SEG.forEach((g) => {
  for (let i = Math.round(g.start * SR); i < Math.min(N, Math.round(g.end * SR)); i++) speech[i] = 1;
});
const rms = (a: Float32Array, on: number) => {
  let sum = 0;
  let c = 0;
  for (let i = 0; i < a.length; i++) if (speech[i] === on) {
    sum += a[i] * a[i];
    c++;
  }
  return Math.sqrt(sum / Math.max(1, c));
};
const db = (x: number) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
let peak = 0;
let clipped = 0;
for (let i = 0; i < N; i++) {
  const x = (v[i] || 0) + (m[i] || 0) + (s[i] || 0);
  peak = Math.max(peak, Math.abs(x));
  if (Math.abs(x) > 1) clipped++;
}
const vs = rms(v, 1);
const ms = rms(m, 1);
const ss = rms(s, 1);
console.log(`lengths: voice ${(v.length / SR).toFixed(2)}s  music ${(m.length / SR).toFixed(2)}s  sfx ${(s.length / SR).toFixed(2)}s  (video ${TOTAL_SECONDS.toFixed(2)}s)`);
console.log(`during speech  RMS dBFS: voice ${db(vs)}  music ${db(ms)}  sfx ${db(ss)}`);
console.log(`voice is ${(+db(vs) - +db(ms)).toFixed(1)} dB above music and ${(+db(vs) - +db(ss)).toFixed(1)} dB above SFX while speaking`);
console.log(`between lines  RMS dBFS: music ${db(rms(m, 0))}  sfx ${db(rms(s, 0))}`);
console.log(`summed peak ${db(peak)} dBFS, samples over 0 dBFS: ${clipped}`);
const r = spawnSync('ffmpeg', ['-hide_banner', '-i', 'public/voiceover.mp3', '-i', 'public/audio/music.wav', '-i', 'public/audio/sfx.wav', '-filter_complex', '[0:a]aresample=44100[a];[1:a]aresample=44100[b];[2:a]aresample=44100[c];[a][b][c]amix=inputs=3:normalize=0:duration=longest,ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8'});
const tail = (r.stderr || '').split('\n').filter((l) => /I:|LRA:|Peak:/.test(l)).slice(-3).join(' | ');
console.log('mix loudness:', tail.replace(/\s+/g, ' '));
let sPeakSpeech = 0;
let mPeakSpeech = 0;
for (let i = 0; i < N; i++) if (speech[i]) {
  sPeakSpeech = Math.max(sPeakSpeech, Math.abs(s[i] || 0));
  mPeakSpeech = Math.max(mPeakSpeech, Math.abs(m[i] || 0));
}
console.log(`peaks while speaking: music ${db(mPeakSpeech)} dBFS, sfx ${db(sPeakSpeech)} dBFS`);
const ok = +db(vs) - +db(ms) >= 12 && +db(vs) - +db(ss) >= 12 && +db(sPeakSpeech) <= -12 && clipped === 0;
console.log(ok ? 'PASS: music >=12 dB and SFX >=12 dB under narration RMS, SFX peaks <= -12 dBFS, no clipping' : 'FAIL: rebalance beds');
process.exit(ok ? 0 : 1);
