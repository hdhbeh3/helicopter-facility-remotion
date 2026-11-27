import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {clamp, easeOut, prog, V3} from '../math';
import {station as stationState} from '../tracks';
import {hoseMounted, stationAboveMounted, undergroundMounted} from '../budget';
import {FUEL_PATH, FUEL_PORT_LOCAL, HELI_YAW_INTO_WIND, STATION, heliLocalToWorld} from '../layout';
import {Box, Cone, Cyl, Rod, Sph, Tor} from './prims';
import {concreteTex, repeated} from './textures';

type SS = ReturnType<typeof stationState>;
const STEEL = '#b9c0c8';
const AMBER = '#ffae00';

/** positions along a polyline by arc-length fraction */
function along(path: V3[], f: number): V3 {
  const lens: number[] = [];
  let tot = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1], path[i + 1][2] - path[i][2]);
    lens.push(l);
    tot += l;
  }
  let d = (((f % 1) + 1) % 1) * tot;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]) {
      const u = d / lens[i];
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * u, path[i][1] + (path[i + 1][1] - path[i][1]) * u, path[i][2] + (path[i + 1][2] - path[i][2]) * u];
    }
    d -= lens[i];
  }
  return path[path.length - 1];
}

const Underground = ({s, t}: {s: SS; t: number}) => {
  const k = s.underground;
  const [tx, ty, tz] = STATION.tank;
  const L = STATION.tankLen - 2 * STATION.tankR;
  const pulses = useMemo(() => Array.from({length: 11}, (_, i) => i / 11), []);
  const slide = (1 - easeOut(k)) * 3;
  return (
    <group>
      <pointLight position={[-13, -1.0, 9.5]} color="#ffe2b0" intensity={k * 40} distance={16} decay={1.6} />
      <group visible={k > 0.01}>
      {/* storage tank: translucent shell, amber fuel inside */}
      <group position={[tx, ty + slide, tz]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[STATION.tankR, L, 8, 28]} />
          <meshStandardMaterial color={STEEL} metalness={0.95} roughness={0.25} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh>
          <capsuleGeometry args={[STATION.tankR * 0.86, L, 8, 24]} />
          <meshStandardMaterial color={AMBER} emissive="#ff9a00" emissiveIntensity={0.55} transparent opacity={0.82} roughness={0.2} />
        </mesh>
        {[-1.6, -0.5, 0.6, 1.7].map((z) => (
          <mesh key={z} position={[0, z, 0]}>
            <torusGeometry args={[STATION.tankR + 0.01, 0.05, 8, 40]} />
            <meshStandardMaterial color="#8a939d" metalness={1} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <group position={[tx, ty + slide, tz]}>
        <Cyl rt={0.45} h={0.35} p={[0, STATION.tankR + 0.1, 0]} c="#8a939d" m={0.95} ro={0.3} />
        <Cyl rt={0.1} h={1.25} p={[-0.2, STATION.tankR + 0.7, -1.0]} c={STEEL} m={1} ro={0.25} />
        <Cyl rt={0.14} h={0.08} p={[-0.2, STATION.tankR + 1.35, -1.0]} c="#e23b2e" ro={0.4} />
        {/* leak sensor in containment sump */}
        <Box s={[0.5, 0.14, 0.3]} p={[0.2, -STATION.tankR - 0.12, 0.6]} c="#2b3138" m={0.6} />
        <Sph rad={0.05} p={[0.2, -STATION.tankR - 0.02, 0.6]} c="#37e0ff" em="#37e0ff" ei={3} cast={false} />
      </group>
      {/* vent line with flame arrestor, rising above ground */}
      <Rod a={[tx - 1.7, ty + slide + 1.1, tz + 1.6]} b={[tx - 1.7, 3.2, tz + 1.6]} rad={0.05} c="#d9dee3" m={1} ro={0.25} />
      <Cyl rt={0.13} h={0.3} p={[tx - 1.7, 3.35, tz + 1.6]} c="#a9b0b8" m={1} ro={0.3} />
      {/* pump / filter vault */}
      <group position={[0, slide * 0.6, 0]}>
        <Box s={[5.2, 0.12, 2.6]} p={[-12.2, -2.65, 7.4]} c="#7b8087" ro={0.9} />
        <Box s={[5.2, 1.9, 2.6]} p={[-12.2, -1.7, 7.4]} c="#9fc4d8" m={0.2} ro={0.1} op={0.16} cast={false} />
        {/* motor + volute */}
        <Cyl rt={0.34} h={0.95} p={[-13.2, -1.7, 7.4]} r={[0, 0, Math.PI / 2]} c="#2b6ccf" m={0.5} ro={0.35} />
        <Sph rad={0.36} p={[-12.6, -1.7, 7.4]} c={STEEL} m={1} ro={0.25} />
        <Box s={[0.5, 0.22, 0.4]} p={[-13.3, -1.35, 7.4]} c="#1c2229" m={0.5} />
        {/* filter canisters */}
        <Cyl rt={0.3} h={1.1} p={[-11.5, -1.7, 7.4]} r={[0, 0, Math.PI / 2]} c={STEEL} m={1} ro={0.22} />
        {[-12.0, -11.0].map((x) => (
          <Tor key={x} rad={0.31} tube={0.03} p={[x, -1.7, 7.4]} r={[0, Math.PI / 2, 0]} c="#7b838c" m={1} />
        ))}
        {/* ball valves (red handles) */}
        {[-10.4, -9.8].map((x, i) => (
          <group key={x} position={[x, -1.7, i ? 8.2 : 7.4]}>
            <Sph rad={0.2} c="#c8ced5" m={1} ro={0.2} />
            <Cyl rt={0.03} h={0.45} p={[0, 0.3, 0]} c="#e23b2e" ro={0.5} />
            <Box s={[0.45, 0.05, 0.08]} p={[0, 0.52, 0]} c="#e23b2e" ro={0.5} />
          </group>
        ))}
        {/* pressure gauge */}
        <Cyl rt={0.13} h={0.05} p={[-11.5, -1.15, 7.4]} r={[Math.PI / 2, 0, 0]} c="#f2f4f6" ro={0.3} />
      </group>
      {/* stainless pipework (semi-transparent) with glowing amber core + moving pulses */}
      {FUEL_PATH.slice(0, -1).map((a, i) => (
        <group key={i}>
          <Rod a={a} b={FUEL_PATH[i + 1]} rad={0.1} c={STEEL} m={1} ro={0.22} op={0.5} />
          <Rod a={a} b={FUEL_PATH[i + 1]} rad={0.055} c={AMBER} em="#ff9a00" ei={0.4 + 1.2 * s.flow} />
        </group>
      ))}
      {FUEL_PATH.slice(1, -1).map((p, i) => (
        <Sph key={i} rad={0.12} p={p} c={STEEL} m={1} ro={0.2} />
      ))}
      {s.flow > 0.01 &&
        pulses.map((f, i) => {
          const p = along(FUEL_PATH, f + t * 0.16);
          return <Sph key={i} rad={0.105} p={p} c="#ffd24d" em="#ffb000" ei={3.2 * s.flow} seg={10} cast={false} />;
        })}
      </group>
    </group>
  );
};

/* hose from dispenser to the heli's fuel cap (heli parked on pad, yaw = into wind) */
const HOSE_END = heliLocalToWorld([0, 0, 0], HELI_YAW_INTO_WIND, FUEL_PORT_LOCAL);
const hoseCurve = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-9.6, 1.15, 9.6),
    new THREE.Vector3(-9.3, 0.35, 8.4),
    new THREE.Vector3(-7.5, 0.06, 6.7),
    new THREE.Vector3(-4.4, 0.06, 4.6),
    new THREE.Vector3(-1.8, 0.06, 2.6),
    new THREE.Vector3(HOSE_END[0] + 0.45, 0.95, HOSE_END[2] + 0.6),
    new THREE.Vector3(HOSE_END[0] + 0.1, HOSE_END[1], HOSE_END[2] + 0.1),
  ],
  false,
  'catmullrom',
  0.4,
);
const bondCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(2.6, 0.9, 2.9), new THREE.Vector3(2.0, 0.08, 2.0), new THREE.Vector3(0.9, 0.35, 1.0), new THREE.Vector3(0.45, 0.9, 0.12)]);

