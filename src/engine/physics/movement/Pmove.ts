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
const MASK_WATER = Contents.WATER | Contents.LAVA | Contents.SLIME;
const CLIP_PLANES = [tmpPlane0, tmpPlane1, tmpPlane2, tmpPlane3, tmpPlane4];
const CMD_SCALE = 127;
const AIR_CONTROL_SPEED_SCALE = 32;
const PMF_JUMP_HELD = 1 << 0;
const PMOVE_MAX_MSEC = 66;
const PMOVE_CLAMP_MSEC = 200;
const PM_SWIM_SCALE = 0.5;
const PM_WATER_ACCELERATE = 4;
const PM_WATER_FRICTION = 1;
const PM_WATER_SINK_SPEED = -60;
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
    let remainingMsec = Math.floor(cmd.msec);
    if (remainingMsec < 1) {
      remainingMsec = 1;
    } else if (remainingMsec > PMOVE_CLAMP_MSEC) {
      remainingMsec = PMOVE_CLAMP_MSEC;
    }

    while (remainingMsec > 0) {
      const stepMsec = Math.min(remainingMsec, PMOVE_MAX_MSEC);
      const dt = stepMsec / 1000;
      state.commandTime += stepMsec;
      Pmove.pmoveSingle(state, cmd, trace, mode, dt);
      remainingMsec -= stepMsec;
    }
  }

  private static pmoveSingle(
    state: PlayerState,
    cmd: UserCmd,
    trace: ITraceWorld,
    mode: PhysicsMode,
    dt: number
  ): void {
    if (dt <= 0) {
      return;
    }
    const params = mode.params;
    const jumpPressed = (cmd.buttons & BUTTON_JUMP) !== 0;

    if (!jumpPressed) {
      state.pmFlags &= ~PMF_JUMP_HELD;
    }

    if (state.pmType === 'FREEZE') {
      return;
    }

    Pmove.setViewAxes(cmd.viewYaw);

    if (state.pmType === 'NOCLIP' || state.pmType === 'SPECTATOR') {
      const wish = Pmove.computeWish(
        cmd.forwardmove,
        cmd.rightmove,
        cmd.upmove,
        params,
        state.ducked,
        Pmove.computeAirAxes(tmpWishForward),
        Pmove.computeAirAxes(tmpWishRight, true)
      );
      Pmove.noclipMove(state, wish, params, dt);
      Pmove.setWaterLevel(state, trace);
      return;
    }

    Pmove.updateDuck(state, cmd, trace);
    Pmove.correctAllSolid(state, trace);
    Pmove.setWaterLevel(state, trace);

    const ground = Pmove.groundTrace(state, trace);
    state.onGround = ground !== null;

    if (
      state.pmType === 'NORMAL' &&
      state.onGround &&
      jumpPressed &&
      (state.pmFlags & PMF_JUMP_HELD) === 0
    ) {
      if (mode.id === 'CPM' && params.rampBoost > 0 && state.groundNormal.z < 0.999) {
        state.velocity.z = params.jumpVelocity + state.velocity.z * params.rampBoost;
      } else {
        state.velocity.z = params.jumpVelocity;
      }
      state.pmFlags |= PMF_JUMP_HELD;
      state.onGround = false;
    }

    const forwardMove = state.pmType === 'DEAD' ? 0 : cmd.forwardmove;
    const rightMove = state.pmType === 'DEAD' ? 0 : cmd.rightmove;
    const upMove = state.pmType === 'DEAD' ? 0 : cmd.upmove;

    if (state.waterLevel > 1) {
      Pmove.waterMove(state, trace, forwardMove, rightMove, upMove, params, dt);
    } else {
      const wish = state.onGround
        ? Pmove.computeWish(
            forwardMove,
            rightMove,
            upMove,
            params,
            state.ducked,
            Pmove.computeGroundAxes(state.groundNormal, params.overclip, tmpWishForward),
            Pmove.computeGroundAxes(state.groundNormal, params.overclip, tmpWishRight, true)
          )
        : Pmove.computeWish(
            forwardMove,
            rightMove,
            upMove,
            params,
            state.ducked,
            Pmove.computeAirAxes(tmpWishForward),
            Pmove.computeAirAxes(tmpWishRight, true)
          );

      Pmove.applyFriction(state, params, dt, state.onGround, state.waterLevel);

      if (state.onGround) {
        Pmove.accelerate(state.velocity, wish.dir, wish.speed, params.accelerate, dt);
      } else if (mode.id === 'CPM') {
        Pmove.airMoveCPM(state, cmd, wish, params, dt);
      } else {
        Pmove.airMoveVQ3(state, wish, params, dt);
      }

      Pmove.stepSlideMove(state, trace, params, dt, state.onGround ? 0 : params.gravity);
    }

    const postGround = Pmove.groundTrace(state, trace);
    if (postGround !== null) {
      state.onGround = state.velocity.z <= 0;
    } else {
      state.onGround = false;
    }
    Pmove.setWaterLevel(state, trace);
  }

  private static computeWish(
    forwardMove: number,
    rightMove: number,
    upMove: number,
    params: { wishSpeed: number; duckScale: number },
    ducked: boolean,
    forwardAxis: Vec3,
    rightAxis: Vec3
  ): { dir: Vec3; speed: number } {
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

  private static setWaterLevel(state: PlayerState, trace: ITraceWorld): void {
    state.waterLevel = 0;
    state.waterType = Contents.EMPTY;
    if (!trace.pointContents) {
      return;
    }

    const p = tmp1.copy(state.position);
    p.z += state.bboxMins.z + 1;
    let contents = trace.pointContents(p);
    if ((contents & MASK_WATER) === 0) {
      return;
    }

    state.waterType = contents;
    state.waterLevel = 1;

    const sample2 = state.viewHeight - state.bboxMins.z;
    const sample1 = sample2 * 0.5;

    p.z = state.position.z + state.bboxMins.z + sample1;
    contents = trace.pointContents(p);
    if ((contents & MASK_WATER) !== 0) {
      state.waterLevel = 2;
      p.z = state.position.z + state.bboxMins.z + sample2;
      contents = trace.pointContents(p);
      if ((contents & MASK_WATER) !== 0) {
        state.waterLevel = 3;
      }
    }
  }

  private static waterMove(
    state: PlayerState,
    trace: ITraceWorld,
    forwardMove: number,
    rightMove: number,
    upMove: number,
    params: {
      friction: number;
      stopSpeed: number;
      wishSpeed: number;
      duckScale: number;
      overclip: number;
    },
    dt: number
  ): void {
    Pmove.applyFriction(state, params, dt, state.onGround, state.waterLevel);

    let wish = Pmove.computeWish(
      forwardMove,
      rightMove,
      upMove,
      params,
      state.ducked,
      Pmove.computeAirAxes(tmpWishForward),
      Pmove.computeAirAxes(tmpWishRight, true)
    );

    if (wish.speed <= 0) {
      tmp2.set(0, 0, PM_WATER_SINK_SPEED);
      const sinkSpeed = tmp2.length();
      tmp2.scale(1 / sinkSpeed);
      wish = { dir: tmp2, speed: sinkSpeed };
    }

    const maxWaterSpeed = params.wishSpeed * PM_SWIM_SCALE;
    const wishSpeed = Math.min(wish.speed, maxWaterSpeed);
    Pmove.accelerate(state.velocity, wish.dir, wishSpeed, PM_WATER_ACCELERATE, dt);

    if (state.onGround && state.velocity.dot(state.groundNormal) < 0) {
      const velMag = state.velocity.length();
      Pmove.clipVelocity(state.velocity, state.groundNormal, params.overclip);
      state.velocity.normalize().scale(velMag);
    }

    Pmove.slideMove(
      state,
      trace,
      params.overclip,
      0,
      dt,
      state.onGround ? state.groundNormal : null
    );
  }

  private static noclipMove(
    state: PlayerState,
    wish: { dir: Vec3; speed: number },
    params: { friction: number; stopSpeed: number; accelerate: number },
    dt: number
  ): void {
    const speed = state.velocity.length();
    if (speed > 0) {
      const friction = params.friction * 1.5;
      const drop = Math.max(speed, params.stopSpeed) * friction * dt;
      const newSpeed = Math.max(0, speed - drop);
      if (newSpeed <= 0) {
        state.velocity.set(0, 0, 0);
      } else {
        state.velocity.scale(newSpeed / speed);
      }
    }

    Pmove.accelerate(state.velocity, wish.dir, wish.speed, params.accelerate, dt);
    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;
    state.onGround = false;
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

  private static applyFriction(
    state: PlayerState,
    params: { friction: number; stopSpeed: number },
    dt: number,
    walking: boolean,
    waterLevel: 0 | 1 | 2 | 3
  ): void {
    const speed = walking
      ? Math.hypot(state.velocity.x, state.velocity.y)
      : state.velocity.length();
    if (speed < 1e-3) {
      if (walking) {
        state.velocity.x = 0;
        state.velocity.y = 0;
      }
      return;
    }

    let drop = 0;
    if (walking && waterLevel <= 1) {
      drop += Math.max(speed, params.stopSpeed) * params.friction * dt;
    }
    if (waterLevel > 0) {
      drop += speed * PM_WATER_FRICTION * waterLevel * dt;
    }
    if (drop <= 0) {
      return;
    }

    const newSpeed = Math.max(0, speed - drop);
    const scale = newSpeed / speed;
    state.velocity.x *= scale;
    state.velocity.y *= scale;
    state.velocity.z *= scale;
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
