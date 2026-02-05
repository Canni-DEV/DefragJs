export type DebugPanelOptions = {
  onWireframe: (enabled: boolean) => void;
  onPhysicsMode: (mode: 'VQ3' | 'CPM') => void;
};

export class DebugPanel {
  readonly element: HTMLDivElement;

  constructor(options: DebugPanelOptions) {
    this.element = document.createElement('div');
    this.element.className = 'panel debug-panel';
    this.element.innerHTML = '<h2>Debug</h2>';

    const stack = document.createElement('div');
    stack.className = 'stack';

    const wireLabel = document.createElement('label');
    wireLabel.textContent = 'Wireframe';
    const wireToggle = document.createElement('input');
    wireToggle.type = 'checkbox';
    wireToggle.addEventListener('change', () => {
      options.onWireframe(wireToggle.checked);
    });

    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Physics Mode';
    const modeSelect = document.createElement('select');
    const modes: Array<'VQ3' | 'CPM'> = ['VQ3', 'CPM'];
    for (const mode of modes) {
      const opt = document.createElement('option');
      opt.value = mode;
      opt.textContent = mode;
      modeSelect.appendChild(opt);
    }
    modeSelect.addEventListener('change', () => {
      options.onPhysicsMode(modeSelect.value as 'VQ3' | 'CPM');
    });

    stack.append(wireLabel, wireToggle, modeLabel, modeSelect);
    this.element.append(stack);
  }
}
