export class FixedTimestep {
  private accumulator = 0;
  private lastTime = 0;
  private maxAccumulator = 0;

  constructor(private stepSeconds: number, private maxSteps = 8) {
    this.maxAccumulator = stepSeconds * maxSteps;
  }

  getStepSeconds(): number {
    return this.stepSeconds;
  }

  setStepSeconds(stepSeconds: number, maxSteps = this.maxSteps): void {
    if (stepSeconds <= 0) {
      return;
    }
    this.stepSeconds = stepSeconds;
    this.maxSteps = maxSteps;
    this.maxAccumulator = stepSeconds * maxSteps;
    this.accumulator = Math.min(this.accumulator, this.maxAccumulator);
  }

  reset(nowSeconds: number): void {
    this.accumulator = 0;
    this.lastTime = nowSeconds;
  }

  tick(nowSeconds: number, stepFn: (dt: number) => void): void {
    const delta = Math.max(0, Math.min(0.25, nowSeconds - this.lastTime));
    this.lastTime = nowSeconds;
    this.accumulator = Math.min(this.accumulator + delta, this.maxAccumulator);

    while (this.accumulator >= this.stepSeconds) {
      stepFn(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
    }
  }
}
