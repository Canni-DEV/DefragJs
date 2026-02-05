import { FixedTimestep } from '../engine/core/FixedTimestep';

export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;

  constructor(
    private readonly timestep: FixedTimestep,
    private readonly updateFn: (dt: number) => void,
    private readonly renderFn: () => void
  ) {}

  start(): void {
    if (this.rafId !== null) {
      return;
    }
    this.lastTime = performance.now();
    this.timestep.reset(this.lastTime / 1000);
    const tick = (time: number): void => {
      const nowSeconds = time / 1000;
      this.timestep.tick(nowSeconds, this.updateFn);
      this.renderFn();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
