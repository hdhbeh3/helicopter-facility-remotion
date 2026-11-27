import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {lerp, mulberry32} from '../math';
import type {Weather} from '../tracks';
import {SHADOW_MAP, SUN_DIR, shadowFit} from '../budget';

const SKY_TOP = new THREE.Color('#2f86e8');
const SKY_HOR = new THREE.Color('#bfe4ff');
const STORM_TOP = new THREE.Color('#3d4857');
const STORM_HOR = new THREE.Color('#7e8996');
// reusable colours: nothing is allocated per frame
const HOR = new THREE.Color();
const TOP = new THREE.Color();
const SKY_UNIFORMS = {top: {value: TOP}, hor: {value: HOR}};
const SKY_VS = 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SKY_FS = 'uniform vec3 top; uniform vec3 hor; varying float vY; void main(){ float k = pow(clamp(vY,0.0,1.0),0.55); gl_FragColor = vec4(mix(hor, top, k), 1.0); }';

const Clouds = React.memo(
  ({dark}: {dark: number}) => {
    const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 7), []);
    const clouds = useMemo(() => {
      const r = mulberry32(12);
      return Array.from({length: 8}, () => {
        const a = r() * 6.283;
        const d = 170 + r() * 200;
        return {x: Math.cos(a) * d, z: Math.sin(a) * d, y: 70 + r() * 60, s: 1 + r() * 1.4};
      });
    }, []);
    const col = new THREE.Color('#ffffff').lerp(new THREE.Color('#6f7886'), dark).getStyle();
    return (
      <group>
        {clouds.map((c, i) => (
          <group key={i} position={[c.x, c.y, c.z]} scale={[c.s * 26, c.s * 7, c.s * 18]}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} geometry={geo} position={[(k - 1) * 0.5, Math.sin(k * 1.7) * 0.12, 0]} scale={0.55 - k * 0.04}>
                <meshBasicMaterial color={col} fog={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  },
  (a, b) => Math.abs(a.dark - b.dark) < 0.03,
);

export const Atmosphere = ({w, cam}: {w: Weather; cam: {pos: [number, number, number]; look: [number, number, number]; fov: number}}) => {
  const {scene, gl, camera} = useThree();
  // procedural studio environment for reflections (no network assets); built once per page
  useLayoutEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.12;
    (gl as any).localClippingEnabled = true;
    scene.fog = new THREE.Fog('#bfe4ff', 140, 560);
    return () => pm.dispose();
  }, []);
  HOR.copy(SKY_HOR).lerp(STORM_HOR, w.dark * 0.85);
  TOP.copy(SKY_TOP).lerp(STORM_TOP, w.dark * 0.9);
  useLayoutEffect(() => {
    (scene.fog as THREE.Fog).color.copy(HOR);
    scene.background = HOR;
    (scene as any).environmentIntensity = lerp(1.0, 0.45, w.dark) + w.flash * 0.8;
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    c.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    c.fov = cam.fov;
    c.near = 0.08;
    c.far = 900;
    c.updateProjectionMatrix();
  });
  const sky = useMemo(() => new THREE.SphereGeometry(520, 24, 14), []);
  return (
    <group>
      <mesh geometry={sky} frustumCulled={false} renderOrder={-10}>
        <shaderMaterial side={THREE.BackSide} depthWrite={false} fog={false} uniforms={SKY_UNIFORMS} vertexShader={SKY_VS} fragmentShader={SKY_FS} />
      </mesh>
      <Clouds dark={w.dark} />
    </group>
  );
};

/** hemisphere fill + ONE directional sun whose shadow frustum is fitted to the current scene */
export const Lights = ({w, t}: {w: Weather; t: number}) => {
  const sun = useRef<THREE.DirectionalLight>(null);
  const fit = shadowFit(t);
  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    const n = Math.hypot(...SUN_DIR);
    l.position.set(fit.cx + (SUN_DIR[0] / n) * 110, (SUN_DIR[1] / n) * 110, fit.cz + (SUN_DIR[2] / n) * 110);
    l.target.position.set(fit.cx, 0, fit.cz);
    l.target.updateMatrixWorld();
    const s = l.shadow.camera as THREE.OrthographicCamera;
    if (s.right !== fit.ext) {
      s.left = -fit.ext;
      s.right = fit.ext;
      s.top = fit.ext;
      s.bottom = -fit.ext;
      s.near = 10;
      s.far = 260;
      s.updateProjectionMatrix();
    }
  });
  return (
    <group>
      <hemisphereLight args={['#cfe8ff', '#5d7d3b', lerp(1.15, 0.5, w.dark) + w.flash * 4]} />
      <directionalLight
        ref={sun}
        intensity={lerp(3.4, 0.55, w.dark) + w.flash * 6}
        color={w.dark > 0.4 ? '#cfd8e6' : '#fff1d2'}
        castShadow
        shadow-mapSize-width={SHADOW_MAP}
        shadow-mapSize-height={SHADOW_MAP}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
      />
    </group>
  );
};
