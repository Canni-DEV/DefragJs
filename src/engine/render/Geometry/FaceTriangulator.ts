import { BspData, BspFace, BspVertex } from '../../io/bsp/BspTypes';
import { PatchTessellator } from './PatchTessellator';

export type GeometryBatch = {
  textureName: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

export class FaceTriangulator {
  static buildBatches(bsp: BspData, patchSubdiv = 5): GeometryBatch[] {
    const batches = new Map<string, GeometryBatch>();

    const getBatch = (textureName: string): GeometryBatch => {
      const key = textureName.length > 0 ? textureName : 'default';
      const existing = batches.get(key);
      if (existing) {
        return existing;
      }
      const batch: GeometryBatch = {
        textureName: key,
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      };
      batches.set(key, batch);
      return batch;
    };

    for (const face of bsp.faces) {
      const textureName = bsp.textures[face.textureIndex]?.name ?? 'default';
      const batch = getBatch(textureName);

      switch (face.type) {
        case 1:
          FaceTriangulator.addPolygonFace(batch, bsp.vertices, face);
          break;
        case 2:
          FaceTriangulator.addPatchFace(batch, bsp.vertices, face, patchSubdiv);
          break;
        case 3:
          FaceTriangulator.addMeshFace(batch, bsp.vertices, bsp.meshVerts, face);
          break;
        default:
          break;
      }
    }

    return Array.from(batches.values());
  }

  private static addPolygonFace(batch: GeometryBatch, vertices: BspVertex[], face: BspFace): void {
    const base = batch.positions.length / 3;
    for (let i = 0; i < face.numVertices; i += 1) {
      const v = vertices[face.vertexIndex + i];
      if (!v) {
        continue;
      }
      batch.positions.push(v.position.x, v.position.y, v.position.z);
      batch.normals.push(v.normal.x, v.normal.y, v.normal.z);
      batch.uvs.push(v.texCoord.x, v.texCoord.y);
    }
    for (let i = 1; i < face.numVertices - 1; i += 1) {
      batch.indices.push(base, base + i, base + i + 1);
    }
  }

  private static addMeshFace(
    batch: GeometryBatch,
    vertices: BspVertex[],
    meshVerts: Int32Array,
    face: BspFace
  ): void {
    const base = batch.positions.length / 3;
    for (let i = 0; i < face.numVertices; i += 1) {
      const v = vertices[face.vertexIndex + i];
      if (!v) {
        continue;
      }
      batch.positions.push(v.position.x, v.position.y, v.position.z);
      batch.normals.push(v.normal.x, v.normal.y, v.normal.z);
      batch.uvs.push(v.texCoord.x, v.texCoord.y);
    }

    const start = face.meshVertIndex;
    const end = face.meshVertIndex + face.numMeshVerts;
    for (let i = start; i < end; i += 3) {
      const a = meshVerts[i];
      const b = meshVerts[i + 1];
      const c = meshVerts[i + 2];
      if (a === undefined || b === undefined || c === undefined) {
        continue;
      }
      batch.indices.push(base + a, base + b, base + c);
    }
  }

  private static addPatchFace(
    batch: GeometryBatch,
    vertices: BspVertex[],
    face: BspFace,
    patchSubdiv: number
  ): void {
    const control: BspVertex[] = [];
    for (let i = 0; i < face.numVertices; i += 1) {
      const v = vertices[face.vertexIndex + i];
      if (!v) {
        continue;
      }
      control.push(v);
    }
    const expected = face.size[0] * face.size[1];
    if (control.length < 9 || control.length < expected) {
      return;
    }
    const patch = PatchTessellator.tessellate(control, face.size[0], face.size[1], patchSubdiv);
    const base = batch.positions.length / 3;
    batch.positions.push(...patch.positions);
    batch.normals.push(...patch.normals);
    batch.uvs.push(...patch.uvs);
    for (const idx of patch.indices) {
      batch.indices.push(base + idx);
    }
  }
}
