/**
 * Reads public/voiceover.mp3 (never modifies it) and writes src/audioTimeline.json
 * with the real speech segments found via ffmpeg silence detection.
 * Usage: npm run analyze
 */
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import path from 'node:path';

const file = path.resolve('public/voiceover.mp3');
const NOISE_DB = -38;
const MIN_SILENCE = 0.15;
const MIN_SPEECH = 0.12;

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'});
const duration = parseFloat(probe.stdout.trim());
if (!Number.isFinite(duration)) throw new Error('ffprobe failed: ' + probe.stderr);

const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=n=${NOISE_DB}dB:d=${MIN_SILENCE}`, '-f', 'null', '-'], {encoding: 'utf8'});
const text = (r.stderr || '') + (r.stdout || '');
const silences: {start: number; end: number}[] = [];
let cur: number | null = null;
for (const line of text.split('\n')) {
  const s = line.match(/silence_start:\s*(-?[\d.]+)/);
  const e = line.match(/silence_end:\s*([\d.]+)/);
  if (s) cur = Math.max(0, parseFloat(s[1]));
  if (e && cur !== null) {
    silences.push({start: cur, end: parseFloat(e[1])});
    cur = null;
  }
}
if (cur !== null) silences.push({start: cur, end: duration});

const segments: {start: number; end: number}[] = [];
let t = 0;
for (const s of silences) {
  if (s.start - t >= MIN_SPEECH) segments.push({start: round(t), end: round(s.start)});
  t = Math.max(t, s.end);
}
if (duration - t >= MIN_SPEECH) segments.push({start: round(t), end: round(duration)});

function round(x: number) {
  return Math.round(x * 1000) / 1000;
}

writeFileSync('src/audioTimeline.json', JSON.stringify({file: 'voiceover.mp3', duration: round(duration), noiseDb: NOISE_DB, minSilence: MIN_SILENCE, segments}, null, 2) + '\n');
console.log(`duration ${duration}s, ${segments.length} speech segments`);
segments.forEach((s, i) => console.log(String(i).padStart(2), s.start.toFixed(3), '-', s.end.toFixed(3), `(${(s.end - s.start).toFixed(2)}s)`));
