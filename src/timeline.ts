import audio from './audioTimeline.json';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const VOICE_SECONDS: number = audio.duration;
export const TAIL_SECONDS = 0.4;
export const TOTAL_SECONDS = VOICE_SECONDS + TAIL_SECONDS;
export const DURATION_IN_FRAMES = Math.ceil(TOTAL_SECONDS * FPS);

export interface Seg {
  start: number;
  end: number;
}
/** Real speech segments measured from public/voiceover.mp3 */
export const SEG: Seg[] = audio.segments;

/** Which measured speech segments belong to which scene (script has 15 sentences, 18 breath-separated segments). */
export const SCENE_SEGS: number[][] = [[0], [1], [2, 3, 4], [5, 6, 7], [8, 9], [10, 11, 12, 13], [14, 15], [16, 17]];
export const SCENE_NAMES = ['hook', 'mud', 'pad', 'safety', 'windsock', 'fuel', 'hangar', 'reveal'];

export interface Scene {
  id: number;
  name: string;
  start: number;
  end: number;
}
const mid = (a: number, b: number) => (a + b) / 2;
export const SCENES: Scene[] = SCENE_SEGS.map((idx, i) => {
  const first = SEG[idx[0]];
  const last = SEG[idx[idx.length - 1]];
  const prevLast = i > 0 ? SEG[SCENE_SEGS[i - 1][SCENE_SEGS[i - 1].length - 1]] : null;
  const nextFirst = i < SCENE_SEGS.length - 1 ? SEG[SCENE_SEGS[i + 1][0]] : null;
  return {
    id: i + 1,
    name: SCENE_NAMES[i],
    start: prevLast ? mid(prevLast.end, first.start) : 0,
    end: nextFirst ? mid(last.end, nextFirst.start) : TOTAL_SECONDS,
  };
});

const dur = (i: number) => SEG[i].end - SEG[i].start;
/** Narration-anchored moments (seconds). Word-level splits inside a segment are estimates by word count. */
export const T = {
  hStart: SEG[1].start + 0.15, // "You start by marking an H"
  touch: SEG[1].start + dur(1) * (16 / 23), // "...the moment the helicopter touches down"
  sinkEnd: SEG[1].end,
  excavate: SCENES[2].start, // "remove the soil"
  grid: SEG[2].start + dur(2) * 0.42, // "lay a steel reinforcement grid"
  pour: SEG[3].start, // "and pour a massive concrete foundation"
  poured: SEG[3].start + dur(3) * 0.62,
  padReady: SEG[4].start, // "Now you have a landing pad!"
  spin: SEG[5].start, // "But the spinning blades create powerful winds"
  clear: SEG[6].start, // "So you clear the surrounding area"
  zone: SEG[7].start, // "...protected safety zone"
  wind: SEG[8].start, // "But the pilot still needs to know..."
  sock: SEG[9].start, // "So you install a bright orange windsock"
  lowFuel: SEG[10].start, // "Now imagine the helicopter arrives with almost no fuel"
  dive: SEG[11].start, // "So you add a dedicated fuel storage..."
  macro: SEG[12].start,
  safetyEquip: SEG[13].start, // "designed with proper fire protection and safety controls"
  rain: SEG[14].start, // "But leaving an expensive helicopter exposed to rain"
  hangar: SEG[15].start, // "So you build a hangar nearby"
  reveal: SEG[16].start, // "And just like that..."
  base: SEG[17].start, // "What started as a simple H..."
};

export const secToFrame = (s: number) => Math.round(s * FPS);
export const frameToSec = (f: number) => f / FPS;
export const sceneAt = (t: number) => SCENES.find((s) => t >= s.start && t < s.end) ?? SCENES[SCENES.length - 1];
