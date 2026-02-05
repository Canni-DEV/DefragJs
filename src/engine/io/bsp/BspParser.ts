import { invariant } from '../../core/Debug/Assertions';
import { Vec3 } from '../../core/Math/Vec3';
import { BSP_LUMPS, BspData, BspFace, BspHeader, BspLump, BspModel, BspTexture, BspVertex } from './BspTypes';

const HEADER_SIZE = 4 + 4 + 17 * 8;

export class BspParser {
  static parse(buffer: ArrayBuffer): BspData {
    const view = new DataView(buffer);
    invariant(view.byteLength >= HEADER_SIZE, 'BSP buffer too small');

    const magic = BspParser.readString(view, 0, 4);
    const version = view.getInt32(4, true);
    invariant(magic === 'IBSP', `Invalid BSP magic: ${magic}`);
    invariant(version === 46, `Unsupported BSP version: ${version}`);

    const lumps: BspLump[] = [];
    let offset = 8;
    for (let i = 0; i < 17; i += 1) {
      const lumpOffset = view.getInt32(offset, true);
      const lumpLength = view.getInt32(offset + 4, true);
      offset += 8;
      invariant(lumpOffset >= 0 && lumpLength >= 0, 'Invalid lump range');
      invariant(lumpOffset + lumpLength <= view.byteLength, 'Lump out of bounds');
      lumps.push({ offset: lumpOffset, length: lumpLength });
    }

    const header: BspHeader = { magic, version, lumps };

    const entities = BspParser.readEntities(view, header.lumps[BSP_LUMPS.ENTITIES]);
    const textures = BspParser.readTextures(view, header.lumps[BSP_LUMPS.TEXTURES]);
    const vertices = BspParser.readVertices(view, header.lumps[BSP_LUMPS.VERTICES]);
    const meshVerts = BspParser.readMeshVerts(view, header.lumps[BSP_LUMPS.MESHVERTS]);
    const faces = BspParser.readFaces(view, header.lumps[BSP_LUMPS.FACES]);
    const models = BspParser.readModels(view, header.lumps[BSP_LUMPS.MODELS]);

    const rawLumps: Record<string, Uint8Array> = {
      planes: BspParser.readRaw(view, header.lumps[BSP_LUMPS.PLANES]),
      nodes: BspParser.readRaw(view, header.lumps[BSP_LUMPS.NODES]),
      leafs: BspParser.readRaw(view, header.lumps[BSP_LUMPS.LEAFS]),
      leafFaces: BspParser.readRaw(view, header.lumps[BSP_LUMPS.LEAFFACES]),
      leafBrushes: BspParser.readRaw(view, header.lumps[BSP_LUMPS.LEAFBRUSHES]),
      brushes: BspParser.readRaw(view, header.lumps[BSP_LUMPS.BRUSHES]),
      brushSides: BspParser.readRaw(view, header.lumps[BSP_LUMPS.BRUSHSIDES]),
      effects: BspParser.readRaw(view, header.lumps[BSP_LUMPS.EFFECTS]),
      lightmaps: BspParser.readRaw(view, header.lumps[BSP_LUMPS.LIGHTMAPS]),
      lightvols: BspParser.readRaw(view, header.lumps[BSP_LUMPS.LIGHTVOLS]),
      visdata: BspParser.readRaw(view, header.lumps[BSP_LUMPS.VISDATA]),
    };

    return {
      header,
      entities,
      textures,
      vertices,
      meshVerts,
      faces,
      models,
      rawLumps,
    };
  }

