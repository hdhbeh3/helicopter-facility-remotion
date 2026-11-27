import React from 'react';
import * as THREE from 'three';
import type {V3} from '../math';

export interface MatProps {
  c?: string;
  m?: number;
  ro?: number;
  op?: number;
  em?: string;
  ei?: number;
  side?: any;
  map?: any;
  flat?: boolean;
  env?: number;
}
export const Mat = ({c = '#888', m = 0, ro = 0.6, op, em, ei = 1, side, map, flat, env}: MatProps) => (
  <meshStandardMaterial
    color={c}
    metalness={m}
    roughness={ro}
    transparent={op !== undefined && op < 1}
    opacity={op ?? 1}
    emissive={em ?? '#000000'}
    emissiveIntensity={em ? ei : 0}
    side={side}
    map={map}
    flatShading={flat}
    envMapIntensity={env ?? 1}
    depthWrite={op === undefined || op >= 1}
  />
);
interface Common extends MatProps {
  p?: V3;
  r?: V3;
  sc?: V3;
  cast?: boolean;
  recv?: boolean;
  vis?: boolean;
}
export const Box = ({s = [1, 1, 1], p = [0, 0, 0], r = [0, 0, 0], sc, cast = true, recv = true, vis = true, ...m}: Common & {s?: V3}) => (
  <mesh position={p} rotation={r} scale={sc} castShadow={cast} receiveShadow={recv} visible={vis}>
    <boxGeometry args={s} />
    <Mat {...m} />
  </mesh>
);
export const Cyl = ({rt = 0.5, rb, h = 1, seg = 20, p = [0, 0, 0], r = [0, 0, 0], sc, cast = true, recv = true, vis = true, open, ...m}: Common & {rt?: number; rb?: number; h?: number; seg?: number; open?: boolean}) => (
  <mesh position={p} rotation={r} scale={sc} castShadow={cast} receiveShadow={recv} visible={vis}>
    <cylinderGeometry args={[rt, rb ?? rt, h, seg, 1, open]} />
    <Mat {...m} />
  </mesh>
);
export const Sph = ({rad = 1, seg = 24, p = [0, 0, 0], r = [0, 0, 0], sc, cast = true, recv = true, vis = true, ...m}: Common & {rad?: number; seg?: number}) => (
  <mesh position={p} rotation={r} scale={sc} castShadow={cast} receiveShadow={recv} visible={vis}>
    <sphereGeometry args={[rad, seg, Math.max(8, seg >> 1)]} />
    <Mat {...m} />
  </mesh>
);
export const Tor = ({rad = 1, tube = 0.05, seg = 24, p = [0, 0, 0], r = [0, 0, 0], sc, cast = true, vis = true, ...m}: Common & {rad?: number; tube?: number; seg?: number}) => (
  <mesh position={p} rotation={r} scale={sc} castShadow={cast} visible={vis}>
    <torusGeometry args={[rad, tube, 10, seg]} />
    <Mat {...m} />
  </mesh>
);
export const Cone = ({rad = 1, h = 1, seg = 16, p = [0, 0, 0], r = [0, 0, 0], sc, cast = true, vis = true, ...m}: Common & {rad?: number; h?: number; seg?: number}) => (
  <mesh position={p} rotation={r} scale={sc} castShadow={cast} visible={vis}>
    <coneGeometry args={[rad, h, seg]} />
    <Mat {...m} />
  </mesh>
);
/** cylinder between two points */
export const Rod = ({a, b, rad = 0.05, seg = 12, ...m}: MatProps & {a: V3; b: V3; rad?: number; seg?: number}) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-6;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3((b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L));
  return (
    <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} castShadow>
      <cylinderGeometry args={[rad, rad, L, seg]} />
      <Mat {...m} />
    </mesh>
  );
};
