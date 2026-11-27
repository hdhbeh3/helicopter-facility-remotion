import * as THREE from 'three';
import {mulberry32} from '../math';

const cache: Record<string, THREE.CanvasTexture> = {};
function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number, rnd: () => number) => void, srgb = true) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size, mulberry32(key.length * 977 + size));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache[key] = t;
  return t;
}
const speckle = (g: CanvasRenderingContext2D, s: number, rnd: () => number, n: number, cols: string[], r0: number, r1: number, a: number) => {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = a * (0.4 + rnd() * 0.6);
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    const r = r0 + rnd() * (r1 - r0);
    g.beginPath();
    g.arc(rnd() * s, rnd() * s, r, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
};
/** world UV = meters / 16 ; 4 mowing stripes per tile */
export const lawnTex = () =>
  make('lawn', 1024, (g, s, rnd) => {
    const cols = ['#4fbf3f', '#3fa733'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = cols[i % 2];
      g.fillRect((i * s) / 4, 0, s / 4, s);
    }
    speckle(g, s, rnd, 9000, ['#2f8a27', '#63d34f', '#3a9a30', '#7fe066'], 1, 3.2, 0.35);
  });
/** world UV = meters / 4 */
export const concreteTex = () =>
  make('concrete', 512, (g, s, rnd) => {
    g.fillStyle = '#c4c6c8';
    g.fillRect(0, 0, s, s);
    speckle(g, s, rnd, 5000, ['#b0b2b5', '#d6d8da', '#9fa2a6', '#e0e1e2'], 0.6, 2, 0.4);
  });
export const soilTex = () =>
  make('soil', 512, (g, s, rnd) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, s, s);
    speckle(g, s, rnd, 4500, ['#3d2615', '#7a5232', '#4a2e1a', '#8a6340'], 1, 4, 0.55);
  });
export const gravelTex = () =>
  make('gravel', 512, (g, s, rnd) => {
    g.fillStyle = '#8c8a85';
    g.fillRect(0, 0, s, s);
    speckle(g, s, rnd, 1800, ['#6b6a66', '#a8a6a0', '#7d756a', '#b9b5ab', '#55534f'], 3, 9, 0.8);
  });
export function repeated(tex: THREE.CanvasTexture, rx: number, ry: number) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}
