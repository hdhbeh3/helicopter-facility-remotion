import React from 'react';
import {FPS, T} from '../timeline';
import {
  airflow,
  cameraAt,
  hangar as hangarState,
  heliState,
  OMEGA_FULL,
  pad as padState,
  rotorAngle,
  safetyZone,
  station as stationState,
  tugState,
  weather,
  windsock as windsockState,
} from '../tracks';
import {SOCK} from '../layout';
import {Atmosphere, Lights} from './Atmosphere';
import {GrassBlades, Lawn, StationGround} from './Ground';
import {Debris, Excavator, MixerTruck, ConcreteStream, PadSite} from './Pad';
import {FuelGauge, Helicopter, TugVehicle} from './Heli';
import {GardenItems, House, Trees, Windsock} from './Scenery';
import {FuelStation} from './Station';
import {Hangar} from './Hangar';
import {Airflow, Rain, SafetyZone, WindSpecks} from './Effects';
import {ramp} from '../math';
import {debrisActive, rainMounted} from '../budget';

export const World = ({frame}: {frame: number}) => {
  const t = frame / FPS;
  const cam = cameraAt(t);
  const w = weather(t);
  const heli = heliState(t);
  const pad = padState(t);
  const st = stationState(t);
  const hg = hangarState(t);
  const sock = windsockState(t);
  const zone = safetyZone(t);
  const tug = tugState(t);
  const rotor = rotorAngle(frame);
  const dolly = hg.dolly;
  const wind = ramp(t, T.wind - 0.3, T.wind + 0.4) * (1 - ramp(t, 37.4, 37.9));
  const zones: [number, number, number, number, number] = [1, pad.grassScale, hg.floor > 0.02 ? 0 : 1, st.slab > 0.02 ? 0 : 1, st.patchOpacity < 0.95 ? 0 : 1];
  const gaugeK = ramp(t, T.lowFuel - 0.2, T.lowFuel + 0.2) * (1 - ramp(t, T.dive - 0.1, T.dive)) + ramp(t, 45.9, 46.2) * (1 - ramp(t, 47.1, 47.3));

  return (
    <>
      <Atmosphere w={w} cam={cam} />
      <Lights w={w} t={t} />
      <Lawn wet={w.wet} />
      <StationGround opacity={st.patchOpacity} wet={w.wet} />
      <GrassBlades t={t} heli={heli} zones={zones} wet={w.wet} />
      <PadSite t={t} p={pad} wet={w.wet} tHeliY={heli.pos[1]} />
      {pad.excavator.on && <Excavator x={pad.excavator.x} dig={t} on />}
      {pad.truck.on && <MixerTruck x={pad.truck.x} on t={t} pouring={pad.chute} />}
      {pad.chute > 0.02 && <ConcreteStream k={pad.chute} top={pad.concreteTop} />}
      {debrisActive(t) && <Debris t={t} />}
      <House />
      <Trees t={t} heli={heli} />
      <GardenItems t={t} />
      {t >= T.clear && <SafetyZone ring={zone.ring} cones={zone.cones} disc={zone.disc} />}
      {t >= T.sock && <Windsock pole={sock.pole} inflate={sock.inflate} t={t} x={SOCK.x} z={SOCK.z} h={SOCK.h} />}
      <FuelStation s={st} t={t} wet={w.wet} />
      {gaugeK > 0.01 && <FuelGauge fuel={st.fuel} visible t={t} k={gaugeK} />}
      {hg.floor > 0.001 && <Hangar h={hg} wet={w.wet} />}
      {hg.tug > 0.01 && t < 56.5 && <TugVehicle pos={tug.pos} yaw={tug.yaw} vis />}
      <Helicopter h={heli} rotor={rotor} tailRotor={rotor * 5} wet={w.wet} dolly={dolly} t={t} />
      {airflow(t) > 0.01 && <Airflow t={t} k={airflow(t)} heli={heli} />}
      {wind > 0.01 && <WindSpecks t={t} k={wind} />}
      {rainMounted(t) && <Rain t={t} intensity={w.rain} focus={cam.look} hangarBuilt={hg.roof > 0.95} />}
    </>
  );
};
void OMEGA_FULL;
