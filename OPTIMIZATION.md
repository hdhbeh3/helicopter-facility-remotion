# Render optimisation report

## What was measured vs. what was not
* Your benchmark: 90 frames in 27 m 35 s = **18.4 s/frame** (`swangle`, concurrency 1) -> ~10 h for 1964 frames.
* **No benchmark of the optimised project exists yet.** The environment this was prepared in has no Chrome, no Remotion and no three.js
  (no network), so nothing could be rendered or timed. The changes below are based on reading the scene code and on how a CPU (SwiftShader)
  rasteriser behaves. Real speed-ups must be measured: run the workflow with `mode=benchmark` (it times 5 demanding moments
  and prints an ETA) before spending hours on a full render.

## Bottleneck analysis (from the code, ordered by expected cost on a CPU renderer)
| # | Finding | Evidence |
|---|---|---|
| 1 | 4x MSAA on a 1080x1920 canvas | `gl={{antialias: true}}` |
| 2 | Three point lights mounted for the entire video (intensity 0 when "off") - every lit pixel still loops over them | `Hangar.tsx` x2, `Station.tsx` x1 |
| 3 | One 2048^2 PCF-soft shadow map covering +-62 m in every scene; every caster in the scene drawn into it | `Atmosphere.tsx` |
| 4 | Full-screen lawn + ~7000 double-sided blades on the heavy PBR shader (blades overdraw in close-ups) | `Ground.tsx` |
| 5 | Anisotropic filtering x8 on all canvas textures | `textures.ts` |
| 6 | 48 large transparent cloud spheres (overdraw) | `Atmosphere.tsx` |
| 7 | Hidden subtrees (hangar, underground, rain, airflow...) always mounted | `World.tsx` |
| 8 | Geometry rebuilt every frame when `args` change (soil/gravel/concrete growth, 44 droplets) | `Pad.tsx`, `Heli.tsx` |
| 9 | Whole static subtrees re-rendered by React every frame (house, hangar, station, furniture after rest) | `World.tsx` |
| 10 | 72 separate meshes for the safety ring | `Effects.tsx` |
Grass, rain and particle *CPU* update loops are small (a few thousand matrix writes); they were NOT the dominant cost. The cost is in the pixel pipeline.

## Changes
1. MSAA off by default (`--props='{"aa":true}'` / workflow input restores it). Trade-off: thin edges (rotor, rebar, ring) are less smooth.
2. Point lights: 0 permanent, at most ONE at a time (underground 41.0-44.9 s, hangar interior from 53.2 s). Hangar went from 2 lights to 1.
3. Sun shadow frustum fitted per scene (`src/budget.ts`): +-22 m close-ups ... +-64 m final wide; map 1536^2, basic PCF. Centres are fixed per scene (no shadow swimming).
   Tight frustums give sharper shadows from fewer texels and cull far casters.
4. Lawn, grass blades, soil, gravel, tree foliage: Lambert shading instead of full PBR. Blades 7000 -> 3500 (dense near the pad, sparse far).
   Hero materials (helicopter incl. clear-coat, glass, steel, concrete, fuel equipment, windsock) keep PBR + reflections.
5. Anisotropy 8 -> 4. Clouds: 48 transparent spheres -> 24 opaque low-poly. Rain 1800->1100, airflow 170->110, wind specks 140->90.
6. Everything not visible is unmounted (excavator, mixer truck, chute, debris, windsock before its cue, safety ring before its cue, hangar, tug, gauge,
   underground cutaway, rain, airflow, specks, hose). `scripts/check-budget.ts` proves for all 1964 frames that nothing visible is ever unmounted.
7. Geometry created once: soil/gravel/concrete grow via `scale`, droplets and safety ring are single `InstancedMesh`es, grass patch 80x80 -> 48x48 segments,
   concrete ripple recomputed only during the pour.
8. `React.memo` with exact comparators on House, helicopter (static from 56.3 s), garden items (static from 28 s), pad site (static from 18.7 s), hangar, fuel station.
9. No per-frame colour/object allocation in the atmosphere.
10. Config: `swangle`, concurrency = cores/2 (env `REMOTION_CONCURRENCY`), JPEG frames.
11. **Workflow**: `parallel` mode renders N frame-range chunks on separate runners (each its own 5.5 h limit), then stream-copy concatenates and muxes the
    ORIGINAL voiceover + music + SFX. This is what guarantees the 5.5 h limit regardless of per-frame speed. `benchmark` mode measures real s/frame first.

## Visual details intentionally preserved
Detailed helicopter (fuselage, glass, skids, rotors, tail rotor, lights, droplets), soil cutaway + deforming mud, excavation, gravel, rebar grid, formwork, pour,
exploded layers, safety ring/cones, windsock fabric, underground tank/pump/filter/valves with amber flow, fuel station safety gear, hangar structure/doors/skylights,
rain, lightning, storm lighting, reflections (environment map) on hero materials, shadows, all camera moves, timing and audio.

## Things you may notice (unverified until you look at the stills)
* Lawn/foliage lose specular highlights and the environment-map ambient term (hemisphere light provides ambient). Brightness may differ slightly from the first build.
* Edges are not anti-aliased by default.
* Shadow softness changes slightly at scene boundaries because the frustum size changes.
