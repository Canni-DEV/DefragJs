export type TimerState = 'idle' | 'running' | 'stopped';

export class TimerSystem {
  state: TimerState = 'idle';
  elapsedMs = 0;
  splits: number[] = [];

  reset(): void {
    this.state = 'idle';
    this.elapsedMs = 0;
    this.splits = [];
  }

  start(): void {
    this.state = 'running';
    this.elapsedMs = 0;
    this.splits = [];
  }

  stop(): void {
    if (this.state === 'running') {
      this.state = 'stopped';
    }
  }

  checkpoint(): void {
    if (this.state === 'running') {
      this.splits.push(this.elapsedMs);
    }
  }

  tick(dtSeconds: number): void {
    if (this.state === 'running') {
      this.elapsedMs += dtSeconds * 1000;
    }
  }
}