  private static readEntities(view: DataView, lump: BspLump): string {
    if (lump.length === 0) {
      return '';
    }
    const bytes = new Uint8Array(view.buffer, lump.offset, lump.length);
    return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '');
  }

  private static readTextures(view: DataView, lump: BspLump): BspTexture[] {
    const stride = 72;
    const count = Math.floor(lump.length / stride);
    const out: BspTexture[] = [];
    let offset = lump.offset;
    for (let i = 0; i < count; i += 1) {
      const name = BspParser.readString(view, offset, 64).replace(/\0+$/, '');
      const surfaceFlags = view.getInt32(offset + 64, true);
      const contents = view.getInt32(offset + 68, true);
      out.push({ name, surfaceFlags, contents });
      offset += stride;
    }
    return out;
  }

  private static readVertices(view: DataView, lump: BspLump): BspVertex[] {
    const stride = 44;
    const count = Math.floor(lump.length / stride);
    const out: BspVertex[] = [];
    let offset = lump.offset;
    for (let i = 0; i < count; i += 1) {
      const position = new Vec3(
        view.getFloat32(offset + 0, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true)
      );
      const texCoord = {
        x: view.getFloat32(offset + 12, true),
        y: view.getFloat32(offset + 16, true),
      };
      const lmCoord = {
        x: view.getFloat32(offset + 20, true),
        y: view.getFloat32(offset + 24, true),
      };
      const normal = new Vec3(
        view.getFloat32(offset + 28, true),
        view.getFloat32(offset + 32, true),
        view.getFloat32(offset + 36, true)
      );
      const color: [number, number, number, number] = [
        view.getUint8(offset + 40),
        view.getUint8(offset + 41),
        view.getUint8(offset + 42),
        view.getUint8(offset + 43),
      ];
      out.push({ position, texCoord, lmCoord, normal, color });
      offset += stride;
    }
    return out;
  }

  private static readMeshVerts(view: DataView, lump: BspLump): Int32Array {
    if (lump.length === 0) {
      return new Int32Array();
    }
    const count = Math.floor(lump.length / 4);
    const array = new Int32Array(count);
    let offset = lump.offset;
    for (let i = 0; i < count; i += 1) {
      array[i] = view.getInt32(offset, true);
      offset += 4;
    }
    return array;
  }

  private static readFaces(view: DataView, lump: BspLump): BspFace[] {
    const stride = 104;
    const count = Math.floor(lump.length / stride);
    const out: BspFace[] = [];
    let offset = lump.offset;
    for (let i = 0; i < count; i += 1) {
      const textureIndex = view.getInt32(offset + 0, true);
      const effectIndex = view.getInt32(offset + 4, true);
      const type = view.getInt32(offset + 8, true);
      const vertexIndex = view.getInt32(offset + 12, true);
      const numVertices = view.getInt32(offset + 16, true);
      const meshVertIndex = view.getInt32(offset + 20, true);
      const numMeshVerts = view.getInt32(offset + 24, true);
      const lmIndex = view.getInt32(offset + 28, true);
      const lmStart: [number, number] = [
        view.getInt32(offset + 32, true),
        view.getInt32(offset + 36, true),
      ];
      const lmSize: [number, number] = [
        view.getInt32(offset + 40, true),
        view.getInt32(offset + 44, true),
      ];
      const lmOrigin = new Vec3(
        view.getFloat32(offset + 48, true),
        view.getFloat32(offset + 52, true),
        view.getFloat32(offset + 56, true)
      );
      const lmVecs: [Vec3, Vec3] = [
        new Vec3(
          view.getFloat32(offset + 60, true),
          view.getFloat32(offset + 64, true),
          view.getFloat32(offset + 68, true)
        ),
        new Vec3(
          view.getFloat32(offset + 72, true),
          view.getFloat32(offset + 76, true),
          view.getFloat32(offset + 80, true)
        ),
      ];
      const normal = new Vec3(
        view.getFloat32(offset + 84, true),
        view.getFloat32(offset + 88, true),
        view.getFloat32(offset + 92, true)
      );
      const size: [number, number] = [
        view.getInt32(offset + 96, true),
        view.getInt32(offset + 100, true),
      ];
      out.push({
        textureIndex,
        effectIndex,
        type,
        vertexIndex,
        numVertices,
        meshVertIndex,
        numMeshVerts,
        lmIndex,
        lmStart,
        lmSize,
        lmOrigin,
        lmVecs,
        normal,
        size,
      });
      offset += stride;
    }
    return out;
  }

  private static readModels(view: DataView, lump: BspLump): BspModel[] {
    const stride = 40;
    const count = Math.floor(lump.length / stride);
    const out: BspModel[] = [];
    let offset = lump.offset;
    for (let i = 0; i < count; i += 1) {
      const mins = new Vec3(
        view.getFloat32(offset + 0, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true)
      );
      const maxs = new Vec3(
        view.getFloat32(offset + 12, true),
        view.getFloat32(offset + 16, true),
        view.getFloat32(offset + 20, true)
      );
      const faceIndex = view.getInt32(offset + 24, true);
      const numFaces = view.getInt32(offset + 28, true);
      const brushIndex = view.getInt32(offset + 32, true);
      const numBrushes = view.getInt32(offset + 36, true);
      out.push({ mins, maxs, faceIndex, numFaces, brushIndex, numBrushes });
      offset += stride;
    }
    return out;
  }

  private static readRaw(view: DataView, lump: BspLump): Uint8Array {
    if (lump.length === 0) {
      return new Uint8Array();
    }
    return new Uint8Array(view.buffer, lump.offset, lump.length);
  }

  private static readString(view: DataView, offset: number, length: number): string {
    const bytes = new Uint8Array(view.buffer, offset, length);
    return new TextDecoder('ascii').decode(bytes);
  }
}
