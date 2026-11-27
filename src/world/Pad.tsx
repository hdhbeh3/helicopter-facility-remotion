import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {clamp, easeOut, easeOutBack, lerp, mulberry32, prog, smooth} from '../math';
import {T} from '../timeline';
import {pad as padState, REBAR_COUNT, REBAR_START, REBAR_STEP} from '../tracks';
import {groundDip, groundRim} from '../dip';
import {PAD_HALF} from '../layout';
import {concreteTex, gravelTex, lawnTex, repeated, soilTex} from './textures';
import {Box, Cyl, Sph} from './prims';
import {worldUV} from './Ground';

export const CUT_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);
const SZ = PAD_HALF * 2 - 0.02;

type PS = ReturnType<typeof padState>;

/** painted helipad "H" (+ ring); grows bar by bar */
export const HMark = ({draw, y, color = '#ffffff', ring = 0, opacity = 1}: {draw: number; y: number; color?: string; ring?: number; opacity?: number}) => {
  const bar = (p: number, len: number, w: number, x: number, z: number, along: 'z' | 'x') => {
    const k = clamp(p);
    const L = len * k;
    const sz: [number, number, number] = along === 'z' ? [w, 0.02, Math.max(L, 0.001)] : [Math.max(L, 0.001), 0.02, w];
    const pos: [number, number, number] = along === 'z' ? [x, y, z - (len - L) / 2] : [x - (len - L) / 2, y, z];
    return <Box s={sz} p={pos} c={color} ro={0.55} op={opacity} cast={false} em={color} ei={0.12} vis={k > 0.001 && opacity > 0.01} />;
  };
  return (
    <group>
      {bar(draw / 0.42, 3.2, 0.42, -0.85, 0, 'z')}
      {bar((draw - 0.33) / 0.42, 3.2, 0.42, 0.85, 0, 'z')}
      {bar((draw - 0.66) / 0.34, 1.3, 0.42, -0.65, 0, 'x')}
      {ring > 0.01 && (
        <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.0, 3.2, 64]} />
          <meshStandardMaterial color="#f5c400" emissive="#f5c400" emissiveIntensity={0.12} transparent opacity={ring * opacity} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

/** soil cross-section face at z = 1 used by the cutaway close-up */
const Band = ({color, tops, bottoms, wet, t, sink}: {color: string; tops: (x: number) => number; bottoms: (x: number) => number; wet?: boolean; t: number; sink: number}) => {
  const N = 97;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const nrm = new Float32Array(N * 2 * 3);
    for (let i = 0; i < N * 2; i++) nrm[i * 3 + 2] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    return g;
  }, []);
  useLayoutEffect(() => {
    const pa = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const x = -PAD_HALF + (i / (N - 1)) * PAD_HALF * 2;
      pa.setXYZ(i * 2, x, tops(x), 1.0);
      pa.setXYZ(i * 2 + 1, x, bottoms(x), 1.0);
    }
    pa.needsUpdate = true;
    geo.computeBoundingSphere();
  }, [t, sink]);
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <meshStandardMaterial color={color} roughness={wet ? 0.45 : 0.95} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
};
const SoilSection = ({t, sink}: {t: number; sink: number}) => {
  const top = (x: number) => 0.003 - groundDip(x, 1, sink) + groundRim(x, 1.42, sink);
  const lay = (base: number, f: number) => (x: number) => base - groundDip(x, 1, sink) * f;
  return (
    <group>
      <Band color="#3f9d33" tops={top} bottoms={lay(-0.09, 0.95)} t={t} sink={sink} />
      <Band color="#4b2f1b" tops={lay(-0.09, 0.95)} bottoms={lay(-0.45, 0.6)} t={t} sink={sink} />
      <Band color="#6a4426" tops={lay(-0.45, 0.6)} bottoms={lay(-0.95, 0.25)} wet t={t} sink={sink} />
      <Band color="#8d6b4a" tops={lay(-0.95, 0.25)} bottoms={() => -1.4} t={t} sink={sink} />
    </group>
  );
};

const bars = Array.from({length: REBAR_COUNT}, (_, k) => ({along: k < 9 ? 'x' : 'z', pos: -3.2 + 0.8 * (k % 9), k}));
const chairs = (() => {
  const a: [number, number][] = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) a.push([-3.2 + 1.6 * i, -3.2 + 1.6 * j]);
  return a;
})();

