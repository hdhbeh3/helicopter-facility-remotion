import React, {useMemo} from 'react';
import * as THREE from 'three';
import {hangar as hangarState} from '../tracks';
import {HANGAR} from '../layout';
import {Box, Cyl} from './prims';
import {concreteTex, repeated} from './textures';

type HS = ReturnType<typeof hangarState>;
const STEEL = '#8794a2';
const ALPHA = Math.atan(1.9 / 9);

const HangarImpl = ({h, wet}: {h: HS; wet: number}) => {
  const {x, z, w, d} = HANGAR;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const conc = useMemo(() => repeated(concreteTex(), 4, 4), []);
  const gable = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-d / 2, 0);
    sh.lineTo(d / 2, 0);
    sh.lineTo(0, 1.9);
    sh.closePath();
    const g = new THREE.ShapeGeometry(sh);
    g.rotateY(Math.PI / 2);
    return g;
  }, []);
  const cols: [number, number][] = [];
  [x0 + 0.2, x, x1 - 0.2].forEach((cx) => [z0 + 0.2, z1 - 0.2].forEach((cz) => cols.push([cx, cz])));
  const O = h.open;
  const doorX = x0 - 0.15;
  const panels = [
    {c: -12.5, sh: -3, xo: 0},
    {c: -9.5, sh: -6, xo: -0.17},
    {c: -6.5, sh: 6, xo: -0.17},
    {c: -3.5, sh: 3, xo: 0},
  ];
  const wallY = 3.75 * h.walls;
  return (
    <group>
      <mesh position={[x, 0.06, z]} visible={h.floor > 0.01} scale={[1, h.floor, 1]} receiveShadow>
        <boxGeometry args={[w + 0.6, 0.12, d + 0.6]} />
        <meshStandardMaterial map={conc} color="#c7c9cc" roughness={0.85 - 0.55 * wet} />
      </mesh>
      {/* columns */}
      <group visible={h.columns > 0.01}>
        {cols.map(([cx, cz], i) => (
          <Box key={i} s={[0.4, 7.5, 0.4]} p={[cx, 3.75 * h.columns, cz]} sc={[1, h.columns, 1]} c={STEEL} m={0.8} ro={0.4} />
        ))}
      </group>
      {/* rafters slide in from above */}
      <group visible={h.rafters > 0.01} position={[0, (1 - h.rafters) * 6, 0]}>
        {[x0 + 0.2, x, x1 - 0.2].map((fx) => (
          <group key={fx}>
            <Box s={[0.3, 0.38, 9.2]} p={[fx, 8.45, z - 4.5]} r={[-ALPHA, 0, 0]} c={STEEL} m={0.8} ro={0.4} />
            <Box s={[0.3, 0.38, 9.2]} p={[fx, 8.45, z + 4.5]} r={[ALPHA, 0, 0]} c={STEEL} m={0.8} ro={0.4} />
          </group>
        ))}
      </group>
      {/* roof panels with translucent skylights */}
      <group visible={h.roof > 0.01} position={[0, (1 - h.roof) * 5, 0]}>
        {[-1, 1].map((sg) => (
          <group key={sg} position={[x, 8.68, z + sg * 4.5]} rotation={[sg * ALPHA, 0, 0]}>
            <Box s={[w + 0.6, 0.14, 9.3]} c="#d3dae1" m={0.65} ro={0.32} />
            {[-3.4, 3.4].map((sx) => (
              <Box key={sx} s={[3.4, 0.17, 2.4]} p={[sx, 0.02, 0]} c="#9fe0ff" m={0.1} ro={0.05} op={0.55} em="#bfeaff" ei={0.5} cast={false} />
            ))}
          </group>
        ))}
      </group>
      {/* walls */}
      <group visible={h.walls > 0.01}>
        <Box s={[w, 7.5, 0.2]} p={[x, wallY, z0]} sc={[1, h.walls, 1]} c="#e4eaf0" m={0.35} ro={0.45} />
        <Box s={[w, 7.5, 0.2]} p={[x, wallY, z1]} sc={[1, h.walls, 1]} c="#e4eaf0" m={0.35} ro={0.45} />
        <Box s={[0.2, 7.5, d]} p={[x1, wallY, z]} sc={[1, h.walls, 1]} c="#e4eaf0" m={0.35} ro={0.45} />
        <Box s={[w, 0.9, 0.22]} p={[x, 0.45 + 0.0, z0 - 0.01]} c="#1f63c6" ro={0.5} />
        <Box s={[w, 0.9, 0.22]} p={[x, 0.45, z1 + 0.01]} c="#1f63c6" ro={0.5} />
        {/* front piers + lintel + gable fills */}
        <Box s={[0.3, 7.5, 3]} p={[x0, wallY, z0 + 1.5]} sc={[1, h.walls, 1]} c="#e4eaf0" m={0.35} ro={0.45} />
        <Box s={[0.3, 7.5, 3]} p={[x0, wallY, z1 - 1.5]} sc={[1, h.walls, 1]} c="#e4eaf0" m={0.35} ro={0.45} />
        <Box s={[0.3, 1.5, 12]} p={[x0, 6.75, z]} c="#c9d1d9" m={0.4} ro={0.4} vis={h.walls > 0.9} />
        {h.roof > 0.9 && (
          <>
            <mesh geometry={gable} position={[x0, 7.5, z]}>
              <meshStandardMaterial color="#e4eaf0" metalness={0.35} roughness={0.45} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={gable} position={[x1, 7.5, z]}>
              <meshStandardMaterial color="#e4eaf0" metalness={0.35} roughness={0.45} side={THREE.DoubleSide} />
            </mesh>
          </>
        )}
      </group>
      {/* sliding doors (4 panels) */}
      <group visible={h.doors > 0.01} scale={[1, h.doors, 1]}>
        {panels.map((p, i) => (
          <group key={i} position={[doorX + p.xo, 3.0 * h.doors, z + 8 + p.c + p.sh * O]}>
            <Box s={[0.14, 6, 3]} c="#4f7599" m={0.55} ro={0.35} />
            {[-1.8, -0.6, 0.6, 1.8].map((ry) => (
              <Box key={ry} s={[0.16, 0.08, 3.02]} p={[-0.01, ry + 0.4, 0]} c="#35536f" m={0.6} cast={false} />
            ))}
            <Box s={[0.16, 0.7, 2.4]} p={[-0.01, 1.9, 0]} c="#bfe6ff" m={0.3} ro={0.1} op={0.7} em="#9fd8ff" ei={0.35} cast={false} />
          </group>
        ))}
        <Cyl rt={0.05} h={12 + 6} p={[doorX - 0.05, 6.2, z]} r={[Math.PI / 2, 0, 0]} c="#6b7480" m={0.9} />
      </group>
      {/* interior lighting */}
      <group>
        {[-4, 0, 4].map((lz) => (
          <Box key={lz} s={[10, 0.08, 0.5]} p={[x, 7.3, z + lz]} c="#ffffff" em="#fff4de" ei={3 * h.lights} cast={false} vis={h.lights > 0.01} />
        ))}
        {h.lights > 0.001 && <pointLight position={[x - 1, 5.2, z]} intensity={h.lights * 320} distance={34} decay={1.6} color="#fff0d8" />}
      </group>
    </group>
  );
};

const hsig = (h: HS) => `${h.floor}|${h.columns}|${h.rafters}|${h.roof}|${h.walls}|${h.doors}|${h.open}|${h.lights}`;
export const Hangar = React.memo(HangarImpl, (a, b) => hsig(a.h) === hsig(b.h) && Math.abs(a.wet - b.wet) < 0.02);
