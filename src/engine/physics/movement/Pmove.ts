import { Vec3 } from '../../core/Math/Vec3';
import { ITraceWorld } from '../ITraceWorld';
import { Contents } from '../TraceTypes';
import { PhysicsMode } from './PhysicsModes';
import { BUTTON_JUMP, PlayerState, UserCmd } from './PmoveTypes';

const tmp1 = new Vec3();
const tmp2 = new Vec3();
const tmp3 = new Vec3();
const tmp4 = new Vec3();
const tmp5 = new Vec3();
const tmp6 = new Vec3();
const tmp7 = new Vec3();
const tmp8 = new Vec3();
const tmp9 = new Vec3();
const tmp10 = new Vec3();
const tmpForward = new Vec3();
const tmpRight = new Vec3();
const tmpPlane0 = new Vec3();
const tmpPlane1 = new Vec3();
const tmpPlane2 = new Vec3();
const tmpPlane3 = new Vec3();
const tmpPlane4 = new Vec3();
const tmpStandMaxs = new Vec3();

const STAND_MAX_Z = 32;
const DUCK_MAX_Z = 16;
const STAND_VIEW = 26;
const DUCK_VIEW = 12;
const MIN_WALK_NORMAL = 0.7;
const GROUND_EPS = 0.25;
const MASK_PLAYER = Contents.SOLID | Contents.PLAYERCLIP;
const CLIP_PLANES = [tmpPlane0, tmpPlane1, tmpPlane2, tmpPlane3, tmpPlane4];
const AIR_CONTROL_CTX = {
  velocity: new Vec3(),
  wishDir: new Vec3(),
  wishSpeed: 0,
  dt: 0,
  cmd: {
    forwardmove: 0,
    rightmove: 0,
    upmove: 0,
    buttons: 0,
    msec: 0,
    viewYaw: 0,
    viewPitch: 0,
  },
};
const STUCK_OFFSETS: Vec3[] = (() => {
  const offsets: Vec3[] = [];
  const values = [-1, 0, 1];
  for (const x of values) {
    for (const y of values) {
      for (const z of values) {
        offsets.push(new Vec3(x, y, z));
      }
    }
  }
  return offsets;
})();

export class Pmove {
  static move(state: PlayerState, cmd: UserCmd, trace: ITraceWorld, mode: PhysicsMode): void {
    const dt = Math.max(0, cmd.msec / 1000);
    if (dt <= 0) {
      return;
    }

    const params = mode.params;

    Pmove.updateDuck(state, cmd, trace);
    Pmove.correctAllSolid(state, trace);

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
      if (mode.hooks?.airControl) {
        AIR_CONTROL_CTX.velocity = state.velocity;
        AIR_CONTROL_CTX.wishDir = wish.dir;
        AIR_CONTROL_CTX.wishSpeed = wish.speed;
        AIR_CONTROL_CTX.dt = dt;
        AIR_CONTROL_CTX.cmd = cmd;
        mode.hooks.airControl(AIR_CONTROL_CTX);
      }
    }

    if (!state.onGround) {
      state.velocity.z -= params.gravity * dt;
    }

    Pmove.stepSlideMove(state, trace, params, dt);

    const postGround = Pmove.groundTrace(state, trace);
    state.onGround = postGround && state.velocity.z <= 0;
    if (state.onGround && state.velocity.z < 0) {
      state.velocity.z = 0;
    }
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

