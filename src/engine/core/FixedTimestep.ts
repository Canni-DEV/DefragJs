export class FixedTimestep {
  private accumulator = 0;
  private lastTime = 0;

  constructor(public readonly stepSeconds: number) {}

  reset(nowSeconds: number): void {
    this.accumulator = 0;
    this.lastTime = nowSeconds;
  }

  tick(nowSeconds: number, stepFn: (dt: number) => void): void {
    const delta = Math.max(0, Math.min(0.25, nowSeconds - this.lastTime));
    this.lastTime = nowSeconds;
    this.accumulator += delta;

    while (this.accumulator >= this.stepSeconds) {
      stepFn(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
    }
  }
}
