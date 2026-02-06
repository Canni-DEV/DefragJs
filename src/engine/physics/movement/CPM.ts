import { Vec3 } from '../../core/Math/Vec3';
import { PhysicsMode } from './PhysicsModes';
import { UserCmd } from './PmoveTypes';

type AirControlContext = {
  velocity: Vec3;
  wishDir: Vec3;
  wishSpeed: number;
  dt: number;
  cmd: UserCmd;
};

const CPM_AIR_CONTROL = 150;
const AIR_CONTROL_SPEED_SCALE = 32;

function isAirControlContext(ctx: unknown): ctx is AirControlContext {
  if (!ctx || typeof ctx !== 'object') {
    return false;
  }
  const data = ctx as {
    velocity?: Vec3;
    wishDir?: Vec3;
    wishSpeed?: unknown;
    dt?: unknown;
    cmd?: UserCmd;
  };
  if (!(data.velocity instanceof Vec3) || !(data.wishDir instanceof Vec3)) {
    return false;
  }
  if (typeof data.wishSpeed !== 'number' || typeof data.dt !== 'number') {
    return false;
  }
  return typeof data.cmd === 'object' && data.cmd !== null;
}

function applyAirControl(ctx: unknown): void {
  if (!isAirControlContext(ctx)) {
    return;
  }
  const { velocity, wishDir, wishSpeed, dt, cmd } = ctx;
  if (wishSpeed <= 0) {
    return;
  }
  if (Math.abs(cmd.rightmove) < 0.1) {
    return;
  }
  if (Math.abs(cmd.forwardmove) > 0.1) {
    return;
  }

  const zSpeed = velocity.z;
  velocity.z = 0;
  const speed = velocity.length();
  if (speed < 1e-3) {
    velocity.z = zSpeed;
    return;
  }

  velocity.scale(1 / speed);
  const dot = velocity.dot(wishDir);
  if (dot <= 0) {
    velocity.scale(speed);
    velocity.z = zSpeed;
    return;
  }

  const k = AIR_CONTROL_SPEED_SCALE * CPM_AIR_CONTROL * dot * dot * dt;
  velocity.x = velocity.x * speed + wishDir.x * k;
  velocity.y = velocity.y * speed + wishDir.y * k;
  velocity.z = 0;
  velocity.normalize();
  velocity.scale(speed);
  velocity.z = zSpeed;
}

export const CPM: PhysicsMode = {
  id: 'CPM',
  params: {
    friction: 5,
    stopSpeed: 100,
    accelerate: 15,
    airAccelerate: 1,
    gravity: 800,
    jumpVelocity: 270,
    stepSize: 18,
    overclip: 1.001,
    wishSpeed: 320,
    duckScale: 0.5,
  },
  hooks: {
    airControl: applyAirControl,
  },
};