  private static correctAllSolid(state: PlayerState, trace: ITraceWorld): void {
    const start = state.position;
    const startTrace = trace.traceBox({
      start,
      end: start,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });
    if (!startTrace.startSolid && !startTrace.allSolid) {
      return;
    }

    for (const offset of STUCK_OFFSETS) {
      tmp2.set(start.x + offset.x, start.y + offset.y, start.z + offset.z);
      const testTrace = trace.traceBox({
        start: tmp2,
        end: tmp2,
        mins: state.bboxMins,
        maxs: state.bboxMaxs,
        mask: MASK_PLAYER,
      });
      if (!testTrace.startSolid && !testTrace.allSolid) {
        state.position.copy(tmp2);
        return;
      }
    }

    state.velocity.set(0, 0, 0);
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

    const blocked = Pmove.slideMove(state, trace, params.overclip, dt);
    if (!blocked) {
      return;
    }

    const slidePos = tmp9.copy(state.position);
    const slideVel = tmp10.copy(state.velocity);

    const stepSize = state.ducked ? Math.min(params.stepSize, 16) : params.stepSize;
    const stepUp = tmp3.copy(startPos);
    stepUp.z += stepSize;
    const upTrace = trace.traceBox({
      start: startPos,
      end: stepUp,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });
    if (upTrace.fraction < 1 || upTrace.startSolid || upTrace.allSolid) {
      state.position.copy(slidePos);
      state.velocity.copy(slideVel);
      return;
    }

    state.position.copy(upTrace.endPos);
    state.velocity.copy(startVel);
    Pmove.slideMove(state, trace, params.overclip, dt);

    const downPos = tmp3.copy(state.position);
    downPos.z -= stepSize;
    const downTrace = trace.traceBox({
      start: state.position,
      end: downPos,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });

    if (downTrace.startSolid || downTrace.allSolid) {
      state.position.copy(slidePos);
      state.velocity.copy(slideVel);
      return;
    }

    if (downTrace.fraction < 1 && downTrace.planeNormal.z < MIN_WALK_NORMAL) {
      state.position.copy(slidePos);
      state.velocity.copy(slideVel);
      return;
    }

    state.position.copy(downTrace.endPos);
    if (downTrace.fraction < 1) {
      Pmove.clipVelocity(state.velocity, downTrace.planeNormal, params.overclip);
    }

    const slideDx = slidePos.x - startPos.x;
    const slideDy = slidePos.y - startPos.y;
    const slideDz = slidePos.z - startPos.z;
    const stepDx = state.position.x - startPos.x;
    const stepDy = state.position.y - startPos.y;
    const stepDz = state.position.z - startPos.z;
    const slideDistSq = slideDx * slideDx + slideDy * slideDy + slideDz * slideDz;
    const stepDistSq = stepDx * stepDx + stepDy * stepDy + stepDz * stepDz;
    if (slideDistSq > stepDistSq) {
      state.position.copy(slidePos);
      state.velocity.copy(slideVel);
    }
  }

  private static slideMove(state: PlayerState, trace: ITraceWorld, overclip: number, dt: number): boolean {
    let timeLeft = dt;
    let blocked = false;
    const primalVelocity = tmp6.copy(state.velocity);
    const newVelocity = tmp7.copy(state.velocity);
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

      if (traceResult.allSolid) {
        state.velocity.set(0, 0, 0);
        return true;
      }

      if (traceResult.fraction > 0) {
        state.position.copy(traceResult.endPos);
      }

      if (traceResult.fraction === 1) {
        break;
      }

      blocked = true;
      timeLeft -= timeLeft * traceResult.fraction;
      if (timeLeft <= 0) {
        break;
      }

      if (planeCount >= CLIP_PLANES.length) {
        state.velocity.set(0, 0, 0);
        break;
      }

      const planeNormal = CLIP_PLANES[planeCount];
      planeNormal.copy(traceResult.planeNormal);
      planeCount += 1;

      let validVelocity = false;
      for (let i = 0; i < planeCount; i += 1) {
        const plane = CLIP_PLANES[i];
        newVelocity.copy(state.velocity);
        Pmove.clipVelocity(newVelocity, plane, overclip);

        let j = 0;
        for (; j < planeCount; j += 1) {
          if (j === i) {
            continue;
          }
          const other = CLIP_PLANES[j];
          if (newVelocity.dot(other) < 0) {
            break;
          }
        }

        if (j === planeCount) {
          state.velocity.copy(newVelocity);
          validVelocity = true;
          break;
        }
      }

      if (!validVelocity) {
        if (planeCount !== 2) {
          state.velocity.set(0, 0, 0);
          break;
        }

        tmp8.copy(CLIP_PLANES[0]).cross(CLIP_PLANES[1], tmp8);
        if (tmp8.length() < 1e-5) {
          state.velocity.set(0, 0, 0);
          break;
        }
        tmp8.normalize();
        const d = tmp8.dot(primalVelocity);
        state.velocity.copy(tmp8).scale(d);
      }

      if (state.velocity.dot(primalVelocity) <= 0) {
        state.velocity.set(0, 0, 0);
        break;
      }
    }

    return blocked;
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
    const end = Vec3.add(tmp1, start, tmp2.set(0, 0, -GROUND_EPS));
    const result = trace.traceBox({
      start,
      end,
      mins: state.bboxMins,
      maxs: state.bboxMaxs,
      mask: MASK_PLAYER,
    });
    if (result.allSolid) {
      return false;
    }
    if (result.fraction < 1 && result.planeNormal.z >= MIN_WALK_NORMAL) {
      state.position.copy(result.endPos);
      return true;
    }
    return false;
  }
}
