export class Hud {
  readonly element: HTMLDivElement;
  private readonly timeEl: HTMLDivElement;
  private readonly splitsEl: HTMLDivElement;
  private readonly debugEl: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hud';

    this.timeEl = document.createElement('div');
    this.timeEl.className = 'time';
    this.timeEl.textContent = '00:00.000';

    this.splitsEl = document.createElement('div');
    this.splitsEl.className = 'splits';

    this.debugEl = document.createElement('div');
    this.debugEl.className = 'debug';

    this.element.append(this.timeEl, this.splitsEl, this.debugEl);
  }

  update(timeMs: number, splits: number[]): void {
    this.timeEl.textContent = formatTime(timeMs);
    this.splitsEl.innerHTML = '';
    splits.forEach((split, index) => {
      const line = document.createElement('div');
      line.textContent = `#${index + 1} ${formatTime(split)}`;
      this.splitsEl.appendChild(line);
    });
  }

  setDebugLines(lines: string[]): void {
    if (lines.length === 0) {
      this.debugEl.textContent = '';
      this.debugEl.style.display = 'none';
      return;
    }
    this.debugEl.style.display = 'block';
    this.debugEl.textContent = lines.join('\n');
  }
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  const pad = (value: number, size: number) => value.toString().padStart(size, '0');
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}
