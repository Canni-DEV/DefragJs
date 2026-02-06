import { Vec3 } from '../../core/Math/Vec3';

export const BUTTON_JUMP = 1 << 1;

export type UserCmd = {
  forwardmove: number;
  rightmove: number;
  upmove: number;
  buttons: number;
  msec: number;
  viewYaw: number;
  viewPitch: number;
};

export type PlayerState = {
  position: Vec3;
  velocity: Vec3;
  onGround: boolean;
  groundNormal: Vec3;
  ducked: boolean;
  bboxMins: Vec3;
  bboxMaxs: Vec3;
  viewHeight: number;
};

export type PmoveParams = {
  friction: number;
  stopSpeed: number;
  accelerate: number;
  airAccelerate: number;
  airSpeedCap: number;
  airControl: number;
  strafeAccelerate: number;
  gravity: number;
  jumpVelocity: number;
  stepSize: number;
  overclip: number;
  wishSpeed: number;
  duckScale: number;
  rampBoost: number;
};
