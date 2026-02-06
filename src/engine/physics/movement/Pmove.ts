import { Vec3 } from '../../core/Math/Vec3';
import { ITraceWorld } from '../ITraceWorld';
import { TraceBoxRequest, Contents } from '../TraceTypes';
import { PhysicsMode } from './PhysicsModes';
import { BUTTON_JUMP, PlayerState, UserCmd } from './PmoveTypes';

const tmp1 = new Vec3();
const tmp2 = new Vec3();
const tmp3 = new Vec3();
const tmp4 = new Vec3();
const tmp5 = new Vec3();
const tmpForward = new Vec3();
const tmpRight = new Vec3();
const tmpPlane0 = new Vec3();
const tmpPlane1 = new Vec3();
const tmpPlane2 = new Vec3();
const tmpPlane3 = new Vec3();
const tmpStandMaxs = new Vec3();

const STAND_MAX_Z = 32;
const DUCK_MAX_Z = 16;
const STAND_VIEW = 26;
const DUCK_VIEW = 12;
const MASK_PLAYER = Contents.SOLID | Contents.PLAYERCLIP;

export class Pmove {
  static move(state: PlayerState, cmd: UserCmd, trace: ITraceWorld, mode: PhysicsMode): void {
    const dt = Math.max(0, cmd.msec / 1000);
    if (dt <= 0) {
      return;
    }

    const params = mode.params;

    Pmove.updateDuck(state, cmd, trace);

    const onGround = Pmove.groundTrace(state, trace);
    state.onGround = onGround;
    if (state.onGround && state.velocity.z < 0) {
      state.velocity.z = 0;
    }

    if (onGround && (cmd.buttons & BUTTON_JUMP) !== 0) {
      state.velocity.z = params.jumpVelocity;
      state.onGround = false;
    }

    if (state.onGround) {
      Pmove.applyFriction(state, params, dt);
    }

    const wish = Pmove.computeWish(cmd, params, state.ducked);
    if (state.onGround) {
      Pmove.accelerate(state.velocity, wish.dir, wish.speed, params.accelerate, dt);
    } else {
      Pmove.accelerate(state.velocity, wish.dir, wish.speed, params.airAccelerate, dt);
    }

    if (!state.onGround) {
      state.velocity.z -= params.gravity * dt;
    }

    Pmove.stepSlideMove(state, trace, params, dt);
  }

  private static computeWish(
    cmd: UserCmd,
    params: { wishSpeed: number; duckScale: number },
    ducked: boolean
  ): { dir: Vec3; speed: number } {
    const yawRad = (cmd.viewYaw * Math.PI) / 180;
    tmpForward.set(Math.cos(yawRad), Math.sin(yawRad), 0);
    // Quake-style axes: +X forward, +Y left, +Z up -> right is -Y.
    tmpRight.set(Math.sin(yawRad), -Math.cos(yawRad), 0);

    tmp1.set(0, 0, 0);
    tmp2.copy(tmpForward).scale(cmd.forwardmove);
    tmp3.copy(tmpRight).scale(cmd.rightmove);
    tmp1.add(tmp2);
    tmp1.add(tmp3);

    const wishSpeedInput = tmp1.length();
    if (wishSpeedInput > 0) {
      tmp1.scale(1 / wishSpeedInput);
    }

    const baseSpeed = Math.min(1, wishSpeedInput) * params.wishSpeed;
    const wishSpeed = ducked ? baseSpeed * params.duckScale : baseSpeed;
    return { dir: tmp1, speed: wishSpeed };
  }

  private static updateDuck(state: PlayerState, cmd: UserCmd, trace: ITraceWorld): void {
    const wantsDuck = cmd.upmove < 0;
    if (wantsDuck) {
      if (!state.ducked) {
        state.ducked = true;
        state.bboxMaxs.z = DUCK_MAX_Z;
        state.viewHeight = DUCK_VIEW;
      }
      return;
    }

    if (!state.ducked) {
      return;
    }

    tmpStandMaxs.set(state.bboxMaxs.x, state.bboxMaxs.y, STAND_MAX_Z);
    const standTrace = trace.traceBox({
      start: state.position,
      end: state.position,
      mins: state.bboxMins,
      maxs: tmpStandMaxs,
      mask: MASK_PLAYER,
    });
    if (!standTrace.startSolid && !standTrace.allSolid) {
      state.ducked = false;
      state.bboxMaxs.z = STAND_MAX_Z;
      state.viewHeight = STAND_VIEW;
    }
  }

