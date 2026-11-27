// Verifies required assets exist, imports resolve, and the supplied voiceover is byte-identical.
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
const VOICE_SHA256 = '0beafb664602dff31459a7459445a9317ccf9f08c56806553ddd8cbe65d8c447';
let bad = 0;
const fail = (m) => {
  bad++;
  console.log('MISSING/BAD:', m);
};
for (const f of ['public/voiceover.mp3', 'public/audio/music.wav', 'public/audio/sfx.wav', 'src/audioTimeline.json', 'remotion.config.ts', 'package.json', '.github/workflows/render.yml', 'src/budget.ts', 'scripts/benchmark.sh']) if (!existsSync(f)) fail(f);
const sha = createHash('sha256').update(readFileSync('public/voiceover.mp3')).digest('hex');
if (sha !== VOICE_SHA256) fail(`voiceover hash changed: ${sha}`);
else console.log('voiceover.mp3 sha256 matches the supplied file');
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = path.join(d, f);
  statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && files.push(p);
});
walk('src');
let imports = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
    imports++;
    const base = path.resolve(path.dirname(f), m[1]);
    if (!['', '.ts', '.tsx', '.json', '.js'].some((e) => existsSync(base + e)) && !existsSync(path.join(base, 'index.ts'))) fail(`${f} -> ${m[1]}`);
  }
  for (const m of src.matchAll(/staticFile\('([^']+)'\)/g)) if (!existsSync(path.join('public', m[1]))) fail(`staticFile ${m[1]}`);
}
console.log(`asset check: ${files.length} source files, ${imports} relative imports checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
