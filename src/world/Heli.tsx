import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {HeliState} from '../tracks';
import {clamp, mulberry32} from '../math';
import {Box, Cyl, Mat, Sph} from './prims';
import {FUEL_PORT_LOCAL} from '../layout';

const WHITE = '#f4f6f9';
const BLUE = '#1c4fa6';
const DARK = '#2b2f36';

const droplets = (() => {
  const r = mulberry32(77);
  return Array.from({length: 44}, () => {
    const th = 0.25 + r() * 1.15;
    const ph = r() * Math.PI * 2;
    return {th, ph, s: 0.014 + r() * 0.024, on: r()};
  });
})();

const HelicopterImpl = ({h, rotor, wet, tailRotor, dolly, t}: {h: HeliState; rotor: number; wet: number; tailRotor: number; dolly: number; t: number}) => {
  const cowl = useMemo(() => new RoundedBoxGeometry(1.0, 0.55, 1.7, 4, 0.18), []);
  const stab = useMemo(() => new RoundedBoxGeometry(1.5, 0.06, 0.5, 2, 0.03), []);
  const blur = clamp((h.rpm - 0.25) * 0.55, 0, 0.28);
  const bladeOp = 1 - clamp((h.rpm - 0.3) * 0.7, 0, 0.62);
  const blink = Math.sin(t * 9) > 0.55 ? 1 : 0.15;
  const y = h.pos[1] + 0.18 * dolly;
  return (
    <group position={[h.pos[0], y, h.pos[2]]} rotation={[0, h.yaw, 0]}>
      <group rotation={[h.pitch, 0, h.roll]}>
        {/* fuselage: pearl white top, cobalt belly */}
        <mesh position={[0, 1.45, 0.25]} scale={[0.88, 0.95, 2.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 0, 1.75]} />
          <meshPhysicalMaterial color={WHITE} metalness={0.25} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} />
        </mesh>
        <mesh position={[0, 1.45, 0.25]} scale={[0.88, 0.95, 2.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 1.75, Math.PI - 1.75]} />
          <meshPhysicalMaterial color={BLUE} metalness={0.45} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        {/* cockpit glass */}
        <mesh position={[0, 1.66, 1.12]} scale={[0.8, 0.76, 1.06]}>
          <sphereGeometry args={[1, 32, 20, 0, Math.PI * 2, 0, 1.45]} />
          <meshStandardMaterial color="#0c1f33" metalness={0.9} roughness={0.04} transparent opacity={0.62} envMapIntensity={1.8} />
        </mesh>
        <Box s={[0.03, 0.5, 0.9]} p={[0.83, 1.5, 0.5]} c="#0e2236" m={0.8} ro={0.1} op={0.85} cast={false} />
        <Box s={[0.03, 0.5, 0.9]} p={[-0.83, 1.5, 0.5]} c="#0e2236" m={0.8} ro={0.1} op={0.85} cast={false} />
        {/* engine cowling + mast */}
        <mesh geometry={cowl} position={[0, 2.38, -0.5]} castShadow>
          <meshPhysicalMaterial color={WHITE} metalness={0.3} roughness={0.3} clearcoat={1} />
        </mesh>
        <Cyl rt={0.1} h={0.75} p={[0, 2.75, 0]} c={DARK} m={0.85} ro={0.3} />
        <Cyl rt={0.07} rb={0.07} h={0.5} p={[0.3, 2.3, -1.45]} r={[Math.PI / 2 - 0.4, 0, 0]} c="#9aa1aa" m={0.95} ro={0.25} />
        {/* tail boom, fin, stabilizer */}
        <Cyl rt={0.3} rb={0.085} h={4.6} seg={20} p={[0, 1.6, -3.1]} r={[Math.PI / 2, 0, 0]} c={WHITE} m={0.25} ro={0.3} />
        <Box s={[0.07, 1.15, 0.85]} p={[0, 1.95, -5.15]} r={[-0.22, 0, 0]} c={WHITE} m={0.25} ro={0.3} />
        <Box s={[0.075, 0.5, 0.5]} p={[0, 2.05, -5.28]} r={[-0.22, 0, 0]} c={BLUE} m={0.4} ro={0.3} />
        <mesh geometry={stab} position={[0, 1.38, -4.55]} castShadow>
          <meshStandardMaterial color={WHITE} metalness={0.25} roughness={0.3} />
        </mesh>
        <Box s={[0.05, 0.3, 0.45]} p={[0.75, 1.5, -4.55]} c={BLUE} m={0.4} />
        <Box s={[0.05, 0.3, 0.45]} p={[-0.75, 1.5, -4.55]} c={BLUE} m={0.4} />
        {/* tail rotor */}
        <group position={[0.16, 1.8, -5.3]} rotation={[tailRotor, 0, 0]}>
          <Box s={[0.025, 1.0, 0.1]} c={DARK} m={0.7} />
          <Box s={[0.025, 0.1, 1.0]} c={DARK} m={0.7} />
        </group>
        <Cyl rt={0.06} h={0.2} p={[0.1, 1.8, -5.3]} r={[0, 0, Math.PI / 2]} c="#9aa1aa" m={0.9} />
        {/* lights */}
        <Sph rad={0.07} p={[0, 2.62, -5.1]} c="#ff2a2a" em="#ff2a2a" ei={3 * blink} cast={false} />
        <Sph rad={0.06} p={[0.9, 1.5, 0.3]} c="#22ff66" em="#22ff66" ei={2} cast={false} />
        <Sph rad={0.06} p={[-0.9, 1.5, 0.3]} c="#ff3030" em="#ff3030" ei={2} cast={false} />
        <Sph rad={0.09} p={[0, 1.12, 2.15]} sc={[1, 1, 0.6]} c="#fff6dc" em="#fff1c7" ei={2.2} cast={false} />
        {/* fuel cap (left side) */}
        <Cyl rt={0.11} h={0.06} p={FUEL_PORT_LOCAL} r={[0, 0, Math.PI / 2]} c="#d5dae0" m={1} ro={0.18} />
        {/* skids, struts, cross tubes */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <Cyl rt={0.055} h={3.7} p={[sx * 1.0, 0.07, 0.05]} r={[Math.PI / 2, 0, 0]} c={DARK} m={0.85} ro={0.35} />
            <Cyl rt={0.055} h={0.55} p={[sx * 1.0, 0.27, 2.02]} r={[Math.PI / 2 - 0.65, 0, 0]} c={DARK} m={0.85} ro={0.35} />
            <Cyl rt={0.045} h={0.9} p={[sx * 0.82, 0.48, 0.85]} r={[0, 0, sx * 0.3]} c={DARK} m={0.85} ro={0.35} />
            <Cyl rt={0.045} h={0.9} p={[sx * 0.82, 0.48, -0.65]} r={[0, 0, sx * 0.3]} c={DARK} m={0.85} ro={0.35} />
          </group>
        ))}
        <Cyl rt={0.04} h={1.75} p={[0, 0.85, 0.85]} r={[0, 0, Math.PI / 2]} c={DARK} m={0.85} />
        <Cyl rt={0.04} h={1.75} p={[0, 0.85, -0.65]} r={[0, 0, Math.PI / 2]} c={DARK} m={0.85} />
        {/* ground handling dolly (hangar scene) */}
        {dolly > 0.01 &&
          [-1, 1].map((sx) => (
            <group key={sx} position={[sx * 1.0, -0.1, 0.05]} scale={[1, dolly, 1]}>
              <Box s={[0.16, 0.1, 3.8]} c="#ff7a00" m={0.3} ro={0.5} />
              {[-1.5, 1.5].map((z) => (
                <Cyl key={z} rt={0.13} h={0.14} p={[0, -0.03, z]} r={[0, 0, Math.PI / 2]} c="#1a1a1a" ro={0.9} />
              ))}
            </group>
          ))}
        {/* rain droplets on glass and body */}
        <Droplets wet={wet} />
        {/* main rotor */}
        <group position={[0, 3.12, 0]} rotation={[0, rotor, 0]}>
          <Cyl rt={0.2} h={0.18} c={DARK} m={0.9} ro={0.3} />
          {[0, Math.PI].map((a) => (
            <group key={a} rotation={[0, a, 0]}>
              <mesh position={[0, 0, 2.6]} castShadow>
                <boxGeometry args={[0.3, 0.035, 4.9]} />
                <meshStandardMaterial color="#25282d" metalness={0.7} roughness={0.4} transparent opacity={bladeOp} />
              </mesh>
              <Box s={[0.3, 0.037, 0.45]} p={[0, 0, 4.95]} c="#ffb400" ro={0.5} op={bladeOp} cast={false} />
            </group>
          ))}
        </group>
        {blur > 0.01 && (
          <mesh position={[0, 3.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[5.0, 48]} />
            <meshBasicMaterial color="#d6dde6" transparent opacity={blur} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  );
};

/** floating analog fuel gauge (no text): arc E->F, needle, low-fuel lamp */
export const FuelGauge = ({fuel, visible, t, k}: {fuel: number; visible: boolean; t: number; k: number}) => {
  const segs = 14;
  const blink = fuel < 0.25 && Math.sin(t * 12) > 0 ? 1 : 0.1;
  const ang = Math.PI * (1 - fuel);
  const kk = visible ? k : 0;
  return (
    <group position={[-3.3, 2.45, 1.9]} scale={[kk, kk, kk]} visible={kk > 0.01}>
      <Cyl rt={0.78} h={0.09} r={[Math.PI / 2, 0, 0]} c="#151a21" m={0.6} ro={0.35} />
      <Cyl rt={0.82} h={0.05} p={[0, 0, -0.04]} r={[Math.PI / 2, 0, 0]} c="#aeb6c0" m={1} ro={0.2} />
      {Array.from({length: segs}, (_, i) => {
        const u = i / (segs - 1);
        const a = Math.PI * (1 - u);
        const col = u < 0.25 ? '#ff3b30' : u < 0.5 ? '#ffb000' : '#37d67a';
        return <Box key={i} s={[0.1, 0.2, 0.04]} p={[Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0.06]} r={[0, 0, a - Math.PI / 2]} c={col} em={col} ei={1.4} cast={false} />;
      })}
      <group position={[0, 0, 0.1]} rotation={[0, 0, ang]}>
        <Box s={[0.5, 0.045, 0.03]} p={[0.25, 0, 0]} c="#f5f5f5" em="#ffffff" ei={0.6} cast={false} />
      </group>
      <Sph rad={0.07} p={[0, 0, 0.1]} c="#222" cast={false} />
      <Sph rad={0.1} p={[0, -0.42, 0.08]} c="#ffb000" em="#ff9500" ei={4 * blink} cast={false} />
    </group>
  );
};

export const TugVehicle = ({pos, yaw, vis}: {pos: [number, number, number]; yaw: number; vis: boolean}) => (
  <group position={pos} rotation={[0, yaw, 0]} visible={vis}>
    <Box s={[1.3, 0.55, 2.0]} p={[0, 0.5, 0]} c="#ffc400" m={0.3} ro={0.45} />
    <Box s={[1.1, 0.7, 0.9]} p={[0, 1.05, -0.35]} c="#ffc400" m={0.3} ro={0.45} />
    <Box s={[1.0, 0.45, 0.04]} p={[0, 1.12, 0.12]} c="#1c3552" m={0.9} ro={0.08} op={0.85} />
    <Box s={[0.12, 0.12, 0.6]} p={[0, 0.3, -1.3]} c="#555b63" m={0.8} />
    {[-0.62, 0.62].map((x) => [-0.7, 0.7].map((z) => <Cyl key={`${x}${z}`} rt={0.26} h={0.2} p={[x, 0.26, z]} r={[0, 0, Math.PI / 2]} c="#1a1a1a" ro={0.9} />))}
    <Sph rad={0.08} p={[0, 1.5, -0.35]} c="#ff9500" em="#ff9500" ei={2.5} cast={false} />
  </group>
);

/** all rain droplets in ONE instanced draw call (was 44 separate meshes with re-created geometry) */
const Droplets = ({wet}: {wet: number}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const q = Math.round(wet * 50);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    droplets.forEach((d, i) => {
      const k = clamp((q / 50 - d.on * 0.7) / 0.3);
      o.position.set(0.816 * Math.sin(d.th) * Math.cos(d.ph), 1.66 + 0.775 * Math.cos(d.th), 1.12 + 1.081 * Math.sin(d.th) * Math.sin(d.ph));
      o.scale.set(d.s * k, d.s * k * 0.7, d.s * k);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [q]);
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, droplets.length]} visible={wet > 0.02} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#e4f2ff" metalness={0} roughness={0} transparent opacity={0.6} envMapIntensity={2.4} />
    </instancedMesh>
  );
};

const blinkOn = (t: number) => Math.sin(t * 9) > 0.55;
/** the heli only re-renders when something visible changed (it is static for the whole final scene) */
export const Helicopter = React.memo(
  HelicopterImpl,
  (a, b) =>
    a.h.pos[0] === b.h.pos[0] && a.h.pos[1] === b.h.pos[1] && a.h.pos[2] === b.h.pos[2] && a.h.yaw === b.h.yaw && a.h.pitch === b.h.pitch && a.h.roll === b.h.roll && a.h.rpm === b.h.rpm &&
    a.rotor === b.rotor && a.tailRotor === b.tailRotor && Math.abs(a.wet - b.wet) < 0.02 && a.dolly === b.dolly && blinkOn(a.t) === blinkOn(b.t),
);