const PadSiteImpl = ({t, p, wet, tHeliY}: {t: number; p: PS; wet: number; tHeliY: number}) => {
  const grassRef = useRef<THREE.PlaneGeometry>(null);
  const conRef = useRef<THREE.PlaneGeometry>(null);
  const {invalidate} = useThree();
  const soil = useMemo(() => soilTex(), []);
  const pitSoil = useMemo(() => repeated(soilTex(), 2, 1), []);
  const gravel = useMemo(() => repeated(gravelTex(), 2, 2), []);
  const conc = useMemo(() => repeated(concreteTex(), 2, 2), []);
  CUT_PLANE.constant = p.cutaway ? 1 : 1e4;

  // deformable grass patch (mud sinks) --------------------------------------
  const grassGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SZ, SZ, 48, 48);
    g.rotateX(-Math.PI / 2);
    worldUV(g, 16);
    return g;
  }, []);
  const conGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SZ, SZ, 28, 28);
    g.rotateX(-Math.PI / 2);
    worldUV(g, 4);
    return g;
  }, []);
  useLayoutEffect(() => {
    const pa = grassGeo.attributes.position as THREE.BufferAttribute;
    const sink = p.sink;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i);
      pa.setY(i, 0.004 - groundDip(x, z, sink) + groundRim(x, z, sink));
    }
    pa.needsUpdate = true;
    grassGeo.computeVertexNormals();
    invalidate();
  }, [p.sink]);
  const flat = useRef(true);
  useLayoutEffect(() => {
    const active = t >= T.pour && t <= T.poured + 0.8;
    if (!active && flat.current) return; // nothing to recompute outside the pour
    flat.current = !active;
    const pa = conGeo.attributes.position as THREE.BufferAttribute;
    const flow = p.concreteOn && t < T.poured + 0.6 ? 1 - smooth(prog(t, T.poured - 0.4, T.poured + 0.6)) : 0;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i);
      pa.setY(i, flow * 0.045 * (Math.sin(x * 1.7 - t * 6) * Math.cos(z * 1.3 + t * 4.3) + 0.5 * Math.sin((x + z) * 3.1 - t * 9)));
    }
    pa.needsUpdate = true;
    conGeo.computeVertexNormals();
    invalidate();
  }, [t]);

  const soilH = 1.4 + p.soilTop;
  const gravelH = Math.max(0.0001, 0.3 * p.gravel * (1 - 0.1 * Math.sin(Math.PI * clamp((t - 11.9) / 0.5))));
  const e = p.explode;
  const conTop = p.concreteTop + e * 2.7;
  const conH = Math.max(0.0001, p.concreteTop + 0.72);
  const curedColor = new THREE.Color('#7b7d80').lerp(new THREE.Color('#c0c2c4'), p.cure).getStyle();
  const grassVis = p.grassScale > 0.01;

  return (
    <group>
      {/* pit cavity */}
      <mesh position={[0, -0.7, 0]}>
        <boxGeometry args={[SZ + 0.02, 1.4, SZ + 0.02]} />
        <meshLambertMaterial map={pitSoil} color="#b38f6e" side={THREE.BackSide} />
      </mesh>
      {/* sub-soil block (top lowers when excavated) */}
      <mesh position={[0, -1.4 + soilH / 2, 0]} scale={[1, Math.max(soilH, 0.001), 1]} receiveShadow castShadow>
        <boxGeometry args={[SZ, 1, SZ]} />
        <meshLambertMaterial map={soil} color="#c9a07c" clippingPlanes={[CUT_PLANE]} />
      </mesh>
      {/* grass patch + painted H on grass */}
      <group visible={grassVis} scale={[p.grassScale, 1, p.grassScale]}>
        <mesh geometry={grassGeo} receiveShadow>
          <meshLambertMaterial map={lawnTex()} clippingPlanes={[CUT_PLANE]} side={THREE.DoubleSide} />
        </mesh>
        <HMark draw={p.hDraw} y={0.02} />
      </group>
      {/* gravel base */}
      <mesh position={[0, -1.0 + gravelH / 2 + e * 0.9, 0]} scale={[1, gravelH, 1]} visible={p.gravel > 0.001} receiveShadow castShadow>
        <boxGeometry args={[SZ - 0.1, 1, SZ - 0.1]} />
        <meshLambertMaterial map={gravel} />
      </mesh>
      {/* timber formwork */}
      {p.formwork > 0.01 &&
        [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].map(([ax, az], i) => (
          <Box key={i} s={[ax ? 0.07 : SZ, 0.34 * p.formwork, az ? 0.07 : SZ]} p={[ax * (PAD_HALF - 0.05), -0.25 + e * 2.0, az * (PAD_HALF - 0.05)]} c="#b98b55" ro={0.85} vis={t < 17.3} />
        ))}
      {/* rebar grid: bars drop in one by one */}
      {bars.map((b) => {
        const t0 = REBAR_START + b.k * REBAR_STEP;
        if (t < t0) return null;
        const u = prog(t, t0, t0 + 0.45);
        const y = (b.along === 'x' ? -0.5 : -0.43) + (1 - easeOutBack(u)) * 3.2 + e * 1.8;
        return (
          <mesh key={b.k} position={b.along === 'x' ? [0, y, b.pos] : [b.pos, y, 0]} rotation={b.along === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, SZ - 0.5, 8]} />
            <meshStandardMaterial color="#363a40" metalness={0.85} roughness={0.42} />
          </mesh>
        );
      })}
      {t > REBAR_START + 0.7 &&
        chairs.map(([x, z], i) => <Box key={i} s={[0.1, 0.14, 0.1]} p={[x, -0.6 + e * 1.0, z]} c="#e7b416" ro={0.6} cast={false} vis={t < 15.8 || e > 0.01} />)}
      {/* concrete: body + flowing top surface */}
      <group visible={p.concreteOn}>
        <mesh position={[0, p.concreteTop - conH / 2 - 0.0 + e * 2.7 - 0.01, 0]} scale={[1, conH, 1]} castShadow receiveShadow>
          <boxGeometry args={[SZ - 0.1, 1, SZ - 0.1]} />
          <meshStandardMaterial map={conc} color={curedColor} roughness={lerp(0.2, 0.88, p.cure) - 0.5 * wet * p.cure} metalness={0.02} />
        </mesh>
        <mesh geometry={conGeo} position={[0, conTop + 0.002, 0]} scale={[(SZ - 0.1) / SZ, 1, (SZ - 0.1) / SZ]} receiveShadow>
          <meshStandardMaterial map={conc} color={curedColor} roughness={lerp(0.18, 0.88, p.cure) - 0.55 * wet * p.cure} metalness={0.02} />
        </mesh>
        <HMark draw={1} y={conTop + 0.016} ring={p.hPaint} opacity={p.hPaint} />
      </group>
      {p.cutaway && <SoilSection t={t} sink={p.sink} />}
    </group>
  );
};

