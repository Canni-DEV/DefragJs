import { Pk3Archive } from './Pk3Archive';

export type Mount = {
  archive: Pk3Archive;
  priority: number;
};

export class VirtualFS {
  private mounts: Mount[] = [];
  private nextPriority = 0;

  mount(archive: Pk3Archive, priority?: number): void {
    const resolvedPriority = priority ?? this.nextPriority++;
    this.mounts.push({ archive, priority: resolvedPriority });
    this.mounts.sort((a, b) => a.priority - b.priority);
  }

  readFile(path: string): Uint8Array | null {
    for (let i = this.mounts.length - 1; i >= 0; i -= 1) {
      const mount = this.mounts[i];
      const data = mount.archive.read(path);
      if (data) {
        return data;
      }
    }
    return null;
  }

  list(prefix: string): string[] {
    const map = new Set<string>();
    for (const mount of this.mounts) {
      for (const item of mount.archive.list(prefix)) {
        map.add(item);
      }
    }
    return Array.from(map).sort();
  }
}
