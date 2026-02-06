import { Vec3 } from '../../core/Math/Vec3';
import { ITraceWorld } from '../ITraceWorld';
import { PhysicsMode } from '../movement/PhysicsModes';
import { Pmove } from '../movement/Pmove';
import { PlayerState, UserCmd } from '../movement/PmoveTypes';

export class PlayerController {
  readonly state: PlayerState;
  private traceWorld: ITraceWorld;
  private mode: PhysicsMode;

  constructor(traceWorld: ITraceWorld, mode: PhysicsMode) {
    this.traceWorld = traceWorld;
    this.mode = mode;
    this.state = {
      position: new Vec3(),
      velocity: new Vec3(),
      onGround: false,
      ducked: false,
      bboxMins: new Vec3(-15, -15, -24),
      bboxMaxs: new Vec3(15, 15, 32),
      viewHeight: 26,
    };
  }

  setTraceWorld(traceWorld: ITraceWorld): void {
    this.traceWorld = traceWorld;
  }

  setMode(mode: PhysicsMode): void {
    this.mode = mode;
  }

  teleport(position: Vec3): void {
    this.state.position.copy(position);
    this.state.velocity.set(0, 0, 0);
  }

  step(cmd: UserCmd): void {
    Pmove.move(this.state, cmd, this.traceWorld, this.mode);
  }
}
