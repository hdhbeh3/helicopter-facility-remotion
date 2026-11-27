import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timeline';

export const Root: React.FC = () => (
  <Composition id="HelicopterFacility" component={Video} durationInFrames={DURATION_IN_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
