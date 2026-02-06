export class FileMountPanel {
  readonly element: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private readonly input: HTMLInputElement;
  private readonly defaultInput: HTMLInputElement;
  private readonly defaultLabel: HTMLDivElement;
  private readonly clearButton: HTMLButtonElement;

  constructor(
    onFiles: (files: FileList) => void,
    onDefaultFiles: (files: FileList) => void,
    onClearDefault: () => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'panel file-panel';
    this.element.innerHTML = `<h2>PK3 Mounts</h2>`;

    const stack = document.createElement('div');
    stack.className = 'stack';

    this.input = document.createElement('input');
    this.input.type = 'file';
    this.input.multiple = true;
    this.input.accept = '.pk3,.zip';
    this.input.addEventListener('change', () => {
      if (this.input.files && this.input.files.length > 0) {
        onFiles(this.input.files);
        this.input.value = '';
      }
    });

    const hint = document.createElement('label');
    hint.textContent = 'Arrastra o selecciona PK3';

    const defaultSection = document.createElement('div');
    defaultSection.style.display = 'grid';
    defaultSection.style.gap = '6px';

    const defaultHint = document.createElement('label');
    defaultHint.textContent = 'Default PK3 (cache local)';

    this.defaultLabel = document.createElement('div');
    this.defaultLabel.style.fontSize = '12px';
    this.defaultLabel.style.color = '#b6c0d6';
    this.defaultLabel.textContent = 'Default: none';

    const defaultButton = document.createElement('button');
    defaultButton.textContent = 'Set default.pk3';
    defaultButton.addEventListener('click', () => this.defaultInput.click());

    this.clearButton = document.createElement('button');
    this.clearButton.textContent = 'Clear default';
    this.clearButton.disabled = true;
    this.clearButton.addEventListener('click', () => onClearDefault());

    this.defaultInput = document.createElement('input');
    this.defaultInput.type = 'file';
    this.defaultInput.accept = '.pk3,.zip';
    this.defaultInput.style.display = 'none';
    this.defaultInput.addEventListener('change', () => {
      if (this.defaultInput.files && this.defaultInput.files.length > 0) {
        onDefaultFiles(this.defaultInput.files);
        this.defaultInput.value = '';
      }
    });

    defaultSection.append(defaultHint, this.defaultLabel, defaultButton, this.clearButton, this.defaultInput);

    this.list = document.createElement('ul');
    this.list.style.margin = '0';
    this.list.style.padding = '0 0 0 16px';
    this.list.style.fontSize = '12px';
    this.list.style.color = '#b6c0d6';

    stack.append(hint, this.input, defaultSection, this.list);
    this.element.append(stack);
  }

  setMounted(names: string[]): void {
    this.list.innerHTML = '';
    for (const name of names) {
      const li = document.createElement('li');
      li.textContent = name;
      this.list.appendChild(li);
    }
  }

  setDefaultName(name: string | null): void {
    if (name) {
      this.defaultLabel.textContent = `Default: ${name}`;
      this.clearButton.disabled = false;
    } else {
      this.defaultLabel.textContent = 'Default: none';
      this.clearButton.disabled = true;
    }
  }
}
