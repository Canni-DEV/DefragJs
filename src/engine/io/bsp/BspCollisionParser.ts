import { invariant } from '../../core/Debug/Assertions';
import { Vec3 } from '../../core/Math/Vec3';
import { BspData } from './BspTypes';
import {
  BspBrush,
  BspBrushSide,
  BspCollisionData,
  BspLeaf,
  BspNode,
  BspPlane,
} from './BspCollisionTypes';

export class BspCollisionParser {
  static parse(bsp: BspData): BspCollisionData {
    const planes = BspCollisionParser.requireLump(bsp, 'planes');
    const nodes = BspCollisionParser.requireLump(bsp, 'nodes');
    const leafs = BspCollisionParser.requireLump(bsp, 'leafs');
    const leafBrushes = BspCollisionParser.requireLump(bsp, 'leafBrushes');
    const brushes = BspCollisionParser.requireLump(bsp, 'brushes');
    const brushSides = BspCollisionParser.requireLump(bsp, 'brushSides');
    return {
      planes: BspCollisionParser.readPlanes(planes),
      nodes: BspCollisionParser.readNodes(nodes),
      leafs: BspCollisionParser.readLeafs(leafs),
      leafBrushes: BspCollisionParser.readLeafBrushes(leafBrushes),
      brushes: BspCollisionParser.readBrushes(brushes),
      brushSides: BspCollisionParser.readBrushSides(brushSides),
    };
  }

  private static requireLump(bsp: BspData, key: string): Uint8Array {
    const lump = bsp.rawLumps[key];
    invariant(lump !== undefined, `Missing BSP lump: ${key}`);
    return lump;
  }

  private static readPlanes(raw: Uint8Array): BspPlane[] {
    const stride = 16;
    invariant(raw.byteLength % stride === 0, 'Plane lump length invalid');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const count = raw.byteLength / stride;
    const planes: BspPlane[] = [];
    let offset = 0;
    for (let i = 0; i < count; i += 1) {
      const normal = new Vec3(
        view.getFloat32(offset + 0, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true)
      );
      const dist = view.getFloat32(offset + 12, true);
      planes.push({ normal, dist, type: 0 });
      offset += stride;
    }
    return planes;
  }

  private static readNodes(raw: Uint8Array): BspNode[] {
    const stride = 36;
    invariant(raw.byteLength % stride === 0, 'Node lump length invalid');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const count = raw.byteLength / stride;
    const nodes: BspNode[] = [];
    let offset = 0;
    for (let i = 0; i < count; i += 1) {
      const planeIndex = view.getInt32(offset + 0, true);
      const child0 = view.getInt32(offset + 4, true);
      const child1 = view.getInt32(offset + 8, true);
      const mins: [number, number, number] = [
        view.getInt32(offset + 12, true),
        view.getInt32(offset + 16, true),
        view.getInt32(offset + 20, true),
      ];
      const maxs: [number, number, number] = [
        view.getInt32(offset + 24, true),
        view.getInt32(offset + 28, true),
        view.getInt32(offset + 32, true),
      ];
      nodes.push({ planeIndex, children: [child0, child1], mins, maxs });
      offset += stride;
    }
    return nodes;
  }

  private static readLeafs(raw: Uint8Array): BspLeaf[] {
    const stride = 48;
    invariant(raw.byteLength % stride === 0, 'Leaf lump length invalid');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const count = raw.byteLength / stride;
    const leafs: BspLeaf[] = [];
    let offset = 0;
    for (let i = 0; i < count; i += 1) {
      const cluster = view.getInt32(offset + 0, true);
      const area = view.getInt32(offset + 4, true);
      const mins: [number, number, number] = [
        view.getInt32(offset + 8, true),
        view.getInt32(offset + 12, true),
        view.getInt32(offset + 16, true),
      ];
      const maxs: [number, number, number] = [
        view.getInt32(offset + 20, true),
        view.getInt32(offset + 24, true),
        view.getInt32(offset + 28, true),
      ];
      const leafFace = view.getInt32(offset + 32, true);
      const numLeafFaces = view.getInt32(offset + 36, true);
      const leafBrush = view.getInt32(offset + 40, true);
      const numLeafBrushes = view.getInt32(offset + 44, true);
      leafs.push({
        cluster,
        area,
        mins,
        maxs,
        leafFace,
        numLeafFaces,
        leafBrush,
        numLeafBrushes,
      });
      offset += stride;
    }
    return leafs;
  }

  private static readLeafBrushes(raw: Uint8Array): Int32Array {
    const stride = 4;
    invariant(raw.byteLength % stride === 0, 'LeafBrush lump length invalid');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const count = raw.byteLength / stride;
    const out = new Int32Array(count);
    let offset = 0;
    for (let i = 0; i < count; i += 1) {
      out[i] = view.getInt32(offset, true);
      offset += stride;
    }
    return out;
  }

  private static readBrushes(raw: Uint8Array): BspBrush[] {
    const stride = 12;
    invariant(raw.byteLength % stride === 0, 'Brush lump length invalid');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const count = raw.byteLength / stride;
    const brushes: BspBrush[] = [];
    let offset = 0;
    for (let i = 0; i < count; i += 1) {
      const brushSide = view.getInt32(offset + 0, true);
      const numSides = view.getInt32(offset + 4, true);
      const textureIndex = view.getInt32(offset + 8, true);
      brushes.push({ brushSide, numSides, textureIndex });
      offset += stride;
    }
    return brushes;
  }

  private static readBrushSides(raw: Uint8Array): BspBrushSide[] {
    const stride = 8;
    invariant(raw.byteLength % stride === 0, 'BrushSide lump length invalid');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const count = raw.byteLength / stride;
    const sides: BspBrushSide[] = [];
    let offset = 0;
    for (let i = 0; i < count; i += 1) {
      const planeNum = view.getInt32(offset + 0, true);
      const textureIndex = view.getInt32(offset + 4, true);
      sides.push({ planeNum, textureIndex });
      offset += stride;
    }
    return sides;
  }
}
