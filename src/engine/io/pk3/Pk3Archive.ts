import { unzipSync } from 'fflate';

export type Pk3Entry = {
  path: string;
  data: Uint8Array;
};

export class Pk3Archive {
  private readonly entries = new Map<string, Uint8Array>();

  static fromArrayBuffer(buffer: ArrayBuffer): Pk3Archive {
    const archive = new Pk3Archive();
    const bytes = new Uint8Array(buffer);
    const files = unzipSync(bytes);
    for (const [rawPath, data] of Object.entries(files)) {
      const path = Pk3Archive.normalizePath(rawPath);
      archive.entries.set(path, data);
    }
    return archive;
  }

  list(prefix = ''): string[] {
    const normPrefix = Pk3Archive.normalizePath(prefix);
    const out: string[] = [];
    for (const key of this.entries.keys()) {
      if (key.startsWith(normPrefix)) {
        out.push(key);
      }
    }
    return out.sort();
  }

  read(path: string): Uint8Array | null {
    const normPath = Pk3Archive.normalizePath(path);
    return this.entries.get(normPath) ?? null;
  }

  static normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  }
}
