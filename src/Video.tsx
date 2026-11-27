import React from 'react';
import {AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {FPS, HEIGHT, WIDTH} from './timeline';
import {cameraBlur} from './tracks';
import {World} from './world/World';

// MSAA at 1080x1920 is one of the costliest things on a CPU renderer, so it is OFF by default.
// Enable with: --props='{"aa":true}'
const AA = Boolean((getInputProps() as {aa?: boolean}).aa);

export const Video: React.FC = () => {
  const frame = useCurrentFrame();
  const blur = cameraBlur(frame / FPS);
  return (
    <AbsoluteFill style={{backgroundColor: '#9fd0f5'}}>
      <AbsoluteFill style={{filter: blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : undefined}}>
        <ThreeCanvas
          width={WIDTH}
          height={HEIGHT}
          shadows="percentage"
          dpr={1}
          camera={{fov: 50, near: 0.08, far: 900, position: [0, 20, 40]}}
          gl={{antialias: AA, preserveDrawingBuffer: true, powerPreference: 'high-performance'}}
        >
          <World frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
      {/* very subtle vignette for cinematic depth (no text, no logos) */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.16) 100%)', pointerEvents: 'none'}} />
      {/* narration is the untouched supplied MP3; music + SFX beds are pre-ducked under it */}
      <Audio src={staticFile('voiceover.mp3')} volume={1} />
      <Audio src={staticFile('audio/music.wav')} volume={1} />
      <Audio src={staticFile('audio/sfx.wav')} volume={1} />
    </AbsoluteFill>
  );
};