const Hose = ({s}: {s: SS}) => {
  const geo = useMemo(() => new THREE.TubeGeometry(hoseCurve, 80, 0.045, 8, false), []);
  const bond = useMemo(() => new THREE.TubeGeometry(bondCurve, 24, 0.016, 6, false), []);
  const {invalidate} = useThree();
  useLayoutEffect(() => {
    geo.setDrawRange(0, Math.floor((geo.index!.count * clamp(s.hose)) / 3) * 3);
    invalidate();
  }, [s.hose]);
  return (
    <group visible={s.hose > 0.01}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#1d2025" roughness={0.6} />
      </mesh>
      <mesh geometry={bond} castShadow visible={s.hose > 0.95}>
        <meshStandardMaterial color="#e8b800" roughness={0.6} />
      </mesh>
      <Cyl rt={0.06} h={0.3} p={[2.6, 0.45, 2.9]} c="#b87333" m={0.9} ro={0.35} />
    </group>
  );
};
const HosePulses = ({s, t}: {s: SS; t: number}) => {
  const pts = useMemo(() => Array.from({length: 9}, (_, i) => i / 9), []);
  return (
    <group visible={s.refuel > 0.01}>
      {pts.map((f, i) => {
        const p = hoseCurve.getPoint(((f + t * 0.35) % 1) * Math.max(0.01, s.hose));
        return <Sph key={i} rad={0.07} p={[p.x, p.y, p.z]} c="#ffcf40" em="#ffae00" ei={3 * s.refuel} seg={8} cast={false} />;
      })}
    </group>
  );
};

