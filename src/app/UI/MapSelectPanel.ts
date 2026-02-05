export class MapSelectPanel {
  readonly element: HTMLDivElement;
  private readonly select: HTMLSelectElement;
  private readonly button: HTMLButtonElement;

  constructor(onSelect: (mapPath: string) => void) {
    this.element = document.createElement('div');
    this.element.className = 'panel map-panel';
    this.element.innerHTML = `<h2>Mapas</h2>`;

    const stack = document.createElement('div');
    stack.className = 'stack';

    this.select = document.createElement('select');
    this.select.disabled = true;

    this.button = document.createElement('button');
    this.button.textContent = 'Cargar mapa';
    this.button.disabled = true;
    this.button.addEventListener('click', () => {
      const value = this.select.value;
      if (value) {
        onSelect(value);
      }
    });

    stack.append(this.select, this.button);
    this.element.append(stack);
  }

  setMaps(maps: string[]): void {
    this.select.innerHTML = '';
    if (maps.length === 0) {
      this.select.disabled = true;
      this.button.disabled = true;
      return;
    }
    for (const map of maps) {
      const option = document.createElement('option');
      option.value = map;
      option.textContent = map;
      this.select.appendChild(option);
    }
    this.select.disabled = false;
    this.button.disabled = false;
  }
}