  private static applyFriction(state: PlayerState, params: { friction: number; stopSpeed: number }, dt: number): void {
    const speed = Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y);
    if (speed < 1e-3) {
      return;
    }
    const drop = Math.max(speed, params.stopSpeed) * params.friction * dt;
    const newSpeed = Math.max(0, speed - drop);
    const scale = newSpeed / speed;
    state.velocity.x *= scale;
    state.velocity.y *= scale;
  }

  private static accelerate(vel: Vec3, wishDir: Vec3, wishSpeed: number, accel: number, dt: number): void {
    const currentSpeed = vel.dot(wishDir);
    const addSpeed = wishSpeed - currentSpeed;
    if (addSpeed <= 0) {
      return;
    }
    const accelSpeed = Math.min(addSpeed, accel * dt * wishSpeed);
    vel.x += accelSpeed * wishDir.x;
    vel.y += accelSpeed * wishDir.y;
    vel.z += accelSpeed * wishDir.z;
  }

  private static stepSlideMove(state: PlayerState, trace: ITraceWorld, params: { stepSize: number; overclip: number }, dt: number): void {
    const startPos = tmp4.copy(state.position);
    const startVel = tmp5.copy(state.velocity);

    const moved = Pmove.slideMove(state, trace, params.overclip, dt);
    if (moved) {
      return;
    }

    const stepUp = tmp3.copy(startPos);
    stepUp.z += params.stepSize;
    const upTrace = trace.traceBox({
      start: startPos,
      end: stepUp,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });
    if (upTrace.fraction < 1 || upTrace.startSolid) {
      state.position.copy(startPos);
      state.velocity.copy(startVel);
      return;
    }

    state.position.copy(upTrace.endPos);
    state.velocity.copy(startVel);
    Pmove.slideMove(state, trace, params.overclip, dt);

    const downPos = tmp3.copy(state.position);
    downPos.z -= params.stepSize;
    const downTrace = trace.traceBox({
      start: state.position,
      end: downPos,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });
    state.position.copy(downTrace.endPos);
  }

  private static slideMove(state: PlayerState, trace: ITraceWorld, overclip: number, dt: number): boolean {
    let timeLeft = dt;
    let bumped = false;
    const planes = [tmpPlane0, tmpPlane1, tmpPlane2, tmpPlane3];
    let planeCount = 0;

    for (let bump = 0; bump < 4; bump += 1) {
      const end = Vec3.add(tmp2, state.position, Vec3.scale(tmp3, state.velocity, timeLeft));
      const traceResult = trace.traceBox({
        start: state.position,
        end,
        mins: state.bboxMins,
        maxs: state.bboxMaxs,
        mask: MASK_PLAYER,
      });

      if (traceResult.fraction > 0) {
        state.position.copy(traceResult.endPos);
        bumped = true;
      }

      if (traceResult.fraction === 1) {
        break;
      }

      timeLeft -= timeLeft * traceResult.fraction;
      if (timeLeft <= 0) {
        break;
      }

      const planeNormal = planes[planeCount];
      if (!planeNormal) {
        break;
      }
      planeNormal.copy(traceResult.planeNormal);
      planeCount += 1;

      if (planeCount === 1) {
        Pmove.clipVelocity(state.velocity, planeNormal, overclip);
      } else {
        const newVel = tmp1.copy(state.velocity);
        for (let i = 0; i < planeCount; i += 1) {
          const plane = planes[i];
          if (!plane) {
            continue;
          }
          Pmove.clipVelocity(newVel, plane, overclip);
        }
        state.velocity.copy(newVel);
      }
    }

    return bumped;
  }

  private static clipVelocity(vel: Vec3, normal: Vec3, overclip: number): void {
    const backoff = vel.dot(normal);
    const adjusted = backoff < 0 ? backoff * overclip : backoff / overclip;
    vel.x -= normal.x * adjusted;
    vel.y -= normal.y * adjusted;
    vel.z -= normal.z * adjusted;

    if (Math.abs(vel.x) < 1e-5) vel.x = 0;
    if (Math.abs(vel.y) < 1e-5) vel.y = 0;
    if (Math.abs(vel.z) < 1e-5) vel.z = 0;
  }

  private static groundTrace(state: PlayerState, trace: ITraceWorld): boolean {
    const start = state.position;
    const end = Vec3.add(tmp1, start, tmp2.set(0, 0, -2));
    const result = trace.traceBox({
      start,
      end,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });
    if ((result.fraction < 1 || result.startSolid) && result.planeNormal.z > 0.7) {
      state.position.copy(result.endPos);
      return true;
    }
    return false;
  }
}
