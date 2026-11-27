import React, {useMemo} from 'react';
import * as THREE from 'three';
import {clamp, mulberry32, V3} from '../math';
import {HOUSE, WIND} from '../layout';
import {Item, itemState, ITEMS, HeliState} from '../tracks';
import {Box, Cone, Cyl, Sph, Tor} from './prims';
import {concreteTex, repeated} from './textures';

/* ---------------------------- HOUSE ---------------------------- */
const HouseImpl = () => {
  const roof = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-5.8, 0);
    sh.lineTo(5.8, 0);
    sh.lineTo(0, 2.5);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: 21.2, bevelEnabled: false});
    g.rotateY(Math.PI / 2);
    g.translate(-10.6, 0, 0);
    return g;
  }, []);
  const patio = useMemo(() => repeated(concreteTex(), 3, 1), []);
  const {x, z, w, d} = HOUSE;
  const fz = z + d / 2 + 0.03;
  return (
    <group position={[x, 0, z]}>
      <Box s={[w, 5, d]} p={[0, 2.5, 0]} c="#f3eee6" ro={0.85} />
      <mesh geometry={roof} position={[0, 5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b4148" metalness={0.3} roughness={0.55} />
      </mesh>
      <Box s={[7.5, 3.8, d - 1]} p={[-w / 2 - 3.2, 1.9, 0]} c="#2c3138" m={0.2} ro={0.6} />
      <Box s={[7.9, 0.25, d - 0.5]} p={[-w / 2 - 3.2, 3.9, 0]} c="#1e2227" ro={0.5} />
      <Box s={[3.4, 3.6, 0.1]} p={[-w / 2 - 3.2, 1.8, d / 2 - 0.4]} c="#7b8794" m={0.7} ro={0.3} />
      <Box s={[1.1, 3.2, 0.9]} p={[5.5, 6.6, -2]} c="#8d4b3a" ro={0.9} />
      {/* facade (front is +z) */}
      <Box s={[6.5, 3, 0.12]} p={[-5.2, 2.6, d / 2 + 0.04]} c="#18222e" ro={0.6} cast={false} />
      {[-7.8, -5.2, -2.6].map((px) => (
        <Box key={px} s={[2.4, 2.7, 0.08]} p={[px, 2.6, d / 2 + 0.09]} c="#86bde6" m={0.7} ro={0.06} em="#2a4a66" ei={0.5} cast={false} />
      ))}
      <Box s={[3.2, 2.7, 0.08]} p={[3.6, 2.6, d / 2 + 0.09]} c="#86bde6" m={0.7} ro={0.06} em="#2a4a66" ei={0.5} cast={false} />
      <Box s={[1.3, 2.6, 0.14]} p={[0, 1.3, d / 2 + 0.07]} c="#a9743f" ro={0.7} />
      <Sph rad={0.05} p={[0.45, 1.25, d / 2 + 0.18]} c="#d9dde2" m={1} ro={0.2} cast={false} />
      <Box s={[8, 5, 0.1]} p={[7.2, 2.5, d / 2 + 0.03]} c="#b07b46" ro={0.75} />
      {/* terrace + stepping stones */}
      <mesh position={[0, 0.06, d / 2 + 2.6]} receiveShadow>
        <boxGeometry args={[w - 1, 0.12, 5.2]} />
        <meshStandardMaterial map={patio} color="#d6d0c4" roughness={0.9} />
      </mesh>
      {Array.from({length: 5}, (_, i) => (
        <Box key={i} s={[1.5, 0.08, 1.0]} p={[-0.2 + (i % 2) * 0.25, 0.04, d / 2 + 6.4 + i * 1.6]} c="#c9c3b6" ro={0.9} />
      ))}
      {/* hedges */}
      {[-9, -6.4, 6.6, 9].map((hx) => (
        <Sph key={hx} rad={0.85} sc={[1.3, 0.8, 1]} p={[hx, 0.7, d / 2 + 5.4]} c="#2a7d2e" ro={0.9} />
      ))}
    </group>
  );
};

/* ---------------------------- TREES ---------------------------- */
const TREES: [number, number, number][] = [
  [-26, -6, 1.2],
  [-30, 8, 1.0],
  [-22, 26, 1.3],
  [28, 20, 1.1],
  [34, -26, 1.4],
  [-34, -22, 1.3],
  [13, -27, 1.1],
  [-20, -20, 1.0],
  [26, 10, 1.0],
  [40, 0, 1.2],
  [-40, 0, 1.2],
  [5, 38, 1.0],
  [-12, 32, 1.2],
  [20, 34, 1.1],
  [-30, 30, 1.0],
  [-16, -26, 1.1],
];
const GREENS = ['#2f8f34', '#3aa13c', '#278a3a', '#46b04a'];
export const Trees = ({t, heli}: {t: number; heli: HeliState}) => {
  const rnd = useMemo(() => mulberry32(33), []);
  const trees = useMemo(
    () =>
      TREES.map(([x, z, s], i) => ({x, z, s, ph: rnd() * 6, col: GREENS[i % 4], blobs: [0, 1, 2, 3].map((k) => ({dx: (rnd() - 0.5) * 1.8, dy: 3.3 + k * 0.55 + rnd() * 0.5, dz: (rnd() - 0.5) * 1.8, r: 1.5 - k * 0.18 + rnd() * 0.3}))})),
    [],
  );
  const wash = heli.rpm * clamp(1.15 - heli.pos[1] / 12);
  return (
    <group>
      {trees.map((tr, i) => {
        const dx = tr.x - heli.pos[0];
        const dz = tr.z - heli.pos[2];
        const d = Math.hypot(dx, dz) + 0.01;
        const push = wash * Math.exp(-d / 14) * 0.5;
        const sw = 0.022 * Math.sin(t * 1.6 + tr.ph) + 0.012 * Math.sin(t * 4.1 + tr.ph);
        const lx = (dx / d) * push + 0.025 + sw;
        const lz = (dz / d) * push + sw * 0.5;
        return (
          <group key={i} position={[tr.x, 0, tr.z]} scale={tr.s} rotation={[lz, 0, -lx]}>
            <Cyl rt={0.22} rb={0.36} h={3.4} p={[0, 1.7, 0]} c="#5a3d26" ro={0.95} />
            {tr.blobs.map((b, k) => (
              <mesh key={k} position={[b.dx, b.dy, b.dz]} scale={[1, 0.9, 1]} castShadow receiveShadow>
                <icosahedronGeometry args={[b.r, 1]} />
                <meshLambertMaterial color={tr.col} flatShading />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

/* ------------------------ GARDEN FURNITURE ------------------------ */
const Chair = () => (
  <group>
    <Box s={[0.5, 0.05, 0.5]} p={[0, 0.45, 0]} c="#e9edf1" ro={0.5} />
    <Box s={[0.5, 0.55, 0.05]} p={[0, 0.75, -0.22]} r={[-0.12, 0, 0]} c="#e9edf1" ro={0.5} />
    {[-0.2, 0.2].map((x) => [-0.2, 0.2].map((z) => <Cyl key={`${x}${z}`} rt={0.025} h={0.45} p={[x, 0.22, z]} c="#8a929b" m={0.9} />))}
  </group>
);
const Model = ({it}: {it: Item}) => {
  switch (it.kind) {
    case 'table':
      return (
        <group>
          <Cyl rt={1.05} h={0.07} p={[0, 0.76, 0]} c="#e9edf1" ro={0.4} />
          <Cyl rt={0.07} h={0.75} p={[0, 0.38, 0]} c="#8a929b" m={0.9} />
          <Cyl rt={0.5} h={0.04} p={[0, 0.02, 0]} c="#8a929b" m={0.9} />
        </group>
      );
    case 'chair':
      return <Chair />;
    case 'umbrella':
      return (
        <group>
          <Cyl rt={0.03} h={2.5} p={[0, 1.25, 0]} c="#c9ced6" m={0.9} />
          <Cone rad={1.7} h={0.55} seg={12} p={[0, 2.45, 0]} c="#ee5a3c" ro={0.7} />
          <Cone rad={1.72} h={0.5} seg={12} p={[0, 2.43, 0]} r={[0, Math.PI / 12, 0]} c="#fff4e6" ro={0.7} vis />
        </group>
      );
    case 'trampoline':
      return (
        <group>
          <Tor rad={1.9} tube={0.06} r={[Math.PI / 2, 0, 0]} p={[0, 0.9, 0]} c="#2d3a8c" m={0.4} ro={0.4} />
          <Cyl rt={1.85} h={0.03} p={[0, 0.88, 0]} c="#16181d" ro={0.9} />
          <Tor rad={1.78} tube={0.14} r={[Math.PI / 2, 0, 0]} p={[0, 0.92, 0]} c="#2b6fe0" ro={0.6} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Cyl key={i} rt={0.04} h={0.9} p={[Math.cos((i * Math.PI) / 3) * 1.9, 0.45, Math.sin((i * Math.PI) / 3) * 1.9]} c="#8a929b" m={0.9} />
          ))}
        </group>
      );
    case 'ball':
      return <Sph rad={0.3} c="#ff4d6d" ro={0.4} />;
    case 'pot':
      return (
        <group>
          <Cyl rt={0.36} rb={0.25} h={0.5} p={[0, 0.25, 0]} c="#c4693f" ro={0.8} />
          <Sph rad={0.35} sc={[1, 0.8, 1]} p={[0, 0.68, 0]} c="#2e9b3c" ro={0.85} />
        </group>
      );
    case 'bin':
      return (
        <group>
          <Cyl rt={0.36} rb={0.3} h={0.95} p={[0, 0.48, 0]} c="#4f5a66" ro={0.6} />
          <Cyl rt={0.38} h={0.07} p={[0, 0.97, 0]} c="#39424c" ro={0.6} />
        </group>
      );
    default:
      return (
        <group>
          <Box s={[0.7, 0.35, 1.0]} p={[0, 0.55, 0.1]} r={[0.15, 0, 0]} c="#2f8f45" m={0.3} ro={0.5} />
          <Cyl rt={0.22} h={0.1} p={[0, 0.22, 0.65]} r={[0, 0, Math.PI / 2]} c="#1a1a1a" ro={0.9} />
          {[-0.28, 0.28].map((x) => (
            <Cyl key={x} rt={0.02} h={1.0} p={[x, 0.7, -0.7]} r={[1.2, 0, 0]} c="#8a929b" m={0.9} />
          ))}
        </group>
      );
  }
};
const GardenItemsImpl = ({t}: {t: number}) => (
  <group>
    {ITEMS.map((it) => {
      const s = itemState(it, t);
      return (
        <group key={it.id} position={s.pos} rotation={s.rot}>
          <Model it={it} />
        </group>
      );
    })}
  </group>
);

/* ----------------------------- WINDSOCK ----------------------------- */
export const Windsock = ({pole, inflate, t, x, z, h}: {pole: number; inflate: number; t: number; x: number; z: number; h: number}) => {
  const N = 7;
  const segs = useMemo(() => {
    const a: {p: V3; pitch: number; rb: number; rt: number; len: number; col: string}[] = [];
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < N; i++) {
      const len = 0.52;
      const droop = (1 - inflate) * 1.35 + inflate * (0.03 + i * 0.018);
      const flutter = Math.sin(t * 7.5 + i * 0.9) * 0.05 * inflate * (0.4 + i * 0.25) + Math.sin(t * 2.3) * 0.03 * inflate;
      const pitch = droop + flutter;
      const rb = 0.52 - i * 0.045;
      const rt = 0.52 - (i + 1) * 0.045;
      a.push({p: [cx + (Math.cos(pitch) * len) / 2, cy - (Math.sin(pitch) * len) / 2, 0], pitch, rb: rb * (0.6 + 0.4 * inflate), rt: rt * (0.5 + 0.5 * inflate), len, col: i % 2 === 0 ? '#ff6a00' : '#fdf6ec'});
      cx += Math.cos(pitch) * len;
      cy -= Math.sin(pitch) * len;
    }
    return a;
  }, [Math.round(t * 30), inflate]);
  const H = h * pole;
  return (
    <group position={[x, 0, z]} visible={pole > 0.01}>
      <Cyl rt={0.14} rb={0.2} h={0.25} p={[0, 0.12, 0]} c="#7a828c" m={0.9} ro={0.35} />
      <Cyl rt={0.055} rb={0.08} h={H} p={[0, H / 2, 0]} c="#cfd5dc" m={0.95} ro={0.25} />
      <group position={[0, H, 0]} visible={inflate > 0.001}>
        <Sph rad={0.09} c="#cfd5dc" m={1} ro={0.2} />
        <Tor rad={0.55} tube={0.03} r={[0, Math.PI / 2, 0]} p={[0.0, 0, 0]} c="#c9ced6" m={0.95} ro={0.25} />
        {segs.map((s, i) => (
          <group key={i} position={s.p} rotation={[0, 0, -s.pitch]}>
            <mesh rotation={[0, 0, -Math.PI / 2]} castShadow>
              <cylinderGeometry args={[s.rt, s.rb, s.len, 20, 1, true]} />
              <meshStandardMaterial color={s.col} roughness={0.75} side={THREE.DoubleSide} />
            </mesh>
            <Tor rad={s.rb} tube={0.008} r={[0, Math.PI / 2, 0]} p={[-s.len / 2, 0, 0]} c="#7a2f00" cast={false} />
          </group>
        ))}
      </group>
    </group>
  );
};
void WIND;

export const House = React.memo(HouseImpl);
/** furniture comes to rest by t = 28 s: after that it never needs re-rendering */
export const GardenItems = React.memo(GardenItemsImpl, (a, b) => a.t >= 28 && b.t >= 28);
