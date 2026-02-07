import { Vec3 } from '../../core/Math/Vec3';
import { ITraceWorld } from '../ITraceWorld';
import { Contents, TraceResult } from '../TraceTypes';
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
const tmp11 = new Vec3();
const tmpForward = new Vec3();
const tmpRight = new Vec3();
const tmpPlane0 = new Vec3();
const tmpPlane1 = new Vec3();
const tmpPlane2 = new Vec3();
const tmpPlane3 = new Vec3();
const tmpPlane4 = new Vec3();
const tmpGround = new Vec3();
const tmpStandMaxs = new Vec3();
const tmpWishForward = new Vec3();
const tmpWishRight = new Vec3();

const STAND_MAX_Z = 32;
const DUCK_MAX_Z = 16;
const STAND_VIEW = 26;
const DUCK_VIEW = 12;
const MIN_WALK_NORMAL = 0.7;
const GROUND_EPS = 0.25;
const MASK_PLAYER = Contents.SOLID | Contents.PLAYERCLIP;
const CLIP_PLANES = [tmpPlane0, tmpPlane1, tmpPlane2, tmpPlane3, tmpPlane4];
const CMD_SCALE = 127;
const AIR_CONTROL_SPEED_SCALE = 32;
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

    Pmove.pmoveSingle(state, cmd, trace, mode, dt);
  }

  private static pmoveSingle(
    state: PlayerState,
    cmd: UserCmd,
    trace: ITraceWorld,
    mode: PhysicsMode,
    dt: number
  ): void {
    const params = mode.params;

    Pmove.updateDuck(state, cmd, trace);
    Pmove.correctAllSolid(state, trace);

    const ground = Pmove.groundTrace(state, trace);
    state.onGround = ground !== null;
    Pmove.setViewAxes(cmd.viewYaw);
    const jumpPressed = (cmd.buttons & BUTTON_JUMP) !== 0;
    if (!jumpPressed) {
      state.jumpHeld = false;
    }

    if (state.onGround && jumpPressed && !state.jumpHeld) {
      if (mode.id === 'CPM' && params.rampBoost > 0 && state.groundNormal.z < 0.999) {
        state.velocity.z = params.jumpVelocity + state.velocity.z * params.rampBoost;
      } else {
        state.velocity.z = params.jumpVelocity;
      }
      state.jumpHeld = true;
      state.onGround = false;
    }

    const wish = state.onGround
      ? Pmove.computeWish(
          cmd,
          params,
          state.ducked,
          Pmove.computeGroundAxes(state.groundNormal, params.overclip, tmpWishForward),
          Pmove.computeGroundAxes(state.groundNormal, params.overclip, tmpWishRight, true)
        )
      : Pmove.computeWish(
          cmd,
          params,
          state.ducked,
          Pmove.computeAirAxes(tmpWishForward),
          Pmove.computeAirAxes(tmpWishRight, true)
        );

    if (state.onGround) {
      Pmove.applyFriction(state, params, dt);
      Pmove.accelerate(state.velocity, wish.dir, wish.speed, params.accelerate, dt);
    } else if (mode.id === 'CPM') {
      Pmove.airMoveCPM(state, cmd, wish, params, dt);
    } else {
      Pmove.airMoveVQ3(state, wish, params, dt);
    }

    Pmove.stepSlideMove(state, trace, params, dt, state.onGround ? 0 : params.gravity);

    const postGround = Pmove.groundTrace(state, trace);
    state.onGround = postGround !== null && state.velocity.z <= 0;
  }

  private static computeWish(
    cmd: UserCmd,
    params: { wishSpeed: number; duckScale: number },
    ducked: boolean,
    forwardAxis: Vec3,
    rightAxis: Vec3
  ): { dir: Vec3; speed: number } {
    const forwardMove = cmd.forwardmove;
    const rightMove = cmd.rightmove;
    const upMove = cmd.upmove;

    const maxMove = Math.max(Math.abs(forwardMove), Math.abs(rightMove), Math.abs(upMove));
    if (maxMove <= 0) {
      tmp1.set(0, 0, 0);
      return { dir: tmp1, speed: 0 };
    }

    const cmdScale = Pmove.cmdScale(forwardMove, rightMove, upMove, maxMove, params.wishSpeed);

    tmp1.set(0, 0, 0);
    tmp2.copy(forwardAxis).scale(forwardMove * cmdScale);
    tmp3.copy(rightAxis).scale(rightMove * cmdScale);
    tmp1.add(tmp2);
    tmp1.add(tmp3);

    let wishSpeed = tmp1.length();
    if (wishSpeed > 0) {
      tmp1.scale(1 / wishSpeed);
    }

    if (ducked) {
      wishSpeed *= params.duckScale;
    }
    return { dir: tmp1, speed: wishSpeed };
  }

  private static setViewAxes(viewYaw: number): void {
    const yawRad = (viewYaw * Math.PI) / 180;
    tmpForward.set(Math.cos(yawRad), Math.sin(yawRad), 0);
    // Quake-style axes: +X forward, +Y left, +Z up -> right is -Y.
    tmpRight.set(Math.sin(yawRad), -Math.cos(yawRad), 0);
  }

  private static computeGroundAxes(normal: Vec3, overclip: number, out: Vec3, right = false): Vec3 {
    out.copy(right ? tmpRight : tmpForward);
    Pmove.clipVelocity(out, normal, overclip);
    out.normalize();
    return out;
  }

  private static computeAirAxes(out: Vec3, right = false): Vec3 {
    out.copy(right ? tmpRight : tmpForward);
    out.z = 0;
    out.normalize();
    return out;
  }

  private static cmdScale(
    forwardMove: number,
    rightMove: number,
    upMove: number,
    maxMove: number,
    wishSpeed: number
  ): number {
    if (maxMove <= 0) {
      return 0;
    }
    const total = Math.sqrt(
      forwardMove * forwardMove + rightMove * rightMove + upMove * upMove
    );
    if (total <= 0) {
      return 0;
    }
    return (wishSpeed * maxMove) / (CMD_SCALE * total);
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

  private static airMoveVQ3(
    state: PlayerState,
    wish: { dir: Vec3; speed: number },
    params: { airAccelerate: number; airSpeedCap: number },
    dt: number
  ): void {
    const cappedSpeed =
      params.airSpeedCap > 0 ? Math.min(wish.speed, params.airSpeedCap) : wish.speed;
    Pmove.accelerate(state.velocity, wish.dir, cappedSpeed, params.airAccelerate, dt);
  }

  private static airMoveCPM(
    state: PlayerState,
    cmd: UserCmd,
    wish: { dir: Vec3; speed: number },
    params: { airAccelerate: number; strafeAccelerate: number; airControl: number },
    dt: number
  ): void {
    const hasForward = Math.abs(cmd.forwardmove) > 1e-3;
    const hasRight = Math.abs(cmd.rightmove) > 1e-3;
    const accel =
      !hasForward && hasRight && params.strafeAccelerate > 0
        ? params.strafeAccelerate
        : params.airAccelerate;
    Pmove.accelerate(state.velocity, wish.dir, wish.speed, accel, dt);
    if (params.airControl > 0) {
      Pmove.applyAirControl(state.velocity, wish.dir, wish.speed, dt, params.airControl, cmd);
    }
  }

  private static applyAirControl(
    velocity: Vec3,
    wishDir: Vec3,
    wishSpeed: number,
    dt: number,
    airControl: number,
    cmd: UserCmd
  ): void {
    if (wishSpeed <= 0) {
      return;
    }
    const hasForward = Math.abs(cmd.forwardmove) > 1e-3;
    const hasRight = Math.abs(cmd.rightmove) > 1e-3;
    if (!hasForward || hasRight) {
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

    const k = AIR_CONTROL_SPEED_SCALE * airControl * dot * dot * dt;
    velocity.x = velocity.x * speed + wishDir.x * k;
    velocity.y = velocity.y * speed + wishDir.y * k;
    velocity.z = 0;
    velocity.normalize();
    velocity.scale(speed);
    velocity.z = zSpeed;
  }

  private static stepSlideMove(
    state: PlayerState,
    trace: ITraceWorld,
    params: { stepSize: number; overclip: number },
    dt: number,
    gravity: number
  ): void {
    const startPos = tmp4.copy(state.position);
    const startVel = tmp5.copy(state.velocity);
    const groundNormal = state.onGround ? tmpGround.copy(state.groundNormal) : null;

    const blocked = Pmove.slideMove(state, trace, params.overclip, gravity, dt, groundNormal);
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
    Pmove.slideMove(state, trace, params.overclip, gravity, dt, groundNormal);

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

  private static slideMove(
    state: PlayerState,
    trace: ITraceWorld,
    overclip: number,
    gravity: number,
    dt: number,
    groundNormal: Vec3 | null
  ): boolean {
    let timeLeft = dt;
    let blocked = false;
    const primalVelocity = tmp6.copy(state.velocity);
    const newVelocity = tmp7.copy(state.velocity);
    const endVelocity = tmp11.copy(state.velocity);
    let planeCount = 0;

    if (gravity !== 0) {
      endVelocity.z -= gravity * dt;
      state.velocity.z = (state.velocity.z + endVelocity.z) * 0.5;
      if (groundNormal) {
        Pmove.clipVelocity(state.velocity, groundNormal, overclip);
      }
      primalVelocity.copy(state.velocity);
    }

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
      if (!planeNormal) {
        state.velocity.set(0, 0, 0);
        break;
      }
      planeNormal.copy(traceResult.planeNormal);
      planeCount += 1;

      let validVelocity = false;
      for (let i = 0; i < planeCount; i += 1) {
        const plane = CLIP_PLANES[i];
        if (!plane) {
          continue;
        }
        newVelocity.copy(state.velocity);
        Pmove.clipVelocity(newVelocity, plane, overclip);

        let j = 0;
        for (; j < planeCount; j += 1) {
          if (j === i) {
            continue;
          }
          const other = CLIP_PLANES[j];
          if (!other) {
            continue;
          }
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

        const plane0 = CLIP_PLANES[0];
        const plane1 = CLIP_PLANES[1];
        if (!plane0 || !plane1) {
          state.velocity.set(0, 0, 0);
          break;
        }
        tmp8.copy(plane0).cross(plane1, tmp8);
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

    if (gravity !== 0) {
      state.velocity.z = endVelocity.z;
      if (groundNormal) {
        Pmove.clipVelocity(state.velocity, groundNormal, overclip);
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

  private static groundTrace(state: PlayerState, trace: ITraceWorld): TraceResult | null {
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
      state.groundNormal.set(0, 0, 1);
      return null;
    }
    if (result.fraction < 1) {
      state.groundNormal.copy(result.planeNormal);
      if (result.planeNormal.z >= MIN_WALK_NORMAL) {
        state.position.copy(result.endPos);
        return result;
      }
      return null;
    }
    state.groundNormal.set(0, 0, 1);
    return null;
  }
}