/* ---------------- construction machinery ---------------- */
export const Excavator = ({x, dig, on}: {x: number; dig: number; on: boolean}) => {
  const swing = Math.sin(dig * 2.2);
  const a1 = -0.55 + 0.35 * swing;
  const a2 = 0.5 - 0.6 * Math.sin(dig * 2.2 + 1.2);
  const a3 = 0.6 + 0.6 * Math.sin(dig * 2.2 + 2.0);
  return (
    <group position={[x, 0, 2.6]} rotation={[0, -Math.PI / 2 - 0.3, 0]} visible={on}>
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.6, 0.55, 3.2]} p={[s * 1.15, 0.3, 0]} c="#2b2d31" ro={0.9} />
      ))}
      <Box s={[2.2, 0.35, 2.3]} p={[0, 0.7, 0]} c="#f2b400" m={0.2} ro={0.5} />
      <Box s={[1.6, 1.0, 1.4]} p={[0.2, 1.4, -0.4]} c="#f2b400" m={0.2} ro={0.5} />
      <Box s={[1.1, 0.8, 0.05]} p={[0.2, 1.55, 0.31]} c="#1f3b57" m={0.9} ro={0.1} op={0.8} />
      <Box s={[1.0, 0.7, 0.8]} p={[0.2, 1.1, -1.5]} c="#555a61" m={0.6} ro={0.5} />
      <group position={[0.1, 1.0, 0.7]} rotation={[a1, 0, 0]}>
        <Box s={[0.35, 0.45, 3.3]} p={[0, 0.1, 1.55]} c="#f2b400" m={0.2} ro={0.5} />
        <group position={[0, 0, 3.2]} rotation={[a2, 0, 0]}>
          <Box s={[0.28, 0.3, 2.3]} p={[0, 0, 1.0]} c="#e8a900" m={0.2} ro={0.5} />
          <group position={[0, 0, 2.15]} rotation={[a3, 0, 0]}>
            <Box s={[0.9, 0.6, 0.8]} p={[0, -0.25, 0.3]} c="#3a3d42" m={0.8} ro={0.4} />
          </group>
        </group>
      </group>
    </group>
  );
};
export const MixerTruck = ({x, on, t, pouring}: {x: number; on: boolean; t: number; pouring: number}) => (
  <group position={[x, 0, -0.2]} rotation={[0, Math.PI / 2, 0]} visible={on}>
    <Box s={[2.3, 0.4, 7.0]} p={[0, 0.85, -0.2]} c="#3a3f46" m={0.5} ro={0.5} />
    <Box s={[2.2, 1.5, 1.5]} p={[0, 1.7, 2.6]} c="#e8eaee" m={0.25} ro={0.35} />
    <Box s={[2.0, 0.7, 0.05]} p={[0, 2.1, 3.36]} c="#1f3b57" m={0.9} ro={0.1} op={0.85} />
    <Box s={[2.25, 0.35, 1.52]} p={[0, 1.1, 2.6]} c="#ff7a00" m={0.3} ro={0.5} />
    <group position={[0, 2.35, -0.7]} rotation={[-0.2, 0, 0]}>
      <group rotation={[0, 0, t * 2.6]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[1.25, 0.95, 4.4, 28]} />
          <meshStandardMaterial color="#f08a00" metalness={0.35} roughness={0.4} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <Box key={i} s={[0.12, 0.1, 4.2]} p={[Math.cos((i * Math.PI * 2) / 3) * 1.18, Math.sin((i * Math.PI * 2) / 3) * 1.18, 0]} r={[0, 0, (i * Math.PI * 2) / 3]} c="#ffffff" ro={0.5} />
        ))}
      </group>
    </group>
    {[-1.1, 1.1].map((sx) => [-2.2, -0.6, 2.4].map((z) => <Cyl key={`${sx}${z}`} rt={0.55} h={0.35} p={[sx, 0.55, z]} r={[0, 0, Math.PI / 2]} c="#1b1b1b" ro={0.9} />))}
    {/* rear chute */}
    <group position={[0, 2.0, -2.9]} rotation={[-0.55, 0, 0]}>
      <Box s={[0.5, 0.28, 2.6]} p={[0, 0, -1.2]} c="#aeb4bb" m={0.8} ro={0.3} />
    </group>
    {pouring > 0.01 && <group />}
  </group>
);
export const ConcreteStream = ({k, top}: {k: number; top: number}) => {
  const y0 = 0.75;
  const h = Math.max(0.01, y0 - top);
  return (
    <group visible={k > 0.02}>
      <Cyl rt={0.12 * k} h={h} p={[3.0, top + h / 2, 0]} c="#8b8d90" ro={0.25} cast={false} />
      <Sph rad={0.28 * k} sc={[1, 0.35, 1]} p={[3.0, top + 0.02, 0]} c="#9a9c9f" ro={0.2} cast={false} />
    </group>
  );
};

