export class FileMountPanel {
  readonly element: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private readonly input: HTMLInputElement;

  constructor(onFiles: (files: FileList) => void) {
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

    this.list = document.createElement('ul');
    this.list.style.margin = '0';
    this.list.style.padding = '0 0 0 16px';
    this.list.style.fontSize = '12px';
    this.list.style.color = '#b6c0d6';

    stack.append(hint, this.input, this.list);
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
}
