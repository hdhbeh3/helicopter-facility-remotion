import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {clamp, easeIn, mulberry32, prog, ramp, V3} from '../math';
import {HANGAR, RING_R} from '../layout';
import {AIRFLOW_COUNT, RAIN_COUNT, SPECK_COUNT} from '../budget';
import type {HeliState} from '../tracks';
import {OMEGA_FULL} from '../tracks';
import {Box, Cone} from './prims';

/* ---------------- rain: instanced streaks wrapped around the camera focus ---------------- */
const RAIN_N = RAIN_COUNT;
export const Rain = ({t, intensity, focus, hangarBuilt}: {t: number; intensity: number; focus: V3; hangarBuilt: boolean}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const {invalidate} = useThree();
  const seeds = useMemo(() => {
    const r = mulberry32(404);
    return Array.from({length: RAIN_N}, () => ({x: r(), y: r(), z: r(), v: 0.8 + r() * 0.5}));
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const S = 40;
    const H = 28;
    const active = Math.floor(RAIN_N * intensity);
    const mod = (a: number, b: number) => ((a % b) + b) % b;
    for (let i = 0; i < RAIN_N; i++) {
      const s = seeds[i];
      if (i >= active) {
        o.scale.setScalar(0);
      } else {
        const sp = 17 * s.v;
        const px = mod(s.x * S + 3.6 * s.v * t - focus[0] + S / 2, S) + focus[0] - S / 2;
        const pz = mod(s.z * S - focus[2] + S / 2, S) + focus[2] - S / 2;
        const py = mod(s.y * H - sp * t, H);
        const inside = hangarBuilt && px > HANGAR.x - HANGAR.w / 2 && px < HANGAR.x + HANGAR.w / 2 && pz > HANGAR.z - HANGAR.d / 2 && pz < HANGAR.z + HANGAR.d / 2 && py < 9.6;
        o.position.set(px, py, pz);
        o.rotation.set(0, 0, 0.21);
        o.scale.set(1, inside ? 0 : 1, 1);
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, RAIN_N]} frustumCulled={false} visible={intensity > 0.01}>
      <boxGeometry args={[0.012, 0.75, 0.012]} />
      <meshBasicMaterial color="#cfe3f5" transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  );
};

/* ---------------- rotor downwash: translucent cyan streamlines ---------------- */
const AIR_N = AIRFLOW_COUNT;
export const Airflow = ({t, k, heli}: {t: number; k: number; heli: HeliState}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const {invalidate} = useThree();
  const seeds = useMemo(() => {
    const r = mulberry32(808);
    return Array.from({length: AIR_N}, () => ({a: r() * 6.283, r0: 0.9 + r() * 3.9, p: r(), sw: (r() - 0.5) * 1.2}));
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const path = (s: (typeof seeds)[number], lam: number): V3 => {
      const R = Math.min(1.25, heli.rpm) * 0.9;
      const hubY = heli.pos[1] + 3.1;
      let r: number;
      let y: number;
      if (lam < 0.4) {
        const u = lam / 0.4;
        r = s.r0 * (1 - 0.15 * u);
        y = hubY + (heli.pos[1] + 0.3 - hubY) * easeIn(u);
      } else {
        const u = (lam - 0.4) / 0.6;
        r = s.r0 * 0.85 + u * 12 * R;
        y = heli.pos[1] + 0.3 + 0.35 * Math.sin(u * 3 + s.a);
      }
      const a = s.a + lam * s.sw;
      return [heli.pos[0] + Math.cos(a) * r, y, heli.pos[2] + Math.sin(a) * r];
    };
    for (let i = 0; i < AIR_N; i++) {
      const s = seeds[i];
      const lam = (t * 0.85 * Math.max(0.4, heli.rpm) + s.p) % 1;
      const a = path(s, lam);
      const b = path(s, Math.min(1, lam + 0.02));
      o.position.set(a[0], a[1], a[2]);
      o.lookAt(b[0], b[1], b[2]);
      const fade = Math.sin(Math.PI * lam) * k;
      o.scale.set(fade, fade, fade * 2.2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, AIR_N]} frustumCulled={false} visible={k > 0.01}>
      <boxGeometry args={[0.035, 0.035, 0.5]} />
      <meshBasicMaterial color="#6fdcff" transparent opacity={0.55 * k} depthWrite={false} />
    </instancedMesh>
  );
};

/* ---------------- drifting wind specks (show wind direction) ---------------- */
const SPECK_N = SPECK_COUNT;
export const WindSpecks = ({t, k}: {t: number; k: number}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const {invalidate} = useThree();
  const seeds = useMemo(() => {
    const r = mulberry32(606);
    return Array.from({length: SPECK_N}, () => ({x: r(), y: r(), z: r(), v: 0.6 + r() * 0.8, ph: r() * 6.28}));
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const mod = (a: number, b: number) => ((a % b) + b) % b;
    for (let i = 0; i < SPECK_N; i++) {
      const s = seeds[i];
      o.position.set(mod(s.x * 70 + t * 6 * s.v, 70) - 22, 0.6 + s.y * 9 + 0.35 * Math.sin(t * 2 + s.ph), -6 + s.z * 30 + 0.5 * Math.sin(t * 1.3 + s.ph));
      o.scale.set(k * 2.4 * s.v, k, k);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, SPECK_N]} frustumCulled={false} visible={k > 0.01}>
      <sphereGeometry args={[0.05, 6, 4]} />
      <meshBasicMaterial color="#fff6d8" transparent opacity={0.75} depthWrite={false} />
    </instancedMesh>
  );
};

/* ---------------- safety perimeter: ONE instanced dashed ring, cones, soft cleared disc ---------------- */
const DASH = 72;
export const SafetyZone = ({ring, cones, disc}: {ring: number; cones: number; disc: number}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const {invalidate} = useThree();
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < DASH; i++) {
      const a = (i / DASH) * Math.PI * 2;
      o.position.set(Math.cos(a) * RING_R, 0.05, Math.sin(a) * RING_R);
      o.rotation.set(0, -a + Math.PI / 2, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  useLayoutEffect(() => {
    if (ref.current) ref.current.count = Math.min(DASH, Math.floor(ring * DASH) + 1);
    invalidate();
  }, [ring]);
  return (
    <group visible={ring > 0.01}>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RING_R, 48]} />
        <meshBasicMaterial color="#f9e04b" transparent opacity={0.1 * disc} depthWrite={false} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined as any, undefined as any, DASH]} frustumCulled={false}>
        <boxGeometry args={[0.75, 0.05, 0.34]} />
        <meshStandardMaterial color="#ffd400" emissive="#ffcc00" emissiveIntensity={0.4} roughness={0.6} />
      </instancedMesh>
      {Array.from({length: 8}, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const k = clamp(cones * 1.4 - i * 0.05);
        return (
          <group key={i} position={[Math.cos(a) * (RING_R + 0.6), 0, Math.sin(a) * (RING_R + 0.6)]} scale={[k, k, k]} visible={k > 0.01}>
            <Cone rad={0.28} h={0.7} p={[0, 0.35, 0]} c="#ff6a00" ro={0.55} />
            <Box s={[0.5, 0.05, 0.5]} p={[0, 0.03, 0]} c="#1f2327" cast={false} />
            <Cone rad={0.19} h={0.12} p={[0, 0.38, 0]} c="#ffffff" ro={0.5} />
          </group>
        );
      })}
    </group>
  );
};
void OMEGA_FULL;
void prog;
void ramp;