/* ---------------- ballistic debris (mud / soil / concrete splashes) ---------------- */
interface Ev {
  t0: number;
  t1: number;
  o: [number, number, number];
  spread: number;
  speed: number;
  color: string;
  n: number;
  size: number;
}
const EVENTS: Ev[] = [
  {t0: T.touch + 0.05, t1: T.sinkEnd, o: [0, 0.05, 1.0], spread: 2.0, speed: 1.6, color: '#4a2f1b', n: 36, size: 0.06},
  {t0: T.touch + 0.05, t1: T.sinkEnd, o: [0, 0.05, -1.0], spread: 2.0, speed: 1.6, color: '#3d2615', n: 24, size: 0.06},
  {t0: 10.35, t1: 11.7, o: [3.2, 0.6, 0.4], spread: 0.8, speed: 2.4, color: '#6a4a2c', n: 40, size: 0.11},
  {t0: T.pour + 0.15, t1: T.poured, o: [3.0, -0.3, 0], spread: 0.5, speed: 1.6, color: '#9d9fa2', n: 24, size: 0.06},
];
const TOTAL = EVENTS.reduce((s, e) => s + e.n, 0);
export const Debris = ({t}: {t: number}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const {invalidate} = useThree();
  const data = useMemo(() => {
    const r = mulberry32(91);
    const out: {e: Ev; d: number; vx: number; vy: number; vz: number}[] = [];
    EVENTS.forEach((e) => {
      for (let i = 0; i < e.n; i++) {
        const a = r() * 6.283;
        out.push({e, d: (i / e.n) * (e.t1 - e.t0) * 0.85, vx: Math.cos(a) * e.speed * r() * e.spread, vy: e.speed * (0.6 + r()), vz: Math.sin(a) * e.speed * r() * e.spread});
      }
    });
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    data.forEach((d, i) => {
      const tau = t - d.e.t0 - d.d;
      const life = 0.9;
      if (tau < 0 || tau > life) {
        o.scale.setScalar(0);
      } else {
        const y = d.e.o[1] + d.vy * tau - 4.9 * tau * tau;
        o.position.set(d.e.o[0] + d.vx * tau, Math.max(y, 0.02), d.e.o[2] + d.vz * tau);
        o.scale.setScalar(d.e.size * (1 - tau / life * 0.4));
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(d.e.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, TOTAL]} frustumCulled={false} castShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" roughness={0.8} />
    </instancedMesh>
  );
};
void easeOut;

/** once the pad is built (t > 18.7 s) the site only changes with wetness, so skip re-rendering it */
export const PadSite = React.memo(PadSiteImpl, (a, b) => a.t >= 18.7 && b.t >= 18.7 && Math.abs(a.wet - b.wet) < 0.02 && a.p.cure === b.p.cure && a.p.hPaint === b.p.hPaint && a.p.explode === b.p.explode);
