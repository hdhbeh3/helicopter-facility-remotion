import {Config} from '@remotion/cli/config';

// Stable, memory-friendly settings for GitHub Actions (software GL, no GPU).
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(18);
Config.setX264Preset('medium');
Config.setChromiumOpenGlRenderer('swangle'); // SwiftShader-on-ANGLE: the CPU-only path used on GitHub runners
Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY ?? 2));
Config.setDelayRenderTimeoutInMilliseconds(240000);
Config.setOverwriteOutput(true);