const Above = ({s, wet}: {s: SS; wet: number}) => {
  const {x, z, w, d} = STATION.slab;
  const conc = useMemo(() => repeated(concreteTex(), 2, 2), []);
  const [dx, , dz] = STATION.dispenser;
  const post = (px: number, pz: number) => <Cyl key={`${px}${pz}`} rt={0.13} h={4.6 * s.posts} p={[px, 2.3 * s.posts, pz]} c="#9aa3ad" m={0.9} ro={0.3} />;
  return (
    <group>
      <group visible={s.slab > 0.01}>
        <mesh position={[x, 0.07 * s.slab, z]} scale={[1, s.slab, 1]} receiveShadow castShadow>
          <boxGeometry args={[w, 0.14, d]} />
          <meshStandardMaterial map={conc} color="#c9cbcd" roughness={0.9 - 0.5 * wet} />
        </mesh>
        {/* yellow containment curb */}
        {[
          [0, d / 2 - 0.06, w, 0.12],
          [0, -d / 2 + 0.06, w, 0.12],
          [w / 2 - 0.06, 0, 0.12, d],
          [-w / 2 + 0.06, 0, 0.12, d],
        ].map(([ox, oz, sx, sz], i) => (
          <Box key={i} s={[sx, 0.1, sz]} p={[x + ox, 0.18 * s.slab, z + oz]} c="#f2c200" ro={0.6} />
        ))}
      </group>
      <group visible={s.posts > 0.01}>
        {[
          [x - w / 2 + 0.4, z - d / 2 + 0.4],
          [x + w / 2 - 0.4, z - d / 2 + 0.4],
          [x - w / 2 + 0.4, z + d / 2 - 0.4],
          [x + w / 2 - 0.4, z + d / 2 - 0.4],
        ].map(([px, pz]) => post(px, pz))}
      </group>
      <group position={[0, (1 - s.roof) * 5, 0]} visible={s.roof > 0.01}>
        <Box s={[w + 0.8, 0.28, d + 0.8]} p={[x, 4.75, z]} c="#f2f4f7" m={0.4} ro={0.35} />
        <Box s={[w + 0.82, 0.12, 0.5]} p={[x, 4.62, z + d / 2 + 0.2]} c="#d62d20" ro={0.4} />
        {[-2.4, 0, 2.4].map((lx) => (
          <Box key={lx} s={[1.4, 0.05, 0.3]} p={[x + lx, 4.58, z]} c="#ffffff" em="#fff6e0" ei={2} cast={false} />
        ))}
        {/* fire suppression: foam line with sprinkler heads */}
        <Cyl rt={0.045} h={w - 1} p={[x, 4.45, z + 1.2]} r={[0, 0, Math.PI / 2]} c="#d62d20" ro={0.4} />
        {[-3, -1, 1, 3].map((lx) => (
          <Cyl key={lx} rt={0.04} h={0.18} p={[x + lx, 4.32, z + 1.2]} c="#b8bec6" m={1} ro={0.3} />
        ))}
      </group>
      {/* dispenser */}
      <group position={[dx, 0, dz]} scale={[1, s.dispenser, 1]} visible={s.dispenser > 0.01}>
        <Box s={[0.75, 1.5, 0.55]} p={[0, 0.82, 0]} c="#2f3945" m={0.5} ro={0.35} />
        <Box s={[0.78, 0.3, 0.58]} p={[0, 1.65, 0]} c="#d62d20" ro={0.4} />
        <Box s={[0.4, 0.22, 0.04]} p={[0, 1.2, 0.29]} c="#0b1a10" em="#37e07a" ei={1.2} cast={false} />
        <Cyl rt={0.16} h={0.12} p={[0.45, 0.95, 0]} r={[0, 0, Math.PI / 2]} c="#222a31" m={0.6} />
        <Box s={[1.1, 0.12, 0.9]} p={[0, 0.06, 0]} c="#f2c200" ro={0.6} />
      </group>
      {/* bollards, extinguishers, e-stop, no-smoking sign */}
      <group visible={s.safety > 0.01} scale={[1, s.safety, 1]}>
        {[
          [dx - 0.9, dz - 0.9],
          [dx - 0.9, dz + 0.9],
          [dx + 0.9, dz - 0.9],
          [dx + 0.9, dz + 0.9],
        ].map(([bx, bz]) => (
          <Cyl key={`${bx}${bz}`} rt={0.11} h={0.9} p={[bx, 0.45, bz]} c="#f2c200" ro={0.45} />
        ))}
        <Box s={[0.7, 0.9, 0.3]} p={[x - 3.8, 1.2, z - 3.2]} c="#d62d20" ro={0.4} />
        <Cyl rt={0.11} h={0.5} p={[x - 3.95, 1.2, z - 3.02]} c="#b3201a" ro={0.4} />
        <Cyl rt={0.11} h={0.5} p={[x - 3.65, 1.2, z - 3.02]} c="#b3201a" ro={0.4} />
        <Cyl rt={0.06} h={1.2} p={[x - 3.8, 0.6, z - 3.2]} c="#8a929b" m={0.9} />
        <Cyl rt={0.05} h={1.3} p={[dx + 1.3, 0.65, dz - 1.3]} c="#f2c200" ro={0.5} />
        <Cyl rt={0.13} h={0.1} p={[dx + 1.3, 1.35, dz - 1.3]} c="#e5251c" em="#ff2a1a" ei={1.2} ro={0.4} />
        <Cyl rt={0.04} h={2.0} p={[x + 3.7, 1.0, z + 3.0]} c="#8a929b" m={0.9} />
        <Cyl rt={0.42} h={0.04} p={[x + 3.7, 2.1, z + 3.0]} r={[Math.PI / 2, 0, 0]} c="#ffffff" ro={0.5} />
        <Tor rad={0.4} tube={0.05} p={[x + 3.7, 2.1, z + 3.03]} c="#d62d20" ro={0.5} />
        <Box s={[0.7, 0.07, 0.03]} p={[x + 3.7, 2.1, z + 3.06]} r={[0, 0, Math.PI / 4]} c="#d62d20" cast={false} />
        <Box s={[0.35, 0.05, 0.03]} p={[x + 3.7, 2.1, z + 3.06]} c="#222" cast={false} />
      </group>
    </group>
  );
};

const FuelStationImpl = ({s, t, wet}: {s: SS; t: number; wet: number}) => (
  <group>
    {undergroundMounted(t) && <Underground s={s} t={t} />}
    {stationAboveMounted(t) && <Above s={s} wet={wet} />}
    {hoseMounted(t) && <Hose s={s} />}
    {hoseMounted(t) && <HosePulses s={s} t={t} />}
  </group>
);
const sig = (s: SS) => `${s.underground}|${s.flow}|${s.slab}|${s.posts}|${s.roof}|${s.dispenser}|${s.safety}|${s.hose}|${s.refuel}`;
/** static after the refuel beat (t > 47.4 s) except wetness; while animating it re-renders every frame */
export const FuelStation = React.memo(FuelStationImpl, (a, b) => {
  if (Math.abs(a.wet - b.wet) >= 0.02 || sig(a.s) !== sig(b.s)) return false;
  if (a.t >= 47.4 && b.t >= 47.4) return true;
  return a.t === b.t;
});
void prog;
void Cone;
