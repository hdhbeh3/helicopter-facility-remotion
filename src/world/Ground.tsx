import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {lawnTex, soilTex, repeated} from './textures';
import {clamp, mulberry32} from '../math';
import {HANGAR, HOUSE, STATION, PAD_HALF, WIND} from '../layout';
import {BLADE_COUNT} from '../budget';
import type {HeliState} from '../tracks';
import {useThree} from '@react-three/fiber';

const LAWN_UV = 16;
export function worldUV(geo: THREE.BufferGeometry, scale: number) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / scale;
    uv[i * 2 + 1] = p.getZ(i) / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** lawn with rectangular holes for the pad pit and the fuel-station cutaway */
export const Lawn = ({wet}: {wet: number}) => {
  const geo = useMemo(() => {
    const S = 260;
    const shape = new THREE.Shape();
    shape.moveTo(-S, -S);
    shape.lineTo(S, -S);
    shape.lineTo(S, S);
    shape.lineTo(-S, S);
    shape.closePath();
    const hole = (x0: number, x1: number, z0: number, z1: number) => {
      // shape y = -z after rotateX(-90deg)
      const h = new THREE.Path();
      h.moveTo(x0, -z0);
      h.lineTo(x0, -z1);
      h.lineTo(x1, -z1);
      h.lineTo(x1, -z0);
      h.closePath();
      return h;
    };
    shape.holes.push(hole(-PAD_HALF, PAD_HALF, -PAD_HALF, PAD_HALF));
    shape.holes.push(hole(STATION.hole.x0, STATION.hole.x1, STATION.hole.z0, STATION.hole.z1));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    worldUV(g, LAWN_UV);
    g.computeVertexNormals();
    return g;
  }, []);
  const tex = lawnTex();
  return (
    <mesh geometry={geo} receiveShadow>
      {/* Lambert: the lawn fills most of the frame, so a lighter shader pays off on a CPU renderer */}
      <meshLambertMaterial map={tex} color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
  );
};

/** translucent lawn patch above the underground fuel installation + the soil cavity */
export const StationGround = ({opacity, wet}: {opacity: number; wet: number}) => {
  const h = STATION.hole;
  const w = h.x1 - h.x0;
  const d = h.z1 - h.z0;
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate((h.x0 + h.x1) / 2, 0.002, (h.z0 + h.z1) / 2);
    worldUV(g, LAWN_UV);
    return g;
  }, []);
  const soil = useMemo(() => repeated(soilTex(), 7, 3), []);
  const cx = (h.x0 + h.x1) / 2;
  const cz = (h.z0 + h.z1) / 2;
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshLambertMaterial map={lawnTex()} transparent={opacity < 0.999} opacity={opacity} side={THREE.DoubleSide} depthWrite={opacity > 0.98} />
      </mesh>
      <mesh position={[cx, -h.depth / 2, cz]} receiveShadow>
        <boxGeometry args={[w, h.depth, d]} />
        <meshLambertMaterial map={soil} color="#c9a98a" side={THREE.BackSide} />
      </mesh>
    </group>
  );
};

interface Blade {
  x: number;
  z: number;
  zone: number;
  s: number;
  ph: number;
  yaw: number;
}
const inRect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) => x > x0 && x < x1 && z > z0 && z < z1;
function makeBlades(): Blade[] {
  const r = mulberry32(2026);
  const out: Blade[] = [];
  const hg = HANGAR;
  const st = STATION.slab;
  const push = (x: number, z: number) => {
    if (inRect(x, z, HOUSE.x - HOUSE.w / 2 - 1, HOUSE.x + HOUSE.w / 2 + 1, HOUSE.z - HOUSE.d / 2 - 1, HOUSE.z + HOUSE.d / 2 + 6)) return;
    let zone = 0;
    if (inRect(x, z, -PAD_HALF, PAD_HALF, -PAD_HALF, PAD_HALF)) zone = 1;
    else if (inRect(x, z, hg.x - hg.w / 2 - 0.5, hg.x + hg.w / 2 + 0.5, hg.z - hg.d / 2 - 0.5, hg.z + hg.d / 2 + 0.5)) zone = 2;
    else if (inRect(x, z, st.x - st.w / 2 - 0.3, st.x + st.w / 2 + 0.3, st.z - st.d / 2 - 0.3, st.z + st.d / 2 + 0.3)) zone = 3;
    else if (inRect(x, z, STATION.hole.x0, STATION.hole.x1, STATION.hole.z0, STATION.hole.z1)) zone = 4;
    out.push({x, z, zone, s: 0.7 + r() * 0.7, ph: r() * 6.28, yaw: r() * 6.28});
  };
  for (let i = 0; i < BLADE_COUNT.far; i++) push(-42 + r() * 84, -26 + r() * 74);
  for (let i = 0; i < BLADE_COUNT.near; i++) {
    const a = r() * 6.283;
    const d = Math.sqrt(r()) * 24;
    push(Math.cos(a) * d + 2, Math.sin(a) * d - 4);
  }
  return out;
}

export const GrassBlades = ({
  t,
  heli,
  zones,
  wet,
}: {
  t: number;
  heli: HeliState;
  zones: [number, number, number, number, number];
  wet: number;
}) => {
  const blades = useMemo(makeBlades, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.035, 0, 0, 0.035, 0, 0, 0, 0.26, 0.012]), 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const tmp = useMemo(() => ({m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), ax: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0)}), []);
  const colored = useRef(false);
  const {invalidate} = useThree();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!colored.current) {
      const c = new THREE.Color();
      const r = mulberry32(5);
      blades.forEach((b, i) => {
        c.setHSL(0.27 + r() * 0.05, 0.62 + r() * 0.2, 0.3 + r() * 0.18);
        mesh.setColorAt(i, c);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colored.current = true;
    }
    const {m, q, q2, p, s, ax, up} = tmp;
    const hx = heli.pos[0];
    const hz = heli.pos[2];
    const wash = heli.rpm * clamp(1.15 - heli.pos[1] / 11);
    for (let i = 0; i < blades.length; i++) {
      const b = blades[i];
      const zv = zones[b.zone];
      if (zv < 0.02) {
        s.set(0, 0, 0);
        m.compose(p.set(b.x, 0, b.z), q.identity(), s);
        mesh.setMatrixAt(i, m);
        continue;
      }
      const dx = b.x - hx;
      const dz = b.z - hz;
      const d = Math.hypot(dx, dz) + 0.001;
      const push = wash * Math.exp(-d / 9) * 1.5;
      const sway = 0.13 * Math.sin(t * 2.2 + b.ph) + 0.05 * Math.sin(t * 5.3 + b.ph * 2);
      const lx = (dx / d) * push + WIND[0] * (0.1 + sway) + 0.04 * Math.sin(t * 7 + b.ph * 3) * wash;
      const lz = (dz / d) * push + sway * 0.4;
      const ang = Math.min(1.2, Math.hypot(lx, lz));
      ax.set(lz, 0, -lx);
      if (ax.lengthSq() < 1e-8) ax.set(1, 0, 0);
      ax.normalize();
      q.setFromAxisAngle(ax, ang);
      q2.setFromAxisAngle(up, b.yaw);
      q.multiply(q2);
      const k = b.s * zv * (1 - 0.3 * wet);
      s.set(k, k, k);
      m.compose(p.set(b.x, 0, b.z), q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined as any, blades.length]} frustumCulled={false} receiveShadow>
      <meshLambertMaterial color="#ffffff" side={THREE.DoubleSide} />
    </instancedMesh>
  );
};
