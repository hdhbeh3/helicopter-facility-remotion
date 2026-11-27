# Private Helicopter Landing Facility - 3D YouTube Short (Remotion + Three.js)

1080x1920, 30 fps, 9:16, H.264 MP4, 65.44 s (65.04 s narration + 0.4 s tail).
No captions, no text overlays, no logos. The supplied voiceover is used byte-for-byte.

## Render on GitHub Actions (read OPTIMIZATION.md first)
1. Push this project to a repo (see "Android" below).
2. Actions -> "Render Helicopter Facility Short" -> Run workflow:
   * **mode = benchmark** first: measures real s/frame on 5 demanding moments, prints the ETA in the run summary and uploads 5 sample stills.
   * **mode = parallel** (recommended): `chunks` = 8 renders 8 frame ranges on 8 runners, then merges and adds the original voiceover + music + SFX.
   * mode = single: one job, only if the benchmark shows it fits in 5.5 h.
3. Download artifact `helicopter-facility-short`.

## Android upload (no computer)
**Option A - browser only**
1. Unzip nothing. On github.com (Chrome -> "Desktop site") create a new repository.
2. Add file -> Upload files -> pick `helicopter-facility-project.zip` -> Commit.
3. Add file -> Create new file -> name it `.github/workflows/unpack.yml`, paste the contents of `android/unpack.yml` (open it from the ZIP, or copy from the chat) -> Commit.
4. Actions -> "Unpack project ZIP" -> Run workflow. It commits all project files.
5. Add file -> Create new file -> name `.github/workflows/render.yml`, paste the contents of `.github/workflows/render.yml` (GitHub's bot is not allowed to write this folder) -> Commit.
6. Actions -> "Render Helicopter Facility Short" -> Run workflow -> benchmark, then parallel.
**Option B - Termux**: `pkg install git unzip`, unzip, `git init`, `git remote add origin https://<token>@github.com/<you>/<repo>.git`, `git add -A && git commit -m init && git push -u origin main`.
Private repos include 2000 free Actions minutes/month: an 8-chunk render uses roughly the full single-job time in total, so check the benchmark first. Public repos are free.

## Render locally
`npm install && npm run check && npm run benchmark` then `npm run render` (or `npm start` for Remotion Studio). MSAA: add `--props='{"aa":true}'`.

## How it syncs to the narration
`npm run analyze` (already run) measures the real speech segments in `voiceover.mp3` -> `src/audioTimeline.json` (18 segments).
`src/timeline.ts` maps them to the 8 scenes and derives narration anchors (e.g. "touches down", "pour", "windsock").
Word-level anchors inside a segment (e.g. touchdown inside segment 2) are estimated by word count and may be off by a few tenths of a second.
Helicopter path, camera, weather, construction, furniture physics: `src/tracks.ts` (pure functions of time).
SFX + music: `npm run audio` (`scripts/gen-audio.ts`) generates `public/audio/music.wav` and `sfx.wav` from the same tracks (rotor sound follows real rpm and camera distance) and ducks them under the speech segments.

## Audio levels (measured on the rendered-mix inputs)
Voice -16.6 dBFS RMS; music about -32 dBFS (15 dB under); SFX about 16-20 dB under, SFX peaks <= -12 dBFS; summed peak -0.4 dBFS, no clipping.

## Files
`src/world/*` 3D scene components, `src/tracks.ts` animation data, `src/timeline.ts` audio-derived timing, `scripts/*` generators and checks, `.github/workflows/render.yml`.

## Notes / limits
- Versions pinned: remotion 4.0.250, three 0.169.0, @react-three/fiber 8.17.10, React 18.3.1. If your existing project uses other Remotion versions, change all `remotion`/`@remotion/*` versions together to the same one.
- Camera motion blur is a subtle CSS blur driven by camera speed (not multi-sample blur) to keep rendering stable.
- Conceptual visuals only: not engineering drawings and not a DIY fuel-system or helipad guide.
