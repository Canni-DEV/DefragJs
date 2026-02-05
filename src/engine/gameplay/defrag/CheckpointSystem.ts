export class CheckpointSystem {
  private readonly splits: number[] = [];

  addSplit(timeMs: number): void {
    this.splits.push(timeMs);
  }

  reset(): void {
    this.splits.length = 0;
  }

  getSplits(): number[] {
    return [...this.splits];
  }
}
